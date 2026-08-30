import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MessageDirection,
  MessageType,
  SenderType,
  UserRole
} from "@prisma/client";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { NativeWhatsappService } from "./native-whatsapp.service";
import { AuthUser } from "./types";

type AnyRecord = Record<string, any>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
    private readonly nativeWhatsapp: NativeWhatsappService
  ) {}

  async receiveMessage(body: AnyRecord, secret?: string) {
    const company = await this.resolveCompany(body);

    if (!company) {
      throw new BadRequestException("Empresa nao identificada no payload.");
    }

    const expectedSecret = company.webhookSecret || process.env.WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      throw new ForbiddenException("Webhook secret invalido.");
    }

    await this.app.assertModuleEnabled("tickets", company.id);

    const normalized = this.normalizePayload(body);
    const customer = await this.upsertCustomer(company.id, normalized.contact);
    const connection = await this.resolveConnection(company.id, normalized);
    const ticket = await this.upsertTicket(company.id, customer.id, normalized, connection?.id);

    if (normalized.message.id) {
      const existingLog = await this.prisma.messageLog.findFirst({
        where: {
          companyId: company.id,
          ticketzMessageId: normalized.message.id
        }
      });
      if (existingLog) {
        return {
          ok: true,
          duplicate: true,
          companyId: company.id,
          ticketId: ticket.id,
          customerId: customer.id,
          messageLogId: existingLog.id,
          n8n: { sent: false, reason: "duplicate_message" }
        };
      }
    }

    const messageLog = await this.prisma.messageLog.create({
      data: {
        companyId: company.id,
        ticketId: ticket.id,
        ticketzMessageId: normalized.message.id,
        direction: normalized.direction,
        senderType: normalized.senderType,
        messageType: normalized.message.type,
        content: normalized.message.content,
        metadata: body
      }
    });

    if (normalized.message.type === "location") {
      await this.saveLocation(company.id, customer.id, normalized.message);
    }

    const skipAutomation = Boolean(body.skip_n8n || body.skipN8n || body.skip_order_followup || body.skipOrderFollowup);
    const automationAllowed =
      !skipAutomation &&
      normalized.direction === "inbound" &&
      ticket.botEnabled &&
      !ticket.humanTakeover;
    const orderFollowup =
      automationAllowed
        ? await this.app.sendOrderFollowupSummary(
            company.id,
            normalized.contact.phone,
            normalized.message.content
          )
        : { handled: false };

    if (orderFollowup.handled) {
      return {
        ok: true,
        companyId: company.id,
        ticketId: ticket.id,
        customerId: customer.id,
        messageLogId: messageLog.id,
        orderFollowup,
        n8n: { sent: false, reason: "handled_order_followup" }
      };
    }

    const shouldDispatch =
      automationAllowed && Boolean(company.n8nWebhookUrl);

    const dispatch = shouldDispatch
      ? await this.dispatchToN8n(company.n8nWebhookUrl!, {
          event: "message.received",
          company: {
            id: company.id,
            name: company.name,
            segment: company.segment
          },
          ticket,
          customer,
          message: {
            id: messageLog.id,
            ticketzMessageId: messageLog.ticketzMessageId,
            direction: messageLog.direction,
            senderType: messageLog.senderType,
            type: messageLog.messageType,
            content: messageLog.content,
            metadata: normalized.message.metadata
          },
          raw: body
        }, messageLog.id)
      : { sent: false, reason: company.n8nWebhookUrl ? "bot_disabled_or_handoff" : "n8n_webhook_not_configured" };

    return {
      ok: true,
      companyId: company.id,
      ticketId: ticket.id,
      customerId: customer.id,
      messageLogId: messageLog.id,
      n8n: dispatch
    };
  }

  async listTickets(user: AuthUser, companyId?: string, status = "active") {
    const scopedCompanyId =
      user.role === UserRole.super_admin ? companyId : user.companyId || undefined;

    if (!scopedCompanyId) {
      throw new BadRequestException("companyId obrigatorio.");
    }

    await this.app.assertModuleEnabled("tickets", scopedCompanyId);

    const statusFilter = String(status || "active").toLowerCase();
    const where: AnyRecord = { companyId: scopedCompanyId };
    if (statusFilter === "closed") {
      where.status = "closed";
    } else if (statusFilter !== "all") {
      where.OR = [{ status: null }, { status: { not: "closed" } }];
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      include: {
        logs: { orderBy: { createdAt: "desc" }, take: 1 },
        whatsappConnection: true
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100
    });

    const customerIds = tickets.map(ticket => ticket.customerId).filter(Boolean) as string[];
    const customers = customerIds.length
      ? await this.prisma.customer.findMany({ where: { id: { in: customerIds } } })
      : [];
    const customerById = new Map(customers.map(customer => [customer.id, customer]));

    return tickets.map(ticket => ({
      ...ticket,
      customer: ticket.customerId ? customerById.get(ticket.customerId) || null : null
    }));
  }

  async listMessages(ticketId: string, user: AuthUser) {
    const ticket = await this.findTicketForUser(ticketId, user);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { unreadMessages: 0 }
    });
    return this.prisma.messageLog.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
      take: 500
    });
  }

  async searchTicketzTickets(user: AuthUser, companyId: string | undefined, q = "", status = "all") {
    const company = await this.findCompanyForUser(user, companyId);
    await this.app.assertModuleEnabled("tickets", company.id);
    const nativeConnection = await this.prisma.whatsappConnection.findFirst({
      where: { companyId: company.id, provider: "native" }
    });
    if (nativeConnection) {
      const tickets = await this.prisma.ticket.findMany({
        where: {
          companyId: company.id,
          ...(status === "closed" ? { status: "closed" } : status === "all" ? {} : { status: { not: "closed" } })
        },
        orderBy: { lastMessageAt: "desc" },
        take: 100
      });
      const customerIds = tickets.map(ticket => ticket.customerId).filter(Boolean) as string[];
      const customers = await this.prisma.customer.findMany({ where: { id: { in: customerIds } } });
      const customerById = new Map(customers.map(customer => [customer.id, customer]));
      const needle = String(q || "").trim().toLowerCase();
      return tickets
        .map(ticket => ({ ...ticket, contact: ticket.customerId ? customerById.get(ticket.customerId) : null }))
        .filter(ticket => !needle || JSON.stringify(ticket).toLowerCase().includes(needle));
    }
    const data = await this.callTicketzIntegration(company, {
      action: "search_tickets",
      q,
      status: status || "all"
    });
    return data.tickets || [];
  }

  async syncTicketzTicket(body: AnyRecord, user: AuthUser) {
    const company = await this.findCompanyForUser(user, String(body.companyId || ""));
    await this.app.assertModuleEnabled("tickets", company.id);
    const ticketzTicketId = String(body.ticketzTicketId || body.ticketId || "");
    if (!ticketzTicketId) throw new BadRequestException("ticketzTicketId obrigatorio.");

    return this.syncTicketzTicketById(company, ticketzTicketId, Number(body.limit || 80), { unreadMessages: 0 });
  }

  async handoff(ticketId: string, user: AuthUser, enabled = true) {
    const ticket = await this.findTicketForUser(ticketId, user);
    const ticketz = await this.syncTicketzBotState(ticket, !enabled);
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        humanTakeover: enabled,
        botEnabled: !enabled
      }
    });
    return { ...updatedTicket, ticketz };
  }

  async setBot(ticketId: string, user: AuthUser, enabled: boolean) {
    const ticket = await this.findTicketForUser(ticketId, user);
    const ticketz = await this.syncTicketzBotState(ticket, enabled);
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        botEnabled: enabled,
        humanTakeover: enabled ? false : ticket.humanTakeover
      }
    });
    return { ...updatedTicket, ticketz };
  }

  async closeTicket(ticketId: string, user: AuthUser) {
    const ticket = await this.findTicketForUser(ticketId, user);
    const company = await this.prisma.company.findUnique({ where: { id: ticket.companyId } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

    const nativeConnection = ticket.whatsappConnectionId
      ? await this.prisma.whatsappConnection.findUnique({ where: { id: ticket.whatsappConnectionId } })
      : null;
    const ticketz = ticket.ticketzTicketId && nativeConnection?.provider !== "native"
      ? await this.callTicketzIntegration(
          company,
          {
            action: "close",
            ticketId: ticket.ticketzTicketId
          },
          ticket.ticketzTicketId
        )
      : { synced: false, reason: "ticket_without_ticketz_id" };

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "closed",
        unreadMessages: 0,
        humanTakeover: false,
        botEnabled: true
      }
    });

    return { ...updatedTicket, ticketz };
  }

  async sendOutbound(body: AnyRecord, user: AuthUser) {
    let ticket = await this.findTicketForUser(String(body.ticketId), user);
    const content = String(body.content || body.message || body.caption || "");
    const mediaUrl = String(body.mediaUrl || body.media_url || "");
    const fileName = String(body.fileName || body.originalFileName || body.filename || "");
    const mimeType = String(body.mimeType || body.mimetype || body.contentType || "");
    const messageType = this.toMessageType(
      String(body.messageType || body.type || this.messageTypeFromMime(mimeType) || "text")
    );

    if (!content && !mediaUrl) {
      throw new BadRequestException("content ou mediaUrl obrigatorio.");
    }

    const company = await this.prisma.company.findUnique({ where: { id: ticket.companyId } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");
    const customer = ticket.customerId
      ? await this.prisma.customer.findUnique({ where: { id: ticket.customerId } })
      : null;
    let targetCustomer = customer;
    const connection = ticket.whatsappConnectionId
      ? await this.prisma.whatsappConnection.findUnique({ where: { id: ticket.whatsappConnectionId } })
      : await this.prisma.whatsappConnection.findFirst({ where: { companyId: ticket.companyId, isDefault: true } });
    let ticketz: AnyRecord;
    if (connection?.provider === "native") {
      ticketz = await this.nativeWhatsapp.send(
        connection.id,
        String(targetCustomer?.whatsapp || targetCustomer?.phone || ""),
        { content, mediaUrl, fileName, mimeType }
      );
    } else try {
      ticketz = await this.sendToTicketz(company, ticket, targetCustomer, {
        content,
        mediaUrl,
        fileName,
        mimeType,
        messageType
      });
    } catch (err) {
      if (!this.isOtherOpenTicketError(err)) throw err;
      ticket = await this.resolveOtherOpenTicket(company, ticket, targetCustomer);
      targetCustomer = ticket.customerId
        ? await this.prisma.customer.findUnique({ where: { id: ticket.customerId } })
        : targetCustomer;
      ticketz = await this.sendToTicketz(company, ticket, targetCustomer, {
        content,
        mediaUrl,
        fileName,
        mimeType,
        messageType
      });
    }

    const messageLog = await this.prisma.messageLog.create({
      data: {
        companyId: ticket.companyId,
        ticketId: ticket.id,
        direction: "outbound",
        senderType: body.senderType || "attendant",
        messageType,
        content: content || fileName || mediaUrl,
        ticketzMessageId: ticketz.messageId || undefined,
        metadata: {
          ...body,
          source: "vib_native_whatsapp",
          media: mediaUrl
            ? {
                url: mediaUrl,
                fileName,
                mimeType
              }
            : undefined,
          ticketz
        }
      }
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lastMessage: content || fileName || "Arquivo enviado",
        lastMessageAt: new Date()
      }
    });

    return {
      ok: true,
      ticket,
      messageLog,
      ticketz
    };
  }

  private cleanTicketzBaseUrl(value?: string | null) {
    return String(value || "")
      .trim()
      .replace(/\/backend\/?$/, "")
      .replace(/\/$/, "");
  }

  private cleanPhone(value: unknown) {
    return String(value || "").replace(/\D/g, "");
  }

  private humanContactName(value: unknown) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (["cliente whatsapp", "cliente", "sem nome"].includes(text.toLowerCase())) return "";

    const letters = text.replace(/[^A-Za-z\u00C0-\u00FF]/g, "");
    if (letters.length >= 2) return text;

    const digits = text.replace(/\D/g, "");
    if (digits.length >= 8) return "";

    return text;
  }

  private firstHumanContactName(...values: unknown[]) {
    for (const value of values) {
      const name = this.humanContactName(value);
      if (name) return name;
    }
    return "";
  }

  private messageTypeFromMime(mimeType: string) {
    const normalized = String(mimeType || "").toLowerCase();
    if (normalized.startsWith("image/")) return "image";
    if (normalized.startsWith("audio/")) return "audio";
    if (normalized.startsWith("video/") || normalized) return "document";
    return "text";
  }

  private async sendToTicketz(
    company: AnyRecord,
    ticket: AnyRecord,
    customer: AnyRecord | null,
    message: {
      content: string;
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      messageType?: string;
    }
  ) {
    const baseUrl = this.cleanTicketzBaseUrl(company.ticketzBaseUrl || process.env.TICKETZ_BASE_URL);
    const token = String(company.ticketzApiToken || process.env.TICKETZ_API_TOKEN || "").trim();
    if (!baseUrl) throw new BadRequestException("URL do Ticketz nao configurada para esta empresa.");
    if (!token) throw new BadRequestException("Token da API do Ticketz nao configurado para esta empresa.");

    const hasTicketzTicket = Boolean(ticket.ticketzTicketId);
    const phone = this.cleanPhone(customer?.whatsapp || customer?.phone || ticket.metadata?.contact?.number || ticket.metadata?.contact?.phone);
    const payload = message.mediaUrl
      ? {
          action: "media",
          ticketId: ticket.ticketzTicketId,
          content: message.content,
          mediaUrl: message.mediaUrl,
          fileName: message.fileName,
          mimeType: message.mimeType,
          messageType: message.messageType,
          message
        }
      : hasTicketzTicket
      ? {
          action: "message",
          ticketId: ticket.ticketzTicketId,
          content: message.content,
          message: { content: message.content }
        }
      : {
          action: "message_to_number",
          number: phone,
          queueId: company.ticketzQueueId || ticket.queueId || undefined,
          content: message.content,
          message: { content: message.content }
        };

    if (message.mediaUrl && !hasTicketzTicket) {
      throw new BadRequestException("Envio de arquivo exige ticket do Ticketz sincronizado.");
    }

    if (!hasTicketzTicket && !phone) {
      throw new BadRequestException("Ticket sem ID do Ticketz e sem telefone do cliente para envio.");
    }

    const response = await fetch(`${baseUrl}/backend/integrations/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}${hasTicketzTicket ? `:${ticket.ticketzTicketId}` : ""}`
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data: AnyRecord = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new BadRequestException(data?.message || data?.error || data?.raw || `Ticketz retornou ${response.status}.`);
    }

    return {
      sent: true,
      mode: hasTicketzTicket ? "ticket" : "number",
      status: response.status,
      ticketzTicketId: ticket.ticketzTicketId || null,
      messageId: data.messageId || data.id || null,
      response: data
    };
  }

  private ticketzErrorMessage(error: unknown) {
    const response = (error as AnyRecord)?.response;
    if (typeof response === "string") return response;
    if (response?.message) return String(response.message);
    if ((error as Error)?.message) return String((error as Error).message);
    return "";
  }

  private isOtherOpenTicketError(error: unknown) {
    return this.ticketzErrorMessage(error).includes("ERR_OTHER_OPEN_TICKET");
  }

  private async syncTicketzTicketById(company: AnyRecord, ticketzTicketId: string, limit = 80, updates: AnyRecord = {}) {
    const snapshot = await this.callTicketzIntegration(
      company,
      {
        action: "ticket_snapshot",
        ticketId: ticketzTicketId,
        limit
      },
      ticketzTicketId
    );

    const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
    for (const message of messages) {
      await this.receiveMessage(
        {
          event: "ticketz.snapshot",
          skip_n8n: true,
          skip_order_followup: true,
          ticketz_company_id: company.ticketzCompanyId,
          ticketz_ticket_id: snapshot.ticket?.id || ticketzTicketId,
          ticketz_contact_id: snapshot.contact?.id,
          ticketz_whatsapp_id: snapshot.ticket?.whatsappId || company.ticketzWhatsappId,
          ticket: snapshot.ticket,
          contact: snapshot.contact,
          message
        },
        company.webhookSecret || process.env.WEBHOOK_SECRET
      );
    }

    let localTicket = await this.prisma.ticket.findFirst({
      where: {
        companyId: company.id,
        ticketzTicketId
      }
    });

    if (!localTicket && snapshot.ticket) {
      const normalized = this.normalizePayload({
        event: "ticketz.snapshot",
        ticketz_company_id: company.ticketzCompanyId,
        ticketz_ticket_id: snapshot.ticket?.id || ticketzTicketId,
        ticketz_contact_id: snapshot.contact?.id,
        ticketz_whatsapp_id: snapshot.ticket?.whatsappId || company.ticketzWhatsappId,
        ticket: snapshot.ticket,
        contact: snapshot.contact,
        message: {
          id: "",
          fromMe: true,
          content: snapshot.ticket?.lastMessage || snapshot.ticket?.lastMessageAt || ""
        }
      });
      const customer = await this.upsertCustomer(company.id, normalized.contact);
      const connection = await this.resolveConnection(company.id, normalized);
      localTicket = await this.upsertTicket(company.id, customer.id, normalized, connection?.id);
    }

    if (!localTicket) {
      throw new NotFoundException("Nenhuma mensagem encontrada para sincronizar este ticket.");
    }

    return this.prisma.ticket.update({
      where: { id: localTicket.id },
      data: updates,
      include: {
        logs: { orderBy: { createdAt: "desc" }, take: 1 },
        whatsappConnection: true
      }
    });
  }

  private async resolveOtherOpenTicket(company: AnyRecord, ticket: AnyRecord, customer: AnyRecord | null) {
    const phone = this.cleanPhone(customer?.whatsapp || customer?.phone || ticket.metadata?.contact?.number || ticket.metadata?.contact?.phone);
    if (!phone) {
      throw new BadRequestException("Existe outro atendimento aberto no Ticketz, mas nao consegui identificar o telefone para sincronizar.");
    }

    for (const status of ["pending", "open"]) {
      const data = await this.callTicketzIntegration(company, {
        action: "search_tickets",
        q: phone,
        status
      });
      const remoteTicket = (data.tickets || []).find((item: AnyRecord) => String(item.id) !== String(ticket.ticketzTicketId));
      if (remoteTicket?.id) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "closed",
            unreadMessages: 0,
            humanTakeover: false,
            botEnabled: true
          }
        });
        return this.syncTicketzTicketById(company, String(remoteTicket.id), 80, { unreadMessages: 0 });
      }
    }

    throw new BadRequestException("O Ticketz informou que existe outro atendimento aberto, mas nao retornou esse ticket na busca. Use Historico/Buscar Ticketz para sincronizar manualmente.");
  }

  private async findCompanyForUser(user: AuthUser, companyId?: string) {
    const scopedCompanyId =
      user.role === UserRole.super_admin ? companyId : user.companyId || undefined;

    if (!scopedCompanyId) {
      throw new BadRequestException("companyId obrigatorio.");
    }

    const company = await this.prisma.company.findUnique({ where: { id: scopedCompanyId } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");
    return company;
  }

  private async callTicketzIntegration(company: AnyRecord, payload: AnyRecord, ticketzTicketId?: string) {
    const baseUrl = this.cleanTicketzBaseUrl(company.ticketzBaseUrl || process.env.TICKETZ_BASE_URL);
    const token = String(company.ticketzApiToken || process.env.TICKETZ_API_TOKEN || "").trim();
    if (!baseUrl) throw new BadRequestException("URL do Ticketz nao configurada para esta empresa.");
    if (!token) throw new BadRequestException("Token da API do Ticketz nao configurado para esta empresa.");

    const response = await fetch(`${baseUrl}/backend/integrations/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}${ticketzTicketId ? `:${ticketzTicketId}` : ""}`
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data: AnyRecord = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new BadRequestException(data?.message || data?.error || data?.raw || `Ticketz retornou ${response.status}.`);
    }

    return data;
  }

  private async syncTicketzBotState(ticket: AnyRecord, enabled: boolean) {
    if (ticket.whatsappConnectionId) {
      const connection = await this.prisma.whatsappConnection.findUnique({
        where: { id: ticket.whatsappConnectionId }
      });
      if (connection?.provider === "native") {
        return { synced: true, provider: "native", enabled };
      }
    }
    if (!ticket.ticketzTicketId) {
      return { synced: false, reason: "ticket_without_ticketz_id" };
    }

    const company = await this.prisma.company.findUnique({ where: { id: ticket.companyId } });
    if (!company) {
      throw new NotFoundException("Empresa nao encontrada.");
    }

    return this.callTicketzIntegration(
      company,
      {
        action: "set_bot",
        ticketId: ticket.ticketzTicketId,
        enabled
      },
      ticket.ticketzTicketId
    );
  }

  private async resolveCompany(body: AnyRecord) {
    const companyId = body.company_id || body.companyId || body.company?.id;
    if (companyId) {
      return this.prisma.company.findUnique({ where: { id: String(companyId) } });
    }

    const ticketzCompanyId =
      body.ticketz_company_id || body.ticketzCompanyId || body.company?.ticketz_company_id;
    if (ticketzCompanyId) {
      return this.prisma.company.findFirst({
        where: { ticketzCompanyId: String(ticketzCompanyId) }
      });
    }

    const ticketzWhatsappId =
      body.ticketz_whatsapp_id ||
      body.ticketzWhatsappId ||
      body.whatsappId ||
      body.ticket?.whatsappId;
    if (ticketzWhatsappId) {
      return this.prisma.company.findFirst({
        where: { ticketzWhatsappId: String(ticketzWhatsappId) }
      });
    }

    return null;
  }

  private normalizePayload(body: AnyRecord) {
    const ticket = body.ticket || {};
    const contact = body.contact || ticket.contact || {};
    const message = body.message || body.data?.message || body;
    const contactName = this.firstHumanContactName(
      contact.pushName,
      contact.pushname,
      contact.profileName,
      contact.notify,
      contact.verifiedName,
      contact.name,
      body.customer_name,
      body.customerName
    );
    const fromMe = Boolean(message.fromMe ?? body.fromMe ?? false);
    const direction: MessageDirection = fromMe ? "outbound" : "inbound";
    const messageType = this.toMessageType(
      message.type || message.messageType || body.message_type || body.type || "text"
    );
    const content =
      message.content ||
      message.body ||
      message.text ||
      message.caption ||
      message.address ||
      body.content ||
      "";

    return {
      event: body.event || body.type || "message",
      ticket: {
        id: String(
          body.ticketz_ticket_id ||
            body.ticketzTicketId ||
            ticket.id ||
            ticket.ticketz_ticket_id ||
            ""
        ),
        status: body.status || ticket.status || "open",
        channel: body.channel || ticket.channel || "whatsapp",
        queueId: body.queueId || body.ticketz_queue_id || ticket.queueId,
        assignedUserId: body.userId || ticket.userId,
        metadata: ticket
      },
      contact: {
        id: String(body.ticketz_contact_id || body.ticketzContactId || contact.id || ""),
        name: contactName || "Cliente WhatsApp",
        phone: contact.phone || contact.number || body.customer_phone || body.customerPhone,
        email: contact.email,
        profilePicUrl:
          contact.profilePicUrl ||
          contact.profile_pic_url ||
          contact.avatarUrl ||
          contact.photoUrl ||
          body.customer_profile_pic_url ||
          body.customerProfilePicUrl
      },
      message: {
        id: String(body.ticketz_message_id || body.ticketzMessageId || message.id || ""),
        type: messageType,
        content,
        latitude: message.latitude || message.lat || body.latitude,
        longitude: message.longitude || message.lng || body.longitude,
        address: message.address || body.address,
        reference: message.reference || body.reference,
        metadata: message
      },
      direction,
      senderType: (fromMe ? "attendant" : "customer") as SenderType,
      whatsappId: body.ticketz_whatsapp_id || body.ticketzWhatsappId || ticket.whatsappId
    };
  }

  private toMessageType(value: string): MessageType {
    const normalized = String(value).toLowerCase();
    if (["image", "audio", "location", "document"].includes(normalized)) {
      return normalized as MessageType;
    }
    return "text";
  }

  private async upsertCustomer(companyId: string, contact: AnyRecord) {
    const contactName = this.humanContactName(contact.name);
    const existing = contact.phone
      ? await this.prisma.customer.findFirst({
          where: {
            companyId,
            OR: [{ phone: String(contact.phone) }, { whatsapp: String(contact.phone) }]
          }
        })
      : null;

    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: contactName || existing.name,
          phone: contact.phone || existing.phone,
          whatsapp: contact.phone || existing.whatsapp,
          email: contact.email || existing.email,
          profilePicUrl: contact.profilePicUrl || existing.profilePicUrl
        }
      });
    }

    return this.prisma.customer.create({
      data: {
        companyId,
        name: contactName || "Cliente WhatsApp",
        phone: contact.phone,
        whatsapp: contact.phone,
        email: contact.email,
        profilePicUrl: contact.profilePicUrl
      }
    });
  }

  private async resolveConnection(companyId: string, normalized: AnyRecord) {
    if (!normalized.whatsappId) {
      return this.prisma.whatsappConnection.findFirst({
        where: { companyId, isDefault: true }
      });
    }

    return (
      (await this.prisma.whatsappConnection.findFirst({
        where: {
          companyId,
          OR: [{ id: String(normalized.whatsappId) }, { token: String(normalized.whatsappId) }]
        }
      })) ||
      (await this.prisma.whatsappConnection.findFirst({
        where: { companyId, isDefault: true }
      }))
    );
  }

  private async upsertTicket(
    companyId: string,
    customerId: string,
    normalized: AnyRecord,
    whatsappConnectionId?: string
  ) {
    const existing = normalized.ticket.id
      ? await this.prisma.ticket.findFirst({
          where: {
            companyId,
            ticketzTicketId: normalized.ticket.id
          }
        })
      : null;

    const lastMessage = normalized.message.content || "";
    const data = {
      ticketzTicketId: normalized.ticket.id || undefined,
      ticketzContactId: normalized.contact.id || undefined,
      whatsappConnectionId,
      customerId,
      status: normalized.ticket.status,
      channel: normalized.ticket.channel,
      queueId: normalized.ticket.queueId ? String(normalized.ticket.queueId) : undefined,
      assignedUserId: normalized.ticket.assignedUserId
        ? String(normalized.ticket.assignedUserId)
        : undefined,
      lastMessage,
      lastMessageAt: new Date(),
      metadata: normalized.ticket.metadata
    };

    if (existing) {
      return this.prisma.ticket.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(normalized.direction === "inbound"
            ? { unreadMessages: { increment: 1 } }
            : {})
        }
      });
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    return this.prisma.ticket.create({
      data: {
        companyId,
        ...data,
        botEnabled: company?.botEnabled ?? true,
        humanTakeover: false,
        unreadMessages: normalized.direction === "inbound" ? 1 : 0
      }
    });
  }

  private async saveLocation(companyId: string, customerId: string, message: AnyRecord) {
    await this.prisma.customerAddress.create({
      data: {
        companyId,
        customerId,
        label: "WhatsApp",
        street: message.address,
        reference: message.reference,
        latitude: message.latitude,
        longitude: message.longitude,
        isDefault: true
      }
    });
  }

  private async dispatchToN8n(url: string, payload: AnyRecord, messageLogId: string) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`n8n ${response.status}: ${text.slice(0, 500)}`);
      }

      await this.prisma.messageLog.update({
        where: { id: messageLogId },
        data: {
          sentToN8nAt: new Date(),
          n8nErrorMessage: null
        }
      });

      let responseBody: AnyRecord | AnyRecord[] | null = null;
      try {
        responseBody = text ? JSON.parse(text) : null;
      } catch {
        responseBody = text ? { text } : null;
      }
      return { sent: true, status: response.status, response: responseBody };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      await this.prisma.messageLog.update({
        where: { id: messageLogId },
        data: { n8nErrorMessage: message }
      });
      return { sent: false, error: message };
    }
  }

  private async findTicketForUser(ticketId: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(user.role === UserRole.super_admin ? {} : { companyId: user.companyId || "" })
      }
    });

    if (!ticket) {
      throw new NotFoundException("Ticket nao encontrado.");
    }

    await this.app.assertModuleEnabled("tickets", ticket.companyId);
    return ticket;
  }
}
