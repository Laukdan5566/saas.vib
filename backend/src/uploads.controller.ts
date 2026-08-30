import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
import { RequestWithUser } from "./types";

type UploadBody = {
  companyId?: string;
  fileName?: string;
  contentType?: string;
  dataUrl?: string;
};

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const allowedChatTypes: Record<string, string> = {
  ...allowedImageTypes,
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};

function uploadsRoot() {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

function requestBaseUrl(req: RequestWithUser) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || "localhost:3000";
  return process.env.PUBLIC_API_URL || `${proto}://${host}`;
}

@Controller("api/uploads")
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard)
  @Post("images")
  async uploadImage(@Body() body: UploadBody, @Req() req: RequestWithUser) {
    const user = req.user!;
    const companyId = user.role === UserRole.super_admin ? String(body.companyId || "") : String(user.companyId || "");
    if (!companyId) throw new BadRequestException("Empresa obrigatoria para enviar imagem.");
    if (user.role !== UserRole.super_admin && companyId !== user.companyId) {
      throw new ForbiddenException("Empresa invalida para este usuario.");
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

    const match = String(body.dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const contentType = match?.[1] || String(body.contentType || "");
    const extension = allowedImageTypes[contentType];
    if (!match || !extension) {
      throw new BadRequestException("Envie uma imagem JPG, PNG, WEBP ou GIF.");
    }

    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 6 * 1024 * 1024) {
      throw new BadRequestException("Imagem invalida ou maior que 6MB.");
    }

    const dir = join(uploadsRoot(), "menu", companyId);
    await mkdir(dir, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(join(dir, fileName), buffer);

    const url = `${requestBaseUrl(req)}/api/uploads/files/${companyId}/${fileName}`;
    return { url, fileName, contentType, size: buffer.length };
  }

  @UseGuards(AuthGuard)
  @Post("chat-files")
  async uploadChatFile(@Body() body: UploadBody, @Req() req: RequestWithUser) {
    const user = req.user!;
    const companyId = user.role === UserRole.super_admin ? String(body.companyId || "") : String(user.companyId || "");
    if (!companyId) throw new BadRequestException("Empresa obrigatoria para enviar arquivo.");
    if (user.role !== UserRole.super_admin && companyId !== user.companyId) {
      throw new ForbiddenException("Empresa invalida para este usuario.");
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

    const match = String(body.dataUrl || "").match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
    const contentType = match?.[1] || String(body.contentType || "");
    const extension = allowedChatTypes[contentType];
    if (!match || !extension) {
      throw new BadRequestException("Envie imagem, audio, video, PDF ou documento comum.");
    }

    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) {
      throw new BadRequestException("Arquivo invalido ou maior que 15MB.");
    }

    const dir = join(uploadsRoot(), "chat", companyId);
    await mkdir(dir, { recursive: true });

    const original = String(body.fileName || "arquivo").replace(/[^a-zA-Z0-9_. -]/g, "").slice(0, 80);
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(join(dir, fileName), buffer);

    const url = `${requestBaseUrl(req)}/api/uploads/chat-files/${companyId}/${fileName}`;
    return { url, fileName, originalFileName: original, contentType, size: buffer.length };
  }

  @Get("chat-files/:companyId/:fileName")
  async chatFile(@Param("companyId") companyId: string, @Param("fileName") fileName: string, @Res() res: any) {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = join(uploadsRoot(), "chat", companyId, safeFileName);
    if (!existsSync(filePath)) throw new NotFoundException("Arquivo nao encontrado.");
    return res.sendFile(filePath);
  }

  @Get("files/:companyId/:fileName")
  async file(@Param("companyId") companyId: string, @Param("fileName") fileName: string, @Res() res: any) {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = join(uploadsRoot(), "menu", companyId, safeFileName);
    if (!existsSync(filePath)) throw new NotFoundException("Imagem nao encontrada.");
    return res.sendFile(filePath);
  }
}
