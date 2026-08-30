import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { OrderStatus, OrderType, Origin, PrintJobStatus } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { ChatService } from "./chat.service";
import { PrismaService } from "./prisma.service";

type AnyRecord = Record<string, any>;

function cleanPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function money(value: unknown) {
  return Number(value || 0);
}

function deliveryFeeOrDefault(value: unknown, companyDefault: unknown) {
  const requestedFee = money(value);
  if (requestedFee > 0) return requestedFee;

  const configuredFee = money(companyDefault);
  if (configuredFee > 0) return configuredFee;

  return 4;
}

@Controller("api")
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService,
    private readonly chat: ChatService
  ) {}

  @Post("webhooks/ticketz")
  async ticketzWebhook(
    @Headers("x-webhook-secret") secret: string,
    @Body() body: Record<string, any>
  ) {
    return this.chat.receiveMessage(body, secret);
  }

  @UseGuards(AuthGuard)
  @Post("tickets/:id/handoff")
  handoff(@Param("id") id: string) {
    return this.prisma.ticket.update({
      where: { id },
      data: { humanTakeover: true, botEnabled: false }
    });
  }

  @UseGuards(AuthGuard)
  @Post("ticketz/send-message")
  sendTicketzMessage(@Body() body: Record<string, any>) {
    return {
      ok: true,
      queued: true,
      note: "MVP: integrar chamada real ao Ticketz usando ticketz_base_url e ticketz_api_token.",
      payload: body
    };
  }

  @Post("n8n/events")
  n8nEvents(@Body() body: Record<string, any>) {
    return {
      ok: true,
      received: body,
      time: new Date().toISOString()
    };
  }

  @Get("integrations/restaurants/:companyId/context")
  async restaurantContext(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const context = await this.app.context(company.id);
    const prompt = await this.app.aiPrompt(company.id);

    return {
      company: this.publicCompany(company),
      prompt: prompt.prompt,
      context
    };
  }

  @Get("integrations/restaurants/:companyId/menu")
  async restaurantMenu(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const categories = await this.prisma.menuCategory.findMany({
      where: { companyId: company.id, active: true },
      include: {
        products: {
          where: { active: true, available: true },
          include: {
            addonGroups: {
              where: { active: true },
              include: {
                addons: {
                  where: { active: true },
                  orderBy: { sortOrder: "asc" }
                }
              },
              orderBy: { sortOrder: "asc" }
            }
          },
          orderBy: { sortOrder: "asc" }
        }
      },
      orderBy: { sortOrder: "asc" }
    });

    return {
      company: this.publicCompany(company),
      categories
    };
  }

  @Get("integrations/restaurants/:companyId/orders")
  async restaurantOrders(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Query("status") status: string | undefined,
    @Query("ticketzTicketId") ticketzTicketId: string | undefined,
    @Query("limit") limit: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const where: AnyRecord = { companyId: company.id };

    if (status) {
      where.status = this.normalizeOrderStatus(status);
    }

    if (ticketzTicketId) {
      where.ticketzTicketId = String(ticketzTicketId);
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { addons: true } },
        deliveryAddress: true,
        printJobs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { printer: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(Number(limit || 10), 1), 50)
    });
  }

  @Get("integrations/restaurants/:companyId/orders/:orderId")
  async restaurantOrder(
    @Param("companyId") companyId: string,
    @Param("orderId") orderId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId: company.id },
      include: {
        items: { include: { addons: true } },
        deliveryAddress: true,
        deliveries: true,
        printJobs: { include: { printer: true }, orderBy: { createdAt: "desc" } }
      }
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    return order;
  }

  @Post("integrations/restaurants/:companyId/orders")
  async createRestaurantOrder(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Body() body: AnyRecord
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);

    if (company.settings && !company.settings.acceptOrders) {
      throw new BadRequestException("A loja esta fechada para pedidos.");
    }

    const orderType = this.normalizeOrderType(body.orderType);
    if (orderType === OrderType.delivery && company.settings?.allowDelivery === false) {
      throw new BadRequestException("Delivery indisponivel no momento.");
    }
    if (orderType === OrderType.pickup && company.settings?.allowPickup === false) {
      throw new BadRequestException("Retirada indisponivel no momento.");
    }

    const tableNumber = String(body.table?.number || body.tableNumber || "").trim();
    const waiterName = String(body.table?.waiterName || body.waiterName || "").trim();
    const tableCustomerName = String(body.table?.customerName || "").trim();
    if (orderType === OrderType.table && !tableNumber) {
      throw new BadRequestException("Numero da mesa obrigatorio.");
    }

    const customerName =
      String(body.customer?.name || body.customerName || "").trim() ||
      tableCustomerName ||
      (orderType === OrderType.table ? `Mesa ${tableNumber}` : "");
    const customerPhone = cleanPhone(body.customer?.phone || body.customerPhone);
    if (orderType !== OrderType.table && (!customerName || !customerPhone)) {
      throw new BadRequestException("Nome e telefone sao obrigatorios.");
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new BadRequestException("Adicione pelo menos um item ao pedido.");
    }

    const customer = customerPhone
      ? await this.upsertCustomer(company.id, customerName, customerPhone)
      : null;
    const address =
      orderType === OrderType.delivery && customer
        ? await this.createAddress(company.id, customer.id, body.address)
        : null;
    const orderItems = await this.prepareItems(company.id, items);
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const deliveryFee =
      orderType === OrderType.delivery
        ? deliveryFeeOrDefault(body.deliveryFee, company.settings?.deliveryFeeDefault)
        : 0;
    const discount = money(body.discount);
    const total = money(subtotal + deliveryFee - discount);

    const order = await this.prisma.order.create({
      data: {
        companyId: company.id,
        customerId: customer?.id,
        customerName,
        customerPhone: customerPhone || undefined,
        status: OrderStatus.waiting_confirmation,
        orderType,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : undefined,
        deliveryAddressId: address?.id,
        notes: this.composeOrderNotes(body.notes, orderType, tableNumber, waiterName) || undefined,
        origin: Origin.n8n,
        ticketzTicketId: body.ticketzTicketId ? String(body.ticketzTicketId) : undefined,
        items: {
          create: orderItems.map(item => ({
            companyId: company.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes,
            addons: {
              create: item.addons.map(addon => ({
                companyId: company.id,
                addonId: addon.addonId,
                addonName: addon.addonName,
                price: addon.price
              }))
            }
          }))
        }
      },
      include: {
        items: { include: { addons: true } },
        deliveryAddress: true
      }
    });

    const accepted = await this.app.confirmOrder(order.id, company.id);
    await this.auditIntegration(company.id, "integration.order_auto_confirmed", "order", order.id, {
      source: "n8n"
    });

    return {
      ok: true,
      order: accepted.order,
      printJobs: accepted.printJobs,
      notification: accepted.notification,
      message: "Pedido recebido pelo WhatsApp e aceito automaticamente."
    };
  }

  @Post("integrations/restaurants/:companyId/orders/:orderId/confirm")
  async confirmRestaurantOrder(
    @Param("companyId") companyId: string,
    @Param("orderId") orderId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const result = await this.app.confirmOrder(orderId, company.id);
    await this.auditIntegration(company.id, "integration.order_confirmed", "order", orderId, {
      source: "n8n"
    });
    return { ok: true, ...result };
  }

  @Post("integrations/restaurants/:companyId/orders/:orderId/reprint")
  async reprintRestaurantOrder(
    @Param("companyId") companyId: string,
    @Param("orderId") orderId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const printJobs = await this.app.createPrintJobsForOrder(orderId, company.id);
    await this.auditIntegration(company.id, "integration.order_reprint_requested", "order", orderId, {
      source: "n8n",
      printJobIds: printJobs.map(job => job.id)
    });
    return { ok: true, printJobs };
  }

  @Post("integrations/restaurants/:companyId/orders/:orderId/status")
  async updateRestaurantOrderStatus(
    @Param("companyId") companyId: string,
    @Param("orderId") orderId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Body() body: AnyRecord
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const status = this.normalizeOrderStatus(body.status);
    const result = await this.app.updateOrderStatus(orderId, company.id, status);

    await this.auditIntegration(company.id, "integration.order_status_updated", "order", orderId, {
      source: "n8n",
      status
    });

    return { ok: true, ...result };
  }

  @Post("integrations/restaurants/:companyId/notes")
  async addRestaurantInternalNote(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Body() body: AnyRecord
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const note = String(body.note || body.text || "").trim();
    if (!note) {
      throw new BadRequestException("note obrigatorio.");
    }

    const entity = String(body.entity || "ticket").trim();
    const entityId = body.entityId ? String(body.entityId) : undefined;
    const auditLog = await this.auditIntegration(company.id, "integration.internal_note", entity, entityId, {
      source: "n8n",
      note,
      ticketzTicketId: body.ticketzTicketId ? String(body.ticketzTicketId) : undefined,
      customerName: body.customerName ? String(body.customerName) : undefined,
      customerPhone: body.customerPhone ? cleanPhone(body.customerPhone) : undefined
    });

    return { ok: true, note: auditLog };
  }

  @Get("integrations/restaurants/:companyId/printers")
  async restaurantPrinters(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    return this.prisma.printer.findMany({
      where: { companyId: company.id, active: true },
      orderBy: [{ defaultForKitchen: "desc" }, { defaultForDelivery: "desc" }, { name: "asc" }]
    });
  }

  @Get("integrations/restaurants/:companyId/print-jobs")
  async restaurantPrintJobs(
    @Param("companyId") companyId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Query("status") status: string | undefined,
    @Query("orderId") orderId: string | undefined
  ) {
    const company = await this.assertIntegrationCompany(companyId, secret);
    const where: AnyRecord = { companyId: company.id };
    if (status) {
      where.status = this.normalizePrintJobStatus(status);
    }
    if (orderId) {
      where.orderId = String(orderId);
    }

    return this.prisma.printJob.findMany({
      where,
      include: { printer: true, order: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  private async assertIntegrationCompany(companyId: string, secret?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true }
    });

    if (!company || !company.active) {
      throw new NotFoundException("Empresa nao encontrada.");
    }

    const expectedSecret = company.webhookSecret || process.env.WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      throw new ForbiddenException("Webhook secret invalido.");
    }

    return company;
  }

  private publicCompany(company: AnyRecord) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      publicId: company.publicId,
      customerPortalUrl: `https://saas.correacloud.com.br/cliente/${company.publicId || company.slug}`,
      phone: company.phone,
      whatsapp: company.whatsapp,
      segment: company.segment,
      acceptOrders: company.settings?.acceptOrders ?? true,
      allowDelivery: company.settings?.allowDelivery ?? true,
      allowPickup: company.settings?.allowPickup ?? true,
      deliveryFeeDefault: deliveryFeeOrDefault(undefined, company.settings?.deliveryFeeDefault),
      minimumOrderValue: money(company.settings?.minimumOrderValue),
      preparationTimeMinutes: company.settings?.preparationTimeMinutes ?? 30
    };
  }

  private normalizeOrderType(value: unknown): OrderType {
    if (value === OrderType.pickup) return OrderType.pickup;
    if (value === OrderType.table) return OrderType.table;
    return OrderType.delivery;
  }

  private normalizeOrderStatus(value: unknown): OrderStatus {
    const status = String(value || "").trim() as OrderStatus;
    if (Object.values(OrderStatus).includes(status)) return status;
    throw new BadRequestException("Status de pedido invalido.");
  }

  private normalizePrintJobStatus(value: unknown): PrintJobStatus {
    const status = String(value || "").trim() as PrintJobStatus;
    if (Object.values(PrintJobStatus).includes(status)) return status;
    throw new BadRequestException("Status de impressao invalido.");
  }

  private auditIntegration(
    companyId: string,
    action: string,
    entity: string,
    entityId: string | undefined,
    data: AnyRecord
  ) {
    return this.prisma.auditLog.create({
      data: {
        companyId,
        action,
        entity,
        entityId,
        newData: data
      }
    });
  }

  private composeOrderNotes(
    rawNotes: unknown,
    orderType: OrderType,
    tableNumber: string,
    waiterName: string
  ) {
    const notes = String(rawNotes || "").trim();
    if (orderType !== OrderType.table) return notes;

    return [
      tableNumber ? `Mesa: ${tableNumber}` : "",
      waiterName ? `Garcom: ${waiterName}` : "",
      notes
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async upsertCustomer(companyId: string, name: string, phone: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { companyId, phone }
    });

    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: { name, whatsapp: phone }
      });
    }

    return this.prisma.customer.create({
      data: {
        companyId,
        name,
        phone,
        whatsapp: phone
      }
    });
  }

  private async createAddress(companyId: string, customerId: string, raw: AnyRecord | undefined) {
    const address = raw || {};
    const hasAddress = ["street", "number", "neighborhood", "reference"].some(key =>
      String(address[key] || "").trim()
    );

    if (!hasAddress) return null;

    await this.prisma.customerAddress.updateMany({
      where: { companyId, customerId, isDefault: true },
      data: { isDefault: false }
    });

    return this.prisma.customerAddress.create({
      data: {
        companyId,
        customerId,
        label: "WhatsApp",
        street: String(address.street || "").trim() || undefined,
        number: String(address.number || "").trim() || undefined,
        complement: String(address.complement || "").trim() || undefined,
        neighborhood: String(address.neighborhood || "").trim() || undefined,
        city: String(address.city || "").trim() || undefined,
        state: String(address.state || "").trim() || undefined,
        reference: String(address.reference || "").trim() || undefined,
        isDefault: true
      }
    });
  }

  private async prepareItems(companyId: string, items: AnyRecord[]) {
    const prepared = [];

    for (const rawItem of items) {
      const productId = String(rawItem.productId || "");
      const product = await this.prisma.product.findFirst({
        where: { id: productId, companyId, active: true, available: true },
        include: {
          addonGroups: {
            where: { active: true },
            include: { addons: { where: { active: true } } }
          }
        }
      });

      if (!product) {
        throw new BadRequestException("Produto indisponivel.");
      }

      const selectedIds = new Set((rawItem.addonIds || []).map((id: unknown) => String(id)));
      const selectedAddons = product.addonGroups.flatMap(group =>
        group.addons.filter(addon => selectedIds.has(addon.id))
      );

      if (selectedAddons.length !== selectedIds.size) {
        throw new BadRequestException(`Opcao invalida para ${product.name}.`);
      }

      for (const group of product.addonGroups) {
        const selectedInGroup = group.addons.filter(addon => selectedIds.has(addon.id));
        if (group.required && selectedInGroup.length < group.minChoices) {
          throw new BadRequestException(`Escolha pelo menos ${group.minChoices} opcao em ${group.name}.`);
        }
        if (selectedInGroup.length > group.maxChoices) {
          throw new BadRequestException(`Escolha no maximo ${group.maxChoices} opcoes em ${group.name}.`);
        }
      }

      const quantity = Math.max(1, Number(rawItem.quantity || 1));
      const basePrice = money(product.promotionalPrice ?? product.price);
      const flavorGroupIds = new Set(
        product.addonGroups
          .filter(group => group.name.toLowerCase().includes("sabor"))
          .map(group => group.id)
      );
      const flavorAddons = selectedAddons.filter(addon => flavorGroupIds.has(addon.addonGroupId));
      const extraAddons = selectedAddons.filter(addon => !flavorGroupIds.has(addon.addonGroupId));
      const flavorPrice = flavorAddons.length
        ? Math.max(...flavorAddons.map(addon => money(addon.price)), basePrice)
        : basePrice;
      const extrasTotal = extraAddons.reduce((sum, addon) => sum + money(addon.price), 0);
      const unitPrice = flavorPrice + extrasTotal;

      prepared.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        subtotal: quantity * unitPrice,
        notes: String(rawItem.notes || "").trim() || undefined,
        addons: selectedAddons.map(addon => ({
          addonId: addon.id,
          addonName: addon.name,
          price: money(addon.price)
        }))
      });
    }

    return prepared;
  }
}
