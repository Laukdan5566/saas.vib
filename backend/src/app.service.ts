import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  DeliveryStatus,
  OrderStatus,
  PrintJobStatus,
  PrintJobType,
  Prisma,
  UserRole
} from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "./prisma.service";
import { AuthUser } from "./types";

const resourceModels: Record<string, string> = {
  companies: "company",
  companyModules: "companyModule",
  users: "user",
  whatsappConnections: "whatsappConnection",
  companySettings: "companySettings",
  businessHours: "businessHours",
  specialBusinessHours: "specialBusinessHours",
  menuCategories: "menuCategory",
  products: "product",
  productAddonGroups: "productAddonGroup",
  productAddons: "productAddon",
  services: "service",
  professionals: "professional",
  professionalServices: "professionalService",
  professionalAvailability: "professionalAvailability",
  appointments: "appointment",
  customers: "customer",
  customerAddresses: "customerAddress",
  deliveryZones: "deliveryZone",
  deliveryPersons: "deliveryPerson",
  deliveries: "delivery",
  restaurantTables: "restaurantTable",
  orders: "order",
  orderItems: "orderItem",
  orderItemAddons: "orderItemAddon",
  paymentMethods: "paymentMethod",
  orderPayments: "orderPayment",
  coupons: "coupon",
  couponUsages: "couponUsage",
  faqs: "faq",
  knowledgeBase: "knowledgeBase",
  botSettings: "botSettings",
  tickets: "ticket",
  messageLogs: "messageLog",
  printers: "printer",
  printJobs: "printJob",
  auditLogs: "auditLog"
};

const companyScoped = new Set(
  Object.keys(resourceModels).filter(resource => resource !== "companies")
);

const resourceModules: Record<string, string> = {
  users: "users",
  menuCategories: "menu",
  products: "menu",
  productAddonGroups: "menu",
  productAddons: "menu",
  services: "services",
  professionals: "services",
  professionalServices: "services",
  professionalAvailability: "services",
  appointments: "appointments",
  customers: "customers",
  whatsappConnections: "connections",
  customerAddresses: "customers",
  deliveryZones: "deliveries",
  deliveryPersons: "deliveries",
  deliveries: "deliveries",
  restaurantTables: "orders",
  orders: "orders",
  orderItems: "orders",
  orderItemAddons: "orders",
  paymentMethods: "payments",
  orderPayments: "payments",
  coupons: "coupons",
  couponUsages: "coupons",
  faqs: "knowledge",
  knowledgeBase: "knowledge",
  botSettings: "bot",
  tickets: "chat",
  messageLogs: "chat",
  printers: "printing",
  printJobs: "printing",
  auditLogs: "audit"
};

type AnyRecord = Record<string, any>;

const DELIVERY_TIME_MESSAGE = "Tempo medio de entrega: 30 a 70 minutos.";

const vehicleTypeMap: Record<string, string> = {
  moto: "motorcycle",
  motorcycle: "motorcycle",
  bicicleta: "bicycle",
  bike: "bicycle",
  bicycle: "bicycle",
  carro: "car",
  car: "car",
  outro: "walking",
  "a pe": "walking",
  walking: "walking"
};

const userPublicSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  permissions: true,
  active: true,
  createdAt: true,
  updatedAt: true
};

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  modelName(resource: string) {
    const model = resourceModels[resource];
    if (!model) {
      throw new BadRequestException(`Recurso desconhecido: ${resource}`);
    }
    return model;
  }

  model(resource: string): AnyRecord {
    return (this.prisma as AnyRecord)[this.modelName(resource)];
  }

  tenantWhere(resource: string, user: AuthUser, where: AnyRecord = {}) {
    if (
      companyScoped.has(resource) &&
      user.role !== UserRole.super_admin &&
      user.companyId
    ) {
      return { ...where, companyId: user.companyId };
    }

    return where;
  }

  tenantData(resource: string, user: AuthUser, data: AnyRecord) {
    if (
      companyScoped.has(resource) &&
      user.role !== UserRole.super_admin &&
      user.companyId
    ) {
      return { ...data, companyId: user.companyId };
    }

    return data;
  }

  normalizeResourceData(resource: string, data: AnyRecord) {
    const normalized = { ...data };

    if (resource === "deliveryPersons" && normalized.vehicleType !== undefined) {
      const key = String(normalized.vehicleType || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      normalized.vehicleType = vehicleTypeMap[key] || "motorcycle";
    }

    return normalized;
  }

  private appointmentMinutes(value: unknown) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return Math.max(0, Number(hour || 0) * 60 + Number(minute || 0));
  }

  private sameAppointmentDay(value: Date, expected: string) {
    return value.toISOString().slice(0, 10) === expected;
  }

  private async assertAppointmentSlotFree(data: AnyRecord, user: AuthUser) {
    const companyId = String(data.companyId || user.companyId || "");
    const serviceId = String(data.serviceId || "");
    const professionalId = String(data.professionalId || "");
    const date = String(data.date || "").slice(0, 10);
    const time = String(data.time || "").slice(0, 5);

    if (!companyId || !serviceId || !professionalId || !date || !time) {
      throw new BadRequestException("Para agendar, informe empresa, servico, barbeiro, data e horario.");
    }

    const [service, professional, allowed] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: serviceId, companyId, active: true } }),
      this.prisma.professional.findFirst({ where: { id: professionalId, companyId, active: true } }),
      this.prisma.professionalService.findFirst({ where: { companyId, professionalId, serviceId } })
    ]);

    if (!service) throw new BadRequestException("Servico indisponivel.");
    if (!professional) throw new BadRequestException("Barbeiro indisponivel.");
    if (!allowed) throw new BadRequestException("Este barbeiro nao atende o servico escolhido.");

    const existing = await this.prisma.appointment.findMany({
      where: {
        companyId,
        professionalId,
        status: { in: ["requested", "confirmed"] }
      },
      include: { service: true }
    });
    const start = this.appointmentMinutes(time);
    const end = start + Number(service.durationMinutes || 20);
    const conflict = existing.some(item => {
      if (!this.sameAppointmentDay(item.date, date)) return false;
      const itemStart = this.appointmentMinutes(item.time);
      const itemEnd = itemStart + Number(item.service.durationMinutes || 20);
      return start < itemEnd && end > itemStart;
    });
    if (conflict) {
      throw new BadRequestException("Esse horario ja esta ocupado para este barbeiro.");
    }
  }

  async assertModuleEnabled(resource: string, companyId?: string | null) {
    const moduleKey = resourceModules[resource];
    if (!moduleKey || !companyId) return;

    const module = await this.prisma.companyModule.findUnique({
      where: {
        companyId_moduleKey: {
          companyId,
          moduleKey
        }
      }
    });

    if (module && !module.active) {
      throw new ForbiddenException(`Modulo desativado para esta empresa: ${module.name}`);
    }
  }

  operationCompanyId(resource: string, user: AuthUser, data?: AnyRecord) {
    if (!companyScoped.has(resource)) return null;
    if (user.role !== UserRole.super_admin) return String(user.companyId || "");
    return String(data?.companyId || user.companyId || "");
  }

  async list(resource: string, user: AuthUser, companyId?: string) {
    const scopedCompanyId =
      user.role === UserRole.super_admin && companyScoped.has(resource) && companyId
        ? companyId
        : this.operationCompanyId(resource, user);

    await this.assertModuleEnabled(resource, scopedCompanyId);

    if (resource === "companies") {
      const where = user.role === UserRole.super_admin ? {} : { id: user.companyId || "__none__" };
      return this.prisma.company.findMany({
        where,
        include: { settings: true, botSettings: true },
        take: 200
      });
    }

    if (resource === "users") {
      const where: AnyRecord = {};
      if (scopedCompanyId && user.role === UserRole.super_admin) {
        where.OR = [{ companyId: scopedCompanyId }, { role: UserRole.super_admin }];
      }
      if (user.role !== UserRole.super_admin) {
        where.role = { not: UserRole.super_admin };
      }

      return this.prisma.user.findMany({
        where: this.tenantWhere(
          resource,
          user,
          where
        ),
        select: userPublicSelect,
        take: 200
      });
    }

    if (resource === "orders") {
      const orders = await this.prisma.order.findMany({
        where: this.tenantWhere(
          resource,
          user,
          scopedCompanyId && user.role === UserRole.super_admin ? { companyId: scopedCompanyId } : {}
        ),
        orderBy: { createdAt: "desc" },
        take: 200
      });
      return this.withOrderDisplayNumbers(orders, scopedCompanyId || undefined);
    }

    return this.model(resource).findMany({
      where: this.tenantWhere(
        resource,
        user,
        scopedCompanyId && user.role === UserRole.super_admin ? { companyId: scopedCompanyId } : {}
      ),
      take: 200
    });
  }

  async orderFinancialSummary(companyId: string | undefined, user: AuthUser) {
    const scopedCompanyId = user.role === UserRole.super_admin ? String(companyId || "") : String(user.companyId || "");
    if (!scopedCompanyId) throw new BadRequestException("companyId obrigatorio.");
    if (user.role !== UserRole.super_admin && companyId && companyId !== user.companyId) {
      throw new ForbiddenException("Empresa fora do escopo do usuario.");
    }

    await this.assertModuleEnabled("orders", scopedCompanyId);
    const rows = await this.prisma.$queryRaw<Array<{
      month: string;
      completedOrders: number;
      revenue: Prisma.Decimal;
      averageTicket: Prisma.Decimal;
      canceledOrders: number;
      canceledTotal: Prisma.Decimal;
    }>>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS month,
        count(*) FILTER (WHERE status = ${OrderStatus.completed}::"OrderStatus")::int AS "completedOrders",
        coalesce(sum(total) FILTER (WHERE status = ${OrderStatus.completed}::"OrderStatus"), 0) AS revenue,
        coalesce(avg(total) FILTER (WHERE status = ${OrderStatus.completed}::"OrderStatus"), 0) AS "averageTicket",
        count(*) FILTER (WHERE status = ${OrderStatus.canceled}::"OrderStatus")::int AS "canceledOrders",
        coalesce(sum(total) FILTER (WHERE status = ${OrderStatus.canceled}::"OrderStatus"), 0) AS "canceledTotal"
      FROM orders
      WHERE company_id = ${scopedCompanyId}
        AND status IN (${OrderStatus.completed}::"OrderStatus", ${OrderStatus.canceled}::"OrderStatus")
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 24
    `);

    return rows.map(row => ({
      month: row.month,
      completedOrders: Number(row.completedOrders || 0),
      revenue: Number(row.revenue || 0),
      averageTicket: Number(row.averageTicket || 0),
      canceledOrders: Number(row.canceledOrders || 0),
      canceledTotal: Number(row.canceledTotal || 0)
    }));
  }

  async get(resource: string, id: string, user: AuthUser) {
    await this.assertModuleEnabled(resource, this.operationCompanyId(resource, user));
    if (resource === "companies") {
      const companyWhere =
        user.role === UserRole.super_admin
          ? { id }
          : { id: id === user.companyId ? id : "__none__" };
      const item = await this.prisma.company.findFirst({
        where: companyWhere,
        include: { settings: true, botSettings: true }
      });

      if (!item) {
        throw new NotFoundException("Registro nao encontrado.");
      }

      return item;
    }

    if (resource === "users") {
      const where: AnyRecord = { id };
      if (user.role !== UserRole.super_admin) {
        where.role = { not: UserRole.super_admin };
      }
      const item = await this.prisma.user.findFirst({
        where: this.tenantWhere(resource, user, where),
        select: userPublicSelect
      });

      if (!item) {
        throw new NotFoundException("Registro nao encontrado.");
      }

      return item;
    }

    const item = await this.model(resource).findFirst({
      where: this.tenantWhere(resource, user, { id })
    });

    if (!item) {
      throw new NotFoundException("Registro nao encontrado.");
    }

    if (resource === "orders") {
      return (await this.withOrderDisplayNumbers([item], String(item.companyId || "")))[0];
    }

    return item;
  }

  async create(resource: string, data: AnyRecord, user: AuthUser) {
    await this.assertModuleEnabled(resource, this.operationCompanyId(resource, user, data));
    data = this.normalizeResourceData(resource, data);
    if (resource === "companies" && user.role !== UserRole.super_admin) {
      throw new ForbiddenException("Apenas super admin pode criar empresas.");
    }
    if (resource === "users") {
      if (data.role === UserRole.super_admin && user.role !== UserRole.super_admin) {
        throw new ForbiddenException("Apenas super admin pode criar outro super admin.");
      }
      const password = String(data.password || "");
      if (password.length < 8) {
        throw new BadRequestException("Informe uma senha inicial com pelo menos 8 caracteres.");
      }
      delete data.password;
      data.passwordHash = await hash(String(password), 10);
    }
    if (resource === "appointments") {
      await this.assertAppointmentSlotFree(data, user);
    }
    const created = await this.model(resource).create({
      data: this.tenantData(resource, user, data)
    });
    if (resource === "users") delete created.passwordHash;
    return created;
  }

  async update(resource: string, id: string, data: AnyRecord, user: AuthUser) {
    await this.assertModuleEnabled(resource, this.operationCompanyId(resource, user, data));
    await this.get(resource, id, user);
    data = this.normalizeResourceData(resource, data);
    if (resource === "companies" && user.role !== UserRole.super_admin) {
      delete data.active;
    }
    if (resource === "users" && data.password) {
      if (data.role === UserRole.super_admin && user.role !== UserRole.super_admin) {
        throw new ForbiddenException("Apenas super admin pode definir perfil super admin.");
      }
      data.passwordHash = await hash(String(data.password), 10);
      delete data.password;
    }
    if (resource === "users" && data.role === UserRole.super_admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException("Apenas super admin pode definir perfil super admin.");
    }
    const updated = await this.model(resource).update({ where: { id }, data });
    if (resource === "companies") {
      return this.prisma.company.findUnique({ where: { id }, include: { settings: true, botSettings: true } });
    }
    if (resource === "users") delete updated.passwordHash;
    return updated;
  }

  async remove(resource: string, id: string, user: AuthUser) {
    await this.assertModuleEnabled(resource, this.operationCompanyId(resource, user));
    await this.get(resource, id, user);
    return this.model(resource).delete({ where: { id } });
  }

  async context(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        settings: true,
        modules: true,
        businessHours: true,
        specialBusinessHours: true,
        botSettings: true,
        paymentMethods: { where: { active: true } },
        menuCategories: {
          where: { active: true },
          include: {
            products: {
              where: { active: true, available: true },
              include: {
                addonGroups: {
                  where: { active: true },
                  include: { addons: { where: { active: true } } }
                }
              }
            }
          }
        },
        services: { where: { active: true } },
        professionals: { where: { active: true }, include: { availability: true } },
        deliveryZones: { where: { active: true } },
        faqs: { where: { active: true } },
        knowledgeBase: { where: { active: true } }
      }
    });

    if (!company) {
      throw new NotFoundException("Empresa nao encontrada.");
    }

    return company;
  }

  private dayName(dayOfWeek: unknown) {
    const days = ["domingo", "segunda-feira", "terca-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sabado"];
    return days[Number(dayOfWeek)] || `dia ${dayOfWeek}`;
  }

  private businessHoursSummary(hours: AnyRecord[]) {
    const normalHours = [...(hours || [])]
      .filter(hour => String(hour.type || "normal") === "normal")
      .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek));

    const openHours = normalHours.filter(hour => !hour.isClosed && hour.openTime && hour.closeTime);
    if (!openHours.length) return "Horario de atendimento nao cadastrado.";

    return openHours
      .map(hour => `${this.dayName(hour.dayOfWeek)} das ${hour.openTime} as ${hour.closeTime}`)
      .join("; ");
  }

  private currentBusinessStatus(context: AnyRecord) {
    const timezone = context.settings?.timezone || "America/Sao_Paulo";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date())
      .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {} as Record<string, string>);
    const weekMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    const dayOfWeek = weekMap[parts.weekday] ?? new Date().getDay();
    const currentTime = `${parts.hour || "00"}:${parts.minute || "00"}`;
    const todaysHours = (context.businessHours || []).find(
      (hour: AnyRecord) => Number(hour.dayOfWeek) === dayOfWeek && String(hour.type || "normal") === "normal"
    );
    const isOpen =
      todaysHours &&
      !todaysHours.isClosed &&
      todaysHours.openTime &&
      todaysHours.closeTime &&
      currentTime >= todaysHours.openTime &&
      currentTime <= todaysHours.closeTime;

    return {
      currentTime,
      dayOfWeek,
      isOpen: Boolean(isOpen),
      label: `${this.dayName(dayOfWeek)}, ${currentTime}`,
      timezone
    };
  }

  async aiPrompt(companyId: string) {
    const context = await this.context(companyId);
    const publicKey = String(context.publicId || context.slug);
    const bookingUrl = `https://saas.correacloud.com.br/cliente/${publicKey}`;
    const hoursSummary = this.businessHoursSummary(context.businessHours || []);
    const currentStatus = this.currentBusinessStatus(context);
    const outOfHoursMessage =
      context.botSettings?.outOfHoursMessage ||
      "No momento ainda nao estamos funcionando. Horario de funcionamento: quinta-feira das 18:00 as 22:30; sexta-feira das 18:00 as 22:30; sabado das 18:00 as 23:00; domingo das 18:00 as 23:00.";

    return {
      bookingUrl: context.segment === "barbershop" ? bookingUrl : undefined,
      prompt: [
        `Voce e o assistente virtual da empresa ${context.name}.`,
        "Responda sempre com base exclusivamente nas informacoes do contexto da empresa.",
        "Nunca invente precos, produtos, horarios, taxas, formas de pagamento, disponibilidade, servicos ou profissionais.",
        "Se a informacao nao existir no contexto, diga que vai chamar um atendente humano.",
        `Horario de atendimento cadastrado: ${hoursSummary}.`,
        `Agora no horario da empresa (${currentStatus.timezone}): ${currentStatus.label}. Loja ${currentStatus.isOpen ? "dentro do horario de atendimento" : "fora do horario de atendimento"}.`,
        `Mensagem informativa fora do horario: ${outOfHoursMessage}`,
        "Se o cliente enviar mensagem fora do horario de funcionamento ou com a loja fechada, responda apenas que ainda nao estamos funcionando no momento e informe o horario de funcionamento. Nao envie link do cardapio e nao tente finalizar pedido fora do horario.",
        context.segment === "restaurant"
          ? "Para restaurante, monte pedidos item por item, pergunte entrega ou retirada, colete endereco/localizacao quando necessario e confirme tudo antes de finalizar."
          : "",
        context.segment === "barbershop"
          ? `Para barbearia, apresente servicos, valores, duracao e profissional. Quando o cliente quiser agendar, consultar horarios, marcar corte ou perguntar disponibilidade, envie o link de agendamento ${bookingUrl}. Diga que por ele a pessoa escolhe servico, barbeiro e ve apenas os horarios livres. Continue a conversa pelo WhatsApp se o cliente tiver duvida, mas nao invente disponibilidade e nao confirme horario sem usar a agenda.`
          : "",
        "Se o cliente pedir humano, atendente ou suporte, transfira para atendimento humano.",
        `Tom de atendimento: ${context.botSettings?.tone || "friendly"}.`
      ]
        .filter(Boolean)
        .join("\n")
    };
  }

  async createOrUpdateOrder(data: AnyRecord, user?: AuthUser) {
    const companyId = data.companyId || user?.companyId;
    if (!companyId) {
      throw new BadRequestException("companyId obrigatorio.");
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const subtotal = items.reduce(
      (sum: number, item: AnyRecord) =>
        sum + Number(item.subtotal ?? Number(item.quantity || 1) * Number(item.unitPrice || 0)),
      0
    );
    const deliveryFee = Number(data.deliveryFee || 0);
    const discount = Number(data.discount || 0);
    const total = Number(data.total ?? subtotal + deliveryFee - discount);

    if (data.id) {
      return this.prisma.order.update({
        where: { id: data.id },
        data: {
          customerId: data.customerId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          status: data.status,
          orderType: data.orderType,
          subtotal,
          deliveryFee,
          discount,
          total,
          paymentMethod: data.paymentMethod,
          deliveryAddressId: data.deliveryAddressId,
          deliveryLatitude: data.deliveryLatitude,
          deliveryLongitude: data.deliveryLongitude,
          notes: data.notes,
          origin: data.origin
        }
      });
    }

    return this.prisma.order.create({
      data: {
        companyId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        status: data.status || OrderStatus.draft,
        orderType: data.orderType || "delivery",
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod: data.paymentMethod,
        deliveryAddressId: data.deliveryAddressId,
        deliveryLatitude: data.deliveryLatitude,
        deliveryLongitude: data.deliveryLongitude,
        notes: data.notes,
        origin: data.origin || "painel",
        ticketzTicketId: data.ticketzTicketId,
        items: {
          create: items.map((item: AnyRecord) => ({
            companyId,
            productId: item.productId,
            productName: item.productName,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            subtotal: Number(item.subtotal ?? Number(item.quantity || 1) * Number(item.unitPrice || 0)),
            notes: item.notes,
            addons: {
              create: (item.addons || []).map((addon: AnyRecord) => ({
                companyId,
                addonId: addon.addonId,
                addonName: addon.addonName,
                price: Number(addon.price || 0)
              }))
            }
          }))
        }
      },
      include: { items: { include: { addons: true } } }
    });
  }

  async confirmOrder(orderId: string, companyId: string) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, companyId }
    });

    if (!existing) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.confirmed },
      include: { items: { include: { addons: true } }, deliveryAddress: true }
    });

    if (order.orderType === "delivery") {
      const existingDelivery = await this.prisma.delivery.findFirst({
        where: { companyId, orderId }
      });

      if (!existingDelivery) {
        await this.prisma.delivery.create({
          data: {
            companyId,
            orderId,
            customerId: order.customerId,
            deliveryAddress: this.formatAddress(order.deliveryAddress) || order.notes || undefined,
            deliveryLatitude: order.deliveryLatitude,
            deliveryLongitude: order.deliveryLongitude,
            deliveryFee: order.deliveryFee
          }
        });
      }
    }

    const printJobs = await this.createPrintJobsForOrder(order.id, companyId);
    const notification = await this.notifyCustomerOrderAccepted(order, companyId);
    return { order: (await this.withOrderDisplayNumbers([order], companyId))[0], printJobs, notification };
  }

  async updateOrderStatus(orderId: string, companyId: string, status: OrderStatus) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, companyId }
    });

    if (!existing) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { items: { include: { addons: true } }, deliveryAddress: true }
    });
    const notification = await this.notifyCustomerOrderStatusChanged(order, companyId, status);
    return { order: (await this.withOrderDisplayNumbers([order], companyId))[0], notification };
  }

  private paperColumns(paperWidth: unknown) {
    const value = String(paperWidth || "");
    if (value === "mm58" || value === "58mm") return 32;
    if (value === "a4") return 80;
    return 40;
  }

  private stripAccents(value: unknown) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  private receiptLine(width: number) {
    return "-".repeat(width);
  }

  private receiptCenter(value: unknown, width: number) {
    const text = this.stripAccents(value).trim();
    if (text.length >= width) return text.slice(0, width);
    const left = Math.floor((width - text.length) / 2);
    return `${" ".repeat(left)}${text}`;
  }

  private wrapReceiptText(value: unknown, width: number, indent = "") {
    const text = this.stripAccents(value).replace(/\s+/g, " ").trim();
    if (!text) return [indent.trimEnd()];

    const lines: string[] = [];
    let current = indent;
    const available = Math.max(8, width);

    for (const word of text.split(" ")) {
      const separator = current.trim() ? " " : "";
      if (`${current}${separator}${word}`.length > available) {
        lines.push(current.trimEnd());
        current = `${indent}${word}`;
      } else {
        current = `${current}${separator}${word}`;
      }
    }

    if (current.trim()) lines.push(current.trimEnd());
    return lines.map(line => line.slice(0, width));
  }

  private receiptRow(label: string, value: unknown, width: number) {
    const cleanLabel = this.stripAccents(label).trim();
    const cleanValue = this.stripAccents(value).trim();
    const prefix = `${cleanLabel}: `;
    if (`${prefix}${cleanValue}`.length <= width) {
      return [`${prefix}${cleanValue}`];
    }
    return this.wrapReceiptText(cleanValue, width, prefix);
  }

  async buildOrderPrintContent(order: AnyRecord, paperWidth: unknown = "mm80") {
    const width = this.paperColumns(paperWidth);
    const displayNumber = await this.orderDisplayNumber(order);
    const lines = [
      this.receiptCenter("PIZZARIA BIG BURGUER", width),
      this.receiptLine(width),
      ...this.receiptRow("Pedido", displayNumber, width),
      ...this.receiptRow("Data/Hora", this.formatBrasiliaDateTime(order.createdAt), width),
      ...this.receiptRow("Cliente", order.customerName || "-", width),
      ...this.receiptRow("Telefone", order.customerPhone || "-", width),
      ...this.receiptRow("Tipo", this.orderTypeLabel(order.orderType), width),
      this.receiptLine(width),
      "",
      "ITENS"
    ];

    for (const item of order.items || []) {
      const printLabel = this.printItemLabel(item);
      lines.push(...this.wrapReceiptText(`${item.quantity}x ${printLabel}`, width));
      if (!this.customerPizzaItemLabel(item.productName, this.itemFlavorSummary(item)) && item.addons?.length) {
        lines.push(...this.wrapReceiptText(`Adicionais: ${item.addons.map((addon: AnyRecord) => addon.addonName).join(", ")}`, width, "  "));
      }
      if (item.notes) {
        lines.push(...this.wrapReceiptText(`Obs item: ${item.notes}`, width, "  "));
      }
    }

    lines.push("", this.receiptLine(width));
    lines.push(...this.receiptRow("Observacao", order.notes || "-", width));
    lines.push(...this.receiptRow("Pagamento", order.paymentMethod || "-", width));
    lines.push(...this.receiptRow("Total", `R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`, width));

    if (order.orderType === "delivery") {
      lines.push("", "ENDERECO");
      lines.push(...this.wrapReceiptText(this.formatAddress(order.deliveryAddress) || order.notes || "-", width));
    }

    lines.push("", this.receiptLine(width), "", "", "");

    return `${lines.map(line => this.stripAccents(line).slice(0, width)).join("\n")}\n`;
  }

  private orderTypeLabel(orderType: unknown) {
    const value = String(orderType || "");
    if (value === "delivery") return "Entrega";
    if (value === "pickup") return "Retirada";
    if (value === "table") return "Mesa";
    return value || "-";
  }

  private formatBrasiliaDateTime(value: unknown) {
    return new Date(String(value)).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  private async orderDisplayNumber(order: AnyRecord) {
    if (!order?.id || !order?.companyId || !order?.createdAt) return "#---";
    const createdAt = new Date(order.createdAt);
    const sequence = await this.prisma.order.count({
      where: {
        companyId: String(order.companyId),
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lte: String(order.id) } }
        ]
      }
    });
    return `#${String(sequence || 1).padStart(3, "0")}`;
  }

  private async withOrderDisplayNumbers(orders: AnyRecord[], companyId?: string) {
    if (!orders.length) return orders;
    const resolvedCompanyId = companyId || String(orders[0]?.companyId || "");
    if (!resolvedCompanyId) return orders;

    const allOrders = await this.prisma.order.findMany({
      where: { companyId: resolvedCompanyId },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const numbers = new Map(
      allOrders.map((order, index) => [order.id, `#${String(index + 1).padStart(3, "0")}`])
    );
    return orders.map(order => ({
      ...order,
      displayNumber: numbers.get(String(order.id)) || `#${String(order.id).slice(0, 8)}`
    }));
  }

  private cleanPhone(value: unknown) {
    return String(value || "").replace(/\D/g, "");
  }

  private phoneSearchCandidates(value: unknown) {
    const phone = this.cleanPhone(value);
    const candidates = [phone];

    if (phone.startsWith("55") && phone.length >= 12) {
      candidates.push(phone.slice(2));
    }

    if (phone.length > 9) {
      candidates.push(phone.slice(-9));
    }

    if (phone.length === 9) {
      candidates.push(`27${phone}`);
      candidates.push(`5527${phone}`);
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  private ticketzPhoneCandidates(value: unknown) {
    const phone = this.cleanPhone(value);
    const candidates = [];

    if (phone.startsWith("55") && phone.length >= 12) {
      candidates.push(phone.slice(2));
    }

    candidates.push(phone);

    if (phone.length > 9) {
      candidates.push(phone.slice(-9));
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  private ticketzBackendUrl(baseUrl: unknown) {
    const clean = String(baseUrl || process.env.TICKETZ_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    if (!clean) return "";
    return clean.endsWith("/backend") ? clean : `${clean}/backend`;
  }

  private async sendTicketzNumberMessage(companyId: string, phoneValue: unknown, content: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const token = String(company?.ticketzApiToken || process.env.TICKETZ_API_TOKEN || "").trim();
    const backendUrl = this.ticketzBackendUrl(company?.ticketzBaseUrl);
    const phones = this.ticketzPhoneCandidates(phoneValue);
    const queueId = company?.ticketzQueueId ? Number(company.ticketzQueueId) : undefined;
    const whatsappId = company?.ticketzWhatsappId ? Number(company.ticketzWhatsappId) : undefined;

    if (!token || !backendUrl || !phones.length) {
      return { ok: false, skipped: true, reason: "ticketz_config_or_destination_missing" };
    }

    const destinations = phones.map(phone => ({
      via: "ticketz_api",
      payload: {
        number: phone,
        body: content,
        saveOnTicket: queueId || true,
        whatsappId,
        ticketzWhatsappId: whatsappId,
        linkPreview: false
      }
    }));
    const attempts = [];

    for (const destination of destinations) {
      const response = await fetch(`${backendUrl}/api/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(destination.payload)
      });

      const data = await response.json().catch(() => null);
      const result = {
        ok: response.ok,
        status: response.status,
        via: destination.via,
        number: destination.payload.number,
        response: data
      };
      attempts.push(result);

      if (response.ok) {
        return { ...result, attempts };
      }
    }

    return {
      ok: false,
      via: attempts[0]?.via || "none",
      attempts
    };
  }

  private async sendTicketzCustomerMessage(order: AnyRecord, companyId: string, content: string) {
    return this.sendTicketzNumberMessage(companyId, order.customerPhone, content);
  }

  private orderItemsSummary(order: AnyRecord) {
    const items = (order.items || []).map((item: AnyRecord) => {
      const addons = this.itemFlavorSummary(item);
      const notes = item.notes ? ` - obs: ${item.notes}` : "";
      const pizzaLabel = this.customerPizzaItemLabel(item.productName, addons);
      if (pizzaLabel) return `${item.quantity || 1}x ${pizzaLabel}${notes}`;
      return `${item.quantity || 1}x ${item.productName}${addons ? ` (${addons})` : ""}${notes}`;
    });
    return items.length ? items.join("\n") : "Itens nao informados.";
  }

  private itemFlavorSummary(item: AnyRecord) {
    return item.addons?.length
      ? item.addons.map((addon: AnyRecord) => this.cleanPizzaFlavorName(addon.addonName)).join(" + ")
      : "";
  }

  private printItemLabel(item: AnyRecord) {
    const flavors = this.printPizzaFlavorSummary(item);
    const pizzaLabel = this.printPizzaItemLabel(item.productName, flavors);
    return pizzaLabel || `${item.productName}${flavors ? ` (${flavors})` : ""}`;
  }

  private printPizzaFlavorSummary(item: AnyRecord) {
    const flavors = item.addons?.length
      ? item.addons.map((addon: AnyRecord) => String(addon.addonName || "").trim()).filter(Boolean)
      : [];
    if (flavors.length === 2) return `metade ${flavors[0]} e metade ${flavors[1]}`;
    return flavors.join(" / ");
  }

  private cleanPizzaFlavorName(value: unknown) {
    return String(value || "").replace(/^\s*\d+\s*-\s*/, "").trim();
  }

  private customerPizzaItemLabel(productName: unknown, flavors: string) {
    const name = String(productName || "");
    if (!/pizza/i.test(name)) return "";

    const { sizeLabel, slices } = this.pizzaSizeAndSlices(name);
    return [sizeLabel, flavors, slices].filter(Boolean).join(" - ");
  }

  private printPizzaItemLabel(productName: unknown, flavors: string) {
    const name = String(productName || "");
    if (!/pizza/i.test(name)) return "";

    const { sizeLabel, slices } = this.pizzaSizeAndSlices(name);
    return [sizeLabel, flavors, slices].filter(Boolean).join(" - ");
  }

  private pizzaSizeAndSlices(name: string) {
    const sizeMap = [
      { pattern: /30cm|media/i, label: "M" },
      { pattern: /35cm|grande/i, label: "G" },
      { pattern: /40cm|gigante/i, label: "GG" },
      { pattern: /50cm|maracana/i, label: "Maracana" }
    ];
    const sizeLabel = sizeMap.find(size => size.pattern.test(name))?.label || "Pizza";
    const slices =
      name.match(/(\d+)\s*fatias/i)?.[0] ||
      (/(20)\s*pedacos/i.test(name) || /20\s*peda/i.test(name) ? "aprox. 20 pedacos" : "");
    return { sizeLabel, slices };
  }

  private async companyMessageTemplate(companyId: string, field: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: {
        orderAcceptedMessageTemplate: true,
        orderOutForDeliveryMessageTemplate: true,
        orderReadyMessageTemplate: true
      }
    });
    return String((settings as AnyRecord | null)?.[field] || "").trim();
  }

  private async companyDisplayName(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true }
    });
    return company?.name || "a loja";
  }

  private renderOrderMessageTemplate(template: string, order: AnyRecord, variables: Record<string, string>) {
    const address = this.formatAddress(order.deliveryAddress) || String(order.notes || "");
    const baseVariables: Record<string, string> = {
      cliente: String(order.customerName || "cliente"),
      primeiro_nome: String(order.customerName || "cliente").trim().split(/\s+/)[0] || "cliente",
      empresa: variables.empresa || "a loja",
      pedido: variables.pedido || "",
      itens: this.orderItemsSummary(order),
      total: `R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`,
      pagamento: String(order.paymentMethod || "-"),
      tipo: this.orderTypeLabel(order.orderType),
      endereco: address || "endereco informado no pedido",
      destino: variables.destino || address || "-",
      proximo_passo: variables.proximo_passo || "",
      tempo_entrega: variables.tempo_entrega || DELIVERY_TIME_MESSAGE,
      observacao: String(order.notes || "")
    };
    const resolved = { ...baseVariables, ...variables };
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => resolved[key] ?? "");
  }

  private async acceptedOrderMessage(order: AnyRecord, companyId: string) {
    const displayNumber = await this.orderDisplayNumber(order);
    const companyName = await this.companyDisplayName(companyId);
    const firstName = String(order.customerName || "cliente").trim().split(/\s+/)[0] || "cliente";
    const destination =
      order.orderType === "delivery"
        ? `Entrega: ${this.formatAddress(order.deliveryAddress) || order.notes || "endereco informado no pedido"}`
        : order.orderType === "pickup"
          ? "Retirada no local."
          : "Pedido de mesa.";
    const nextStep =
      order.orderType === "delivery"
        ? `Seu pedido ja esta em producao. ${DELIVERY_TIME_MESSAGE} Quando sair para entrega, avisamos por aqui.`
        : order.orderType === "pickup"
          ? "Seu pedido ja esta em producao. Avisamos por aqui quando estiver pronto para retirada."
          : "Seu pedido foi enviado para a cozinha.";

    const template = await this.companyMessageTemplate(companyId, "orderAcceptedMessageTemplate");
    if (template) {
      return this.renderOrderMessageTemplate(template, order, {
        pedido: displayNumber,
        empresa: companyName,
        destino: destination,
        proximo_passo: nextStep,
        tempo_entrega: DELIVERY_TIME_MESSAGE
      });
    }

    return [
      `Perfeito, ${firstName}! Pedido ${displayNumber} aceito pela ${companyName}.`,
      "",
      this.orderItemsSummary(order),
      "",
      `Total: R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`,
      `Pagamento: ${order.paymentMethod || "-"}`,
      destination,
      "",
      nextStep
    ].join("\n");
  }

  private async safeSendTicketzCustomerMessage(order: AnyRecord, companyId: string, content: string) {
    try {
      return await this.sendTicketzCustomerMessage(order, companyId, content);
    } catch (error) {
      return {
        ok: false,
        via: order.ticketzTicketId ? "ticket" : "number",
        error: error instanceof Error ? error.message : "Erro ao notificar cliente"
      };
    }
  }

  private async notifyCustomerOrderAccepted(order: AnyRecord, companyId: string) {
    return this.safeSendTicketzCustomerMessage(order, companyId, await this.acceptedOrderMessage(order, companyId));
  }

  private isOrderFollowupRequest(content: unknown) {
    const text = String(content || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!text) return false;
    return /acompan|status|resumo|pedido/.test(text) && /pedido|#|acompan/.test(text);
  }

  private orderNumberFromFollowup(content: unknown) {
    const text = String(content || "");
    const match = text.match(/#\s*(\d{1,6})/) || text.match(/pedido\s*#?\s*(\d{1,6})/i);
    return match ? Number(match[1]) : 0;
  }

  private async findOrderForFollowup(companyId: string, customerPhone: unknown, content: unknown) {
    const requestedNumber = this.orderNumberFromFollowup(content);
    const include = {
      items: { include: { addons: true } },
      deliveryAddress: true
    };

    if (requestedNumber > 0) {
      const allOrders = await this.prisma.order.findMany({
        where: { companyId },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      const orderId = allOrders[requestedNumber - 1]?.id;
      if (orderId) {
        return this.prisma.order.findFirst({
          where: { id: orderId, companyId },
          include
        });
      }
    }

    const phones = this.phoneSearchCandidates(customerPhone);
    if (!phones.length) return null;

    return this.prisma.order.findFirst({
      where: {
        companyId,
        customerPhone: { in: phones },
        status: { notIn: [OrderStatus.canceled, OrderStatus.completed] }
      },
      include,
      orderBy: { createdAt: "desc" }
    });
  }

  private orderStatusCustomerLabel(status: unknown) {
    const labels: Record<string, string> = {
      draft: "Rascunho.",
      waiting_confirmation: "Aguardando confirmacao da loja. Assim que aceitarmos, avisamos por aqui.",
      confirmed: "Pedido aceito e em producao.",
      preparing: "Pedido em producao.",
      ready: "Pedido pronto.",
      out_for_delivery: "Pedido saiu para entrega.",
      delivered: "Pedido entregue.",
      completed: "Pedido finalizado.",
      canceled: "Pedido cancelado."
    };
    return labels[String(status)] || String(status || "-");
  }

  private async followupOrderSummaryMessage(order: AnyRecord, companyId: string) {
    const displayNumber = await this.orderDisplayNumber(order);
    const companyName = await this.companyDisplayName(companyId);
    const firstName = String(order.customerName || "cliente").trim().split(/\s+/)[0] || "cliente";
    const destination =
      order.orderType === "delivery"
        ? `Entrega: ${this.formatAddress(order.deliveryAddress) || order.notes || "endereco informado no pedido"}`
        : order.orderType === "pickup"
          ? "Retirada no local."
          : "Pedido de mesa.";

    const averageTime =
      order.orderType === "delivery"
        ? DELIVERY_TIME_MESSAGE
        : "Tempo medio de preparo: 30 a 70 minutos.";

    return [
      `Oi, ${firstName}! Aqui esta o resumo do seu pedido ${displayNumber} na ${companyName}:`,
      "",
      this.orderItemsSummary(order),
      "",
      `Total: R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`,
      `Pagamento: ${order.paymentMethod || "-"}`,
      destination,
      "",
      averageTime
    ].join("\n");
  }

  async sendOrderFollowupSummary(companyId: string, customerPhone: unknown, content: unknown) {
    if (!this.isOrderFollowupRequest(content)) {
      return { handled: false, reason: "not_followup_request" };
    }

    const order = await this.findOrderForFollowup(companyId, customerPhone, content);
    if (!order) {
      return {
        handled: true,
        found: false,
        notification: await this.sendTicketzNumberMessage(
          companyId,
          customerPhone,
          "Nao encontrei esse pedido por aqui. Confere o numero do pedido ou chama a loja para te ajudar."
        )
      };
    }

    const notification = await this.safeSendTicketzCustomerMessage(
      order,
      companyId,
      await this.followupOrderSummaryMessage(order, companyId)
    );

    return {
      handled: true,
      found: true,
      order: (await this.withOrderDisplayNumbers([order], companyId))[0],
      notification
    };
  }

  private async notifyCustomerOrderStatusChanged(order: AnyRecord, companyId: string, status: OrderStatus) {
    const displayNumber = await this.orderDisplayNumber(order);

    if (status === OrderStatus.out_for_delivery) {
      const template = await this.companyMessageTemplate(companyId, "orderOutForDeliveryMessageTemplate");
      return this.safeSendTicketzCustomerMessage(
        order,
        companyId,
        template
          ? this.renderOrderMessageTemplate(template, order, { pedido: displayNumber, empresa: await this.companyDisplayName(companyId) })
          : `Boa noticia! O pedido ${displayNumber} saiu para entrega e esta a caminho.`
      );
    }

    if (status === OrderStatus.ready) {
      const template = await this.companyMessageTemplate(companyId, "orderReadyMessageTemplate");
      const content =
        template
          ? this.renderOrderMessageTemplate(template, order, { pedido: displayNumber, empresa: await this.companyDisplayName(companyId) })
          : order.orderType === "pickup"
          ? `Tudo certo! O pedido ${displayNumber} esta pronto para retirada.`
          : `Tudo certo! O pedido ${displayNumber} esta pronto. Ja vamos liberar a entrega.`;
      return this.safeSendTicketzCustomerMessage(order, companyId, content);
    }

    return { ok: false, skipped: true, reason: "status_without_customer_notification" };
  }

  private formatAddress(address: AnyRecord | null | undefined) {
    if (!address) return "";
    return [
      [address.street, address.number].filter(Boolean).join(", "),
      address.complement,
      address.neighborhood,
      [address.city, address.state].filter(Boolean).join(" - "),
      address.reference ? `Referencia: ${address.reference}` : ""
    ]
      .filter(Boolean)
      .join(" | ");
  }

  async createPrintJobsForOrder(orderId: string, companyId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: { include: { addons: true } }, deliveryAddress: true }
    });
    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const printers = await this.prisma.printer.findMany({
      where: {
        companyId,
        active: true,
        OR: [{ defaultForKitchen: true }, { defaultForDelivery: true }]
      }
    });

    const data: Prisma.PrintJobCreateManyInput[] = [];
    for (const printer of printers) {
      const content = await this.buildOrderPrintContent(order, printer.paperWidth);
      if (printer.defaultForKitchen) {
        data.push({
          companyId,
          orderId,
          printerId: printer.id,
          type: PrintJobType.kitchen_order,
          content
        });
      }
      if (order.orderType === "delivery" && printer.defaultForDelivery) {
        data.push({
          companyId,
          orderId,
          printerId: printer.id,
          type: PrintJobType.delivery_receipt,
          content
        });
      }
    }

    if (data.length === 0) {
      return [];
    }

    await this.prisma.printJob.createMany({ data });
    return this.prisma.printJob.findMany({
      where: { companyId, orderId },
      orderBy: { createdAt: "desc" },
      take: data.length
    });
  }

  async assignDelivery(deliveryId: string, companyId: string, deliveryPersonId: string) {
    const delivery = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        deliveryPersonId,
        status: DeliveryStatus.assigned,
        assignedAt: new Date(),
        events: {
          create: {
            companyId,
            status: "assigned",
            description: "Entrega atribuida a motoboy."
          }
        }
      },
      include: { order: { include: { items: { include: { addons: true } }, deliveryAddress: true } }, deliveryPerson: true, events: true }
    });

    if (delivery.companyId !== companyId) {
      throw new NotFoundException("Entrega nao encontrada.");
    }

    let customerNotification: AnyRecord = { ok: false, skipped: true, reason: "order_already_out_for_delivery" };
    if (delivery.order && !["out_for_delivery", "completed", "canceled"].includes(String(delivery.order.status))) {
      const order = await this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: OrderStatus.out_for_delivery },
        include: { items: { include: { addons: true } }, deliveryAddress: true }
      });
      customerNotification = await this.notifyCustomerOrderStatusChanged(
        order,
        companyId,
        OrderStatus.out_for_delivery
      );
      delivery.order = order;
    }

    const message = await this.deliveryMessage(delivery);
    const deliveryPersonPhone = delivery.deliveryPerson?.whatsapp || delivery.deliveryPerson?.phone;
    const notification = deliveryPersonPhone
      ? await this.sendTicketzNumberMessage(companyId, deliveryPersonPhone, message).catch(error => ({
          ok: false,
          error: error instanceof Error ? error.message : "Erro ao avisar motoboy"
        }))
      : { ok: false, skipped: true, reason: "delivery_person_phone_missing" };

    return {
      delivery,
      message,
      notification,
      customerNotification
    };
  }

  async updateDeliveryStatus(deliveryId: string, companyId: string, status: DeliveryStatus) {
    const data: AnyRecord = { status };
    if (status === DeliveryStatus.picked_up) data.pickedUpAt = new Date();
    if (status === DeliveryStatus.delivered) data.deliveredAt = new Date();

    const delivery = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        ...data,
        events: {
          create: {
            companyId,
            status,
            description: `Status atualizado para ${status}.`
          }
        }
      },
      include: { events: true }
    });

    if (delivery.companyId !== companyId) {
      throw new NotFoundException("Entrega nao encontrada.");
    }

    return delivery;
  }

  async deliveryMessage(delivery: AnyRecord) {
    const order = delivery.order || {};
    const displayNumber = await this.orderDisplayNumber(order);
    const items = (order.items || [])
      .map((item: AnyRecord) => `${item.quantity}x ${item.productName}`)
      .join("\n");
    const map =
      delivery.deliveryLatitude && delivery.deliveryLongitude
        ? `https://maps.google.com/?q=${delivery.deliveryLatitude},${delivery.deliveryLongitude}`
        : "-";

    return [
      "Nova entrega atribuida para voce.",
      "",
      `Pedido: ${displayNumber}`,
      `Cliente: ${order.customerName || "-"}`,
      `Telefone: ${order.customerPhone || "-"}`,
      "",
      "Itens:",
      items || "-",
      "",
      `Valor total: R$ ${Number(order.total || 0).toFixed(2).replace(".", ",")}`,
      `Pagamento: ${order.paymentMethod || "-"}`,
      "",
      "Endereco:",
      delivery.deliveryAddress || "-",
      "",
      "Mapa:",
      map,
      "",
      "Observacoes:",
      order.notes || "-",
      "",
      "Status: Aguardando retirada."
    ].join("\n");
  }

  async pendingPrintJobs(companyId: string, printerName?: string) {
    const shouldFilterByPrinterName = printerName
      ? await this.prisma.printer.count({
          where: { companyId, active: true, name: printerName }
        })
      : 0;

    return this.prisma.printJob.findMany({
      where: {
        companyId,
        status: PrintJobStatus.pending,
        printer: {
          active: true,
          ...(shouldFilterByPrinterName > 0 ? { name: printerName } : {})
        }
      },
      include: { printer: true },
      orderBy: { createdAt: "asc" },
      take: 25
    });
  }
}
