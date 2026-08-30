import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  downloadMediaMessage,
  initAuthCreds,
  jidNormalizedUser,
  proto
} from "libzapitu-rf";
import pino from "pino";
import QRCode from "qrcode";
import { PrismaService } from "./prisma.service";

type AnyRecord = Record<string, any>;
type NativeSocket = ReturnType<typeof makeWASocket>;

@Injectable()
export class NativeWhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NativeWhatsappService.name);
  private readonly sessions = new Map<string, NativeSocket>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    if (process.env.NATIVE_WHATSAPP_AUTOSTART === "false") return;
    const connections = await this.prisma.whatsappConnection.findMany({
      where: { provider: "native", session: { not: null } }
    });
    for (const connection of connections) {
      void this.start(connection.id, true).catch(error =>
        this.logger.error(`Falha ao restaurar WhatsApp ${connection.id}: ${this.errorMessage(error)}`)
      );
    }
  }

  async onModuleDestroy() {
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    for (const socket of this.sessions.values()) socket.end(undefined);
    this.sessions.clear();
  }

  async start(connectionId: string, reconnecting = false) {
    const connection = await this.prisma.whatsappConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new BadRequestException("Conexao WhatsApp nao encontrada.");

    if (connection.provider !== "native") {
      connection.provider = "native";
      await this.prisma.whatsappConnection.update({
        where: { id: connection.id },
        data: { provider: "native" }
      });
    }

    this.clearReconnect(connectionId);
    this.sessions.get(connectionId)?.end(undefined);
    this.sessions.delete(connectionId);

    const { state, saveCreds } = await this.authState(connectionId, connection.session);
    const socket = makeWASocket({
      auth: state,
      logger: pino({ level: process.env.WHATSAPP_LOG_LEVEL || "silent" }) as any,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      emitOwnEvents: false,
      browser: ["Correacloud SaaS", "Desktop", "1.0.0"],
      getMessage: async () => undefined
    }) as NativeSocket;

    this.sessions.set(connectionId, socket);
    await this.prisma.whatsappConnection.update({
      where: { id: connectionId },
      data: { status: reconnecting ? "OPENING" : "CONNECTING", qrcode: null }
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", update => void this.handleConnectionUpdate(connectionId, update));
    socket.ev.on("messages.upsert", event => void this.handleMessages(connectionId, event));

    return this.status(connectionId);
  }

  async status(connectionId: string) {
    return this.prisma.whatsappConnection.findUnique({ where: { id: connectionId } });
  }

  async refresh(connectionId: string) {
    return this.start(connectionId, true);
  }

  async disconnect(connectionId: string) {
    this.clearReconnect(connectionId);
    const socket = this.sessions.get(connectionId);
    if (socket) {
      try {
        await socket.logout();
      } catch {
        socket.end(undefined);
      }
    }
    this.sessions.delete(connectionId);
    await this.prisma.whatsappAuthKey.deleteMany({ where: { connectionId } });
    return this.prisma.whatsappConnection.update({
      where: { id: connectionId },
      data: { status: "DISCONNECTED", qrcode: null, session: null, retries: 0 }
    });
  }

  async send(
    connectionId: string,
    phone: string,
    message: { content?: string; mediaUrl?: string; fileName?: string; mimeType?: string }
  ) {
    const socket = this.sessions.get(connectionId);
    if (!socket) throw new BadRequestException("WhatsApp nativo nao esta conectado.");
    const number = this.cleanPhone(phone);
    if (!number) throw new BadRequestException("Telefone do cliente nao encontrado.");
    const jid = jidNormalizedUser(`${number}@s.whatsapp.net`);

    let sent: proto.IWebMessageInfo | undefined;
    if (message.mediaUrl) {
      const buffer = await this.loadMedia(message.mediaUrl);
      const mime = String(message.mimeType || "application/octet-stream").toLowerCase();
      if (mime.startsWith("image/")) {
        sent = await socket.sendMessage(jid, { image: buffer, caption: message.content || undefined, mimetype: mime });
      } else if (mime.startsWith("audio/")) {
        sent = await socket.sendMessage(jid, { audio: buffer, mimetype: mime, ptt: mime.includes("ogg") });
      } else if (mime.startsWith("video/")) {
        sent = await socket.sendMessage(jid, { video: buffer, caption: message.content || undefined, mimetype: mime });
      } else {
        sent = await socket.sendMessage(jid, {
          document: buffer,
          fileName: message.fileName || "arquivo",
          mimetype: mime,
          caption: message.content || undefined
        });
      }
    } else {
      sent = await socket.sendMessage(jid, { text: String(message.content || "") });
    }

    return { sent: true, provider: "native", messageId: sent?.key.id || null, jid };
  }

  private async handleConnectionUpdate(connectionId: string, update: AnyRecord) {
    if (update.qr) {
      const qrcode = await QRCode.toDataURL(update.qr, { margin: 1, width: 280 });
      await this.prisma.whatsappConnection.update({
        where: { id: connectionId },
        data: { qrcode, status: "QRCODE" }
      });
    }

    if (update.connection === "open") {
      await this.prisma.whatsappConnection.update({
        where: { id: connectionId },
        data: { qrcode: null, status: "CONNECTED", retries: 0 }
      });
      return;
    }

    if (update.connection !== "close") return;
    this.sessions.delete(connectionId);
    const statusCode = Number((update.lastDisconnect?.error as AnyRecord)?.output?.statusCode || 0);
    const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;
    await this.prisma.whatsappConnection.update({
      where: { id: connectionId },
      data: { status: loggedOut ? "DISCONNECTED" : "RECONNECTING", qrcode: null }
    });
    if (!loggedOut) this.scheduleReconnect(connectionId);
  }

  private async handleMessages(connectionId: string, event: AnyRecord) {
    if (event.type !== "notify") return;
    const connection = await this.prisma.whatsappConnection.findUnique({
      where: { id: connectionId },
      include: { company: true }
    });
    if (!connection) return;

    for (const message of event.messages || []) {
      const remoteJid = String(message.key?.remoteJid || "");
      if (!message.message || message.key?.fromMe || !remoteJid.endsWith("@s.whatsapp.net")) continue;
      try {
        const parsed = await this.parseInboundMessage(connection.companyId, message);
        const socket = this.sessions.get(connectionId);
        let profilePicUrl = "";
        try {
          profilePicUrl = String(socket ? await socket.profilePictureUrl(remoteJid, "image") || "" : "");
        } catch {
          profilePicUrl = "";
        }

        const chatServiceType = require("./chat.service").ChatService;
        const chat = this.moduleRef.get(chatServiceType, { strict: false });
        const result = await chat.receiveMessage(
          {
            event: "whatsapp.native.message",
            company_id: connection.companyId,
            ticketz_whatsapp_id: connection.id,
            ticket: {
              id: `${connection.id}:${remoteJid}`,
              status: "open",
              channel: "whatsapp",
              whatsappId: connection.id,
              metadata: { provider: "native", remoteJid }
            },
            contact: {
              id: remoteJid,
              name: message.pushName || this.cleanPhone(remoteJid),
              pushName: message.pushName,
              number: this.cleanPhone(remoteJid),
              profilePicUrl
            },
            message: {
              id: message.key?.id,
              fromMe: false,
              type: parsed.type,
              content: parsed.content,
              mediaUrl: parsed.mediaUrl,
              mimetype: parsed.mimeType,
              fileName: parsed.fileName,
              dataJson: message
            }
          },
          connection.company.webhookSecret || process.env.WEBHOOK_SECRET
        );
        await this.sendAutomationResponse(
          connectionId,
          remoteJid,
          connection.companyId,
          result?.ticketId,
          result?.n8n?.response
        );
      } catch (error) {
        this.logger.error(`Falha ao processar mensagem ${message.key?.id}: ${this.errorMessage(error)}`);
      }
    }
  }

  private async sendAutomationResponse(
    connectionId: string,
    remoteJid: string,
    companyId: string,
    ticketId: string | undefined,
    response: AnyRecord
  ) {
    if (!response) return;
    const envelopes = Array.isArray(response) ? response : [response];
    const actions = envelopes.flatMap(envelope => {
      const value = envelope?.json || envelope;
      return value?.output || value?.actions || (value?.type ? [value] : []);
    });
    for (const action of actions) {
      const type = String(action.type || "message").toLowerCase();
      if (!["message", "text", "media"].includes(type)) continue;
      const content = action.text || action.content || action.message || "";
      const mediaUrl = action.mediaUrl || action.url || "";
      if (!content && !mediaUrl) continue;
      const sent = await this.send(connectionId, this.cleanPhone(remoteJid), {
        content,
        mediaUrl,
        fileName: action.fileName,
        mimeType: action.mimeType
      });
      if (ticketId) {
        await this.prisma.messageLog.create({
          data: {
            companyId,
            ticketId,
            direction: "outbound",
            senderType: "bot",
            messageType: this.messageType(action.mimeType, type),
            content: content || action.fileName || "Midia enviada",
            ticketzMessageId: sent.messageId || undefined,
            metadata: { provider: "native", automation: "n8n", action, sent }
          }
        });
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { lastMessage: content || action.fileName || "Midia enviada", lastMessageAt: new Date() }
        });
      }
    }
  }

  private async parseInboundMessage(companyId: string, message: AnyRecord) {
    const payload = message.message || {};
    const content =
      payload.conversation ||
      payload.extendedTextMessage?.text ||
      payload.imageMessage?.caption ||
      payload.videoMessage?.caption ||
      payload.documentMessage?.caption ||
      payload.buttonsResponseMessage?.selectedDisplayText ||
      payload.listResponseMessage?.title ||
      "";
    const mediaNode = payload.imageMessage || payload.audioMessage || payload.videoMessage || payload.documentMessage;
    if (!mediaNode) return { type: "text", content: String(content) };

    const type = payload.imageMessage ? "image" : payload.audioMessage ? "audio" : "document";
    const mimeType = String(mediaNode.mimetype || "application/octet-stream");
    const extension = this.extensionFor(mimeType, type);
    const fileName = String(mediaNode.fileName || `whatsapp-${Date.now()}.${extension}`);
    const buffer = (await downloadMediaMessage(message as any, "buffer", {})) as Buffer;
    const dir = join(process.env.UPLOAD_DIR || join(process.cwd(), "uploads"), "chat", companyId);
    await mkdir(dir, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(join(dir, storedName), buffer);
    const baseUrl = String(process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
    const mediaUrl = `${baseUrl}/api/uploads/chat-files/${companyId}/${storedName}`;
    return { type, content: String(content || fileName), mediaUrl, mimeType, fileName };
  }

  private async authState(connectionId: string, serializedSession: string | null) {
    let creds = serializedSession
      ? JSON.parse(serializedSession, BufferJSON.reviver).creds
      : initAuthCreds();
    const saveCreds = async () => {
      await this.prisma.whatsappConnection.update({
        where: { id: connectionId },
        data: { session: JSON.stringify({ creds }, BufferJSON.replacer) }
      });
    };
    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const rows = await this.prisma.whatsappAuthKey.findMany({
              where: { connectionId, type, key: { in: ids } }
            });
            return Object.fromEntries(rows.map(row => [row.key, JSON.parse(row.value, BufferJSON.reviver)]));
          },
          set: async (data: AnyRecord) => {
            const operations: Promise<unknown>[] = [];
            for (const [type, values] of Object.entries(data)) {
              for (const [key, value] of Object.entries(values as AnyRecord)) {
                operations.push(
                  value
                    ? this.prisma.whatsappAuthKey.upsert({
                        where: { connectionId_type_key: { connectionId, type, key } },
                        create: { connectionId, type, key, value: JSON.stringify(value, BufferJSON.replacer) },
                        update: { value: JSON.stringify(value, BufferJSON.replacer) }
                      })
                    : this.prisma.whatsappAuthKey.deleteMany({ where: { connectionId, type, key } })
                );
              }
            }
            await Promise.all(operations);
          }
        }
      },
      saveCreds
    };
  }

  private scheduleReconnect(connectionId: string) {
    this.clearReconnect(connectionId);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(connectionId);
      void this.start(connectionId, true).catch(error =>
        this.logger.error(`Falha ao reconectar ${connectionId}: ${this.errorMessage(error)}`)
      );
    }, 5000);
    this.reconnectTimers.set(connectionId, timer);
  }

  private clearReconnect(connectionId: string) {
    const timer = this.reconnectTimers.get(connectionId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(connectionId);
  }

  private async loadMedia(url: string) {
    if (url.startsWith("data:")) return Buffer.from(url.split(",", 2)[1] || "", "base64");
    const publicBase = String(process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
    if (publicBase && url.startsWith(`${publicBase}/api/uploads/chat-files/`)) {
      const relative = url.slice(`${publicBase}/api/uploads/chat-files/`.length);
      const [companyId, fileName] = relative.split("/");
      return readFile(join(process.env.UPLOAD_DIR || join(process.cwd(), "uploads"), "chat", companyId, fileName));
    }
    const response = await fetch(url);
    if (!response.ok) throw new BadRequestException(`Nao foi possivel baixar a midia (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  private extensionFor(mimeType: string, fallback: string) {
    const subtype = mimeType.split("/", 2)[1]?.split(";", 1)[0]?.replace(/[^a-z0-9]/gi, "");
    return subtype || extname(fallback).replace(".", "") || fallback || "bin";
  }

  private messageType(mimeType: unknown, actionType: string) {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.startsWith("image/")) return "image" as const;
    if (mime.startsWith("audio/")) return "audio" as const;
    if (actionType === "media" || mime) return "document" as const;
    return "text" as const;
  }

  private cleanPhone(value: unknown) {
    return String(value || "").split("@", 1)[0].replace(/\D/g, "");
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
