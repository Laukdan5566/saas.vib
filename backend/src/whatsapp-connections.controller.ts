import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { NativeWhatsappService } from "./native-whatsapp.service";
import { RequestWithUser } from "./types";

@UseGuards(AuthGuard)
@Controller("api/whatsapp-connections")
export class WhatsappConnectionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
    private readonly nativeWhatsapp: NativeWhatsappService
  ) {}

  private async getConnection(id: string, req: RequestWithUser) {
    const user = req.user!;
    const connection = await this.prisma.whatsappConnection.findFirst({
      where: {
        id,
        ...(user.role === UserRole.super_admin ? {} : { companyId: user.companyId || "" })
      }
    });

    if (!connection) {
      throw new NotFoundException("Conexao WhatsApp nao encontrada.");
    }

    await this.app.assertModuleEnabled("whatsappConnections", connection.companyId);
    return connection;
  }

  private ticketzBackendUrl(baseUrl: unknown) {
    const clean = String(baseUrl || process.env.TICKETZ_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    if (!clean) return "";
    return clean.endsWith("/backend") ? clean : `${clean}/backend`;
  }

  private normalizeTicketzStatus(value: unknown) {
    const status = String(value || "DISCONNECTED").trim();
    if (status.toLowerCase() === "qrcode") return "QRCODE";
    return status.toUpperCase();
  }

  private async callTicketzConnectionAction(connection: any, action: string) {
    const company = await this.prisma.company.findUnique({ where: { id: connection.companyId } });
    const backendUrl = this.ticketzBackendUrl(company?.ticketzBaseUrl);
    const token = String(company?.ticketzApiToken || process.env.TICKETZ_API_TOKEN || "").trim();
    const ticketzWhatsappId = String(company?.ticketzWhatsappId || "").trim();

    if (!backendUrl || !token || !ticketzWhatsappId) {
      throw new BadRequestException("Integração Ticketz da empresa ainda não está configurada.");
    }

    const response = await fetch(`${backendUrl}/integrations/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        action,
        whatsappId: ticketzWhatsappId,
        ticketzWhatsappId
      })
    });
    const text = await response.text();
    let data: Record<string, any> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new BadRequestException(data?.message || data?.error || data?.raw || `Ticketz retornou ${response.status}.`);
    }

    const whatsapp = data.whatsapp || {};
    return this.prisma.whatsappConnection.update({
      where: { id: connection.id },
      data: {
        status: this.normalizeTicketzStatus(whatsapp.status),
        qrcode: whatsapp.qrcode || null,
        battery: whatsapp.battery === undefined || whatsapp.battery === null ? null : String(whatsapp.battery),
        plugged: whatsapp.plugged === undefined ? null : Boolean(whatsapp.plugged),
        retries: whatsapp.retries === undefined ? connection.retries : Number(whatsapp.retries || 0),
        session: this.normalizeTicketzStatus(whatsapp.status) === "CONNECTED" ? `ticketz-${ticketzWhatsappId}` : connection.session,
        provider: whatsapp.provider || connection.provider || "ticketz",
        channel: whatsapp.channel || connection.channel || "whatsapp",
        token: connection.token || company?.ticketzApiToken || null,
        isDefault: true
      }
    });
  }

  @Post(":id/start")
  async start(@Param("id") id: string, @Req() req: RequestWithUser) {
    const connection = await this.getConnection(id, req);
    if (connection.provider === "native") return this.nativeWhatsapp.start(connection.id);
    return this.callTicketzConnectionAction(connection, "start_whatsapp_session");
  }

  @Post(":id/connected")
  async connected(@Param("id") id: string, @Req() req: RequestWithUser) {
    const connection = await this.getConnection(id, req);
    if (connection.provider === "native") return this.nativeWhatsapp.status(connection.id);
    return this.callTicketzConnectionAction(connection, "whatsapp_status");
  }

  @Post(":id/disconnect")
  async disconnect(@Param("id") id: string, @Req() req: RequestWithUser) {
    const connection = await this.getConnection(id, req);
    if (connection.provider === "native") return this.nativeWhatsapp.disconnect(connection.id);
    return this.callTicketzConnectionAction(connection, "disconnect_whatsapp_session");
  }

  @Post(":id/refresh")
  async refresh(@Param("id") id: string, @Req() req: RequestWithUser) {
    const connection = await this.getConnection(id, req);
    if (connection.provider === "native") return this.nativeWhatsapp.refresh(connection.id);
    return this.callTicketzConnectionAction(connection, "refresh_whatsapp_session");
  }

  @Post(":id/migrate-native")
  async migrateNative(@Param("id") id: string, @Req() req: RequestWithUser) {
    const connection = await this.getConnection(id, req);
    await this.prisma.whatsappConnection.update({
      where: { id: connection.id },
      data: { provider: "native", status: "DISCONNECTED", session: null, qrcode: null }
    });
    return this.nativeWhatsapp.start(connection.id);
  }

  @Post(":id/ticketz-config")
  async ticketzConfig(
    @Param("id") id: string,
    @Body() body: { ticketzWhatsappId?: string; ticketzQueueId?: string },
    @Req() req: RequestWithUser
  ) {
    const connection = await this.getConnection(id, req);
    return this.prisma.company.update({
      where: { id: connection.companyId },
      data: {
        ticketzWhatsappId: body.ticketzWhatsappId,
        ticketzQueueId: body.ticketzQueueId
      }
    });
  }
}
