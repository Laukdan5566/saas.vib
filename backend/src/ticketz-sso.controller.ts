import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { sign } from "jsonwebtoken";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import { RequestWithUser } from "./types";

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/backend\/?$/, "").replace(/\/$/, "");
}

function serviceEmail(slug: string) {
  const domain = process.env.TICKETZ_SSO_EMAIL_DOMAIN || "correacloud.local";
  return `vib-${slug}@${domain}`.toLowerCase();
}

@UseGuards(AuthGuard)
@Controller("api/ticketz")
export class TicketzSsoController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("sso-url")
  async createSsoUrl(@Body() body: { companyId?: string }, @Req() req: RequestWithUser) {
    const user = req.user!;
    const companyId = String(body.companyId || user.companyId || "");

    if (!companyId) {
      throw new ForbiddenException("Empresa nao informada.");
    }

    if (user.role !== UserRole.super_admin && user.companyId !== companyId) {
      throw new ForbiddenException("Empresa fora do escopo do usuario.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company || !company.active) {
      throw new NotFoundException("Empresa nao encontrada.");
    }

    const baseUrl = cleanBaseUrl(company.ticketzBaseUrl || process.env.TICKETZ_BASE_URL || "");
    if (!baseUrl) {
      throw new NotFoundException("URL do Vib Chat nao configurada.");
    }

    const secret = process.env.TICKETZ_SSO_SECRET;
    if (!secret) {
      throw new ForbiddenException("SSO do Vib Chat nao configurado.");
    }

    const token = sign(
      {
        iss: "vib-saas",
        aud: "vib-chat",
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        companyPhone: company.phone,
        companyEmail: company.email,
        ticketzCompanyId: company.ticketzCompanyId,
        ticketzUserName: `Atendimento ${company.name}`,
        ticketzUserEmail: serviceEmail(company.slug),
        ticketzUserProfile: process.env.TICKETZ_SSO_USER_PROFILE || "admin",
        ticketzUserPermissions: {
          "tickets-manager:showall": true,
          "tickets-manager:showQueueTickets": true,
          "ticket-participants:view": true,
          "ticket-participants:sendMessage": true,
          "connections:view": true
        }
      },
      secret,
      { expiresIn: "2m" }
    );

    return {
      url: `${baseUrl}/backend/auth/saas-login?token=${encodeURIComponent(token)}`,
      baseUrl
    };
  }
}
