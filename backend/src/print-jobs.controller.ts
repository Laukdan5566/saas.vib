import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PrintJobStatus } from "@prisma/client";
import { AgentGuard } from "./agent.guard";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { RequestWithUser } from "./types";

type PrintAgentHeartbeatBody = {
  queue_printer_name?: string;
  windows_printer_name?: string;
  default_printer_name?: string;
  available_printers?: string[];
  agent_version?: string;
  hostname?: string;
  os?: string;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function objectConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

@Controller("api/print-jobs")
export class PrintJobsController {
  constructor(
    private readonly app: AppService,
    private readonly prisma: PrismaService
  ) {}

  @UseGuards(AgentGuard)
  @Get("pending")
  pending(
    @Query("printer_name") printerName: string | undefined,
    @Req() req: RequestWithUser
  ) {
    const companyId = String(req.headers["x-company-id"] || req.query.company_id || "");
    const agentVersion = String(req.headers["x-agent-version"] || "");
    if (!agentVersion) {
      return [];
    }
    return this.app.pendingPrintJobs(companyId, printerName);
  }

  @UseGuards(AgentGuard)
  @Post("heartbeat")
  async heartbeat(@Body() body: PrintAgentHeartbeatBody, @Req() req: RequestWithUser) {
    const agentVersionHeader = String(req.headers["x-agent-version"] || "");
    if (!agentVersionHeader) {
      return { ok: true, ignored: true };
    }

    const companyId = String(req.headers["x-company-id"] || "");
    const availablePrinters = Array.isArray(body.available_printers)
      ? body.available_printers.map(cleanText).filter((name): name is string => Boolean(name)).slice(0, 30)
      : [];
    const queuePrinterName = cleanText(body.queue_printer_name) || "Impressora local";
    const windowsPrinterName = cleanText(body.windows_printer_name)
      || cleanText(body.default_printer_name)
      || availablePrinters[0]
      || null;
    const now = new Date();
    const agent = {
      online: true,
      lastSeenAt: now.toISOString(),
      queuePrinterName,
      windowsPrinterName,
      defaultPrinterName: cleanText(body.default_printer_name),
      availablePrinters,
      agentVersion: cleanText(body.agent_version) || agentVersionHeader,
      hostname: cleanText(body.hostname),
      os: cleanText(body.os)
    };

    const currentModule = await this.prisma.companyModule.findUnique({
      where: { companyId_moduleKey: { companyId, moduleKey: "printing" } }
    });
    const currentConfig = objectConfig(currentModule?.config);

    await this.prisma.companyModule.upsert({
      where: { companyId_moduleKey: { companyId, moduleKey: "printing" } },
      create: {
        companyId,
        moduleKey: "printing",
        name: "Impressao",
        description: "Agente local de impressao",
        active: true,
        config: { ...currentConfig, agent }
      },
      update: {
        active: true,
        config: { ...currentConfig, agent }
      }
    });

    let printer = await this.prisma.printer.findFirst({
      where: { companyId, connectionType: "local_agent" },
      orderBy: { createdAt: "asc" }
    });

    if (!printer) {
      printer = await this.prisma.printer.create({
        data: {
          companyId,
          name: queuePrinterName,
          description: windowsPrinterName ? `Usando no Windows: ${windowsPrinterName}` : "Agente local aguardando impressora padrao.",
          printerType: "windows",
          connectionType: "local_agent",
          paperWidth: "mm80",
          active: true,
          defaultForOrders: true,
          defaultForKitchen: true,
          defaultForDelivery: true
        }
      });
    } else {
      printer = await this.prisma.printer.update({
        where: { id: printer.id },
        data: {
          active: true,
          description: windowsPrinterName ? `Usando no Windows: ${windowsPrinterName}` : printer.description
        }
      });
    }

    return { ok: true, agent, printer };
  }

  @UseGuards(AgentGuard)
  @Post(":id/claim")
  async claim(@Param("id") id: string, @Req() req: RequestWithUser) {
    const companyId = String(req.headers["x-company-id"] || req.body.company_id || "");
    const result = await this.prisma.printJob.updateMany({
      where: { id, companyId, status: PrintJobStatus.pending },
      data: { status: PrintJobStatus.printing, attempts: { increment: 1 } }
    });

    if (result.count === 0) {
      return { claimed: false };
    }

    return this.prisma.printJob.findFirst({
      where: { id, companyId },
      include: { printer: true }
    });
  }

  @UseGuards(AgentGuard)
  @Post(":id/success")
  success(@Param("id") id: string, @Req() req: RequestWithUser) {
    const companyId = String(req.headers["x-company-id"] || req.body.company_id || "");
    return this.prisma.printJob.updateMany({
      where: { id, companyId },
      data: { status: PrintJobStatus.printed, printedAt: new Date(), errorMessage: null }
    });
  }

  @UseGuards(AgentGuard)
  @Post(":id/fail")
  fail(
    @Param("id") id: string,
    @Body() body: { error_message?: string; company_id?: string },
    @Req() req: RequestWithUser
  ) {
    const companyId = String(req.headers["x-company-id"] || body.company_id || "");
    return this.prisma.printJob.updateMany({
      where: { id, companyId },
      data: {
        status: PrintJobStatus.failed,
        errorMessage: body.error_message || "Erro desconhecido"
      }
    });
  }
}
