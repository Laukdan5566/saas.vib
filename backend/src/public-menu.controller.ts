import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { OrderStatus, OrderType, Origin, PaymentType } from "@prisma/client";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";

type AnyRecord = Record<string, any>;

function cleanPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function phoneSearchCandidates(value: unknown) {
  const phone = cleanPhone(value);
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

@Controller("api/public")
export class PublicMenuController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly app: AppService
  ) {}

  private async withOrderDisplayNumbers(orders: AnyRecord[], companyId: string) {
    if (!orders.length) return orders;
    const allOrders = await this.prisma.order.findMany({
      where: { companyId },
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

  private async company(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        settings: true,
        paymentMethods: {
          where: { active: true },
          select: { name: true, type: true, instructions: true }
        }
      }
    });

    if (!company || !company.active) {
      throw new NotFoundException("Loja nao encontrada.");
    }

    return company;
  }

  @Get(":slug/menu")
  async menu(@Param("slug") slug: string) {
    const company = await this.company(slug);
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
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        phone: company.phone,
        whatsapp: company.whatsapp,
        segment: company.segment,
        acceptOrders: company.settings?.acceptOrders ?? true,
        allowDelivery: company.settings?.allowDelivery ?? true,
        allowPickup: company.settings?.allowPickup ?? true,
        deliveryFeeDefault: deliveryFeeOrDefault(undefined, company.settings?.deliveryFeeDefault),
        minimumOrderValue: money(company.settings?.minimumOrderValue),
        preparationTimeMinutes: company.settings?.preparationTimeMinutes ?? 30,
        paymentMethods: company.paymentMethods.filter(method => method.type === PaymentType.pix)
      },
      categories
    };
  }

  @Get(":slug/orders")
  async orders(@Param("slug") slug: string, @Query("phone") phone: string | undefined) {
    const company = await this.company(slug);
    const customerPhone = cleanPhone(phone);
    const phoneCandidates = phoneSearchCandidates(phone);

    if (!customerPhone || !phoneCandidates.length) {
      throw new BadRequestException("Telefone obrigatorio.");
    }

    const orders = await this.prisma.order.findMany({
      where: {
        companyId: company.id,
        customerPhone: { in: phoneCandidates }
      },
      include: {
        items: {
          include: { addons: true }
        },
        deliveryAddress: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return this.withOrderDisplayNumbers(orders, company.id);
  }

  @Post(":slug/orders")
  async createOrder(@Param("slug") slug: string, @Body() body: AnyRecord) {
    const company = await this.company(slug);

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
      String(body.customer?.name || "").trim() ||
      tableCustomerName ||
      (orderType === OrderType.table ? `Mesa ${tableNumber}` : "");
    const customerPhone = cleanPhone(body.customer?.phone);
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
    const total = subtotal + deliveryFee;

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
        discount: 0,
        total,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : undefined,
        deliveryAddressId: address?.id,
        notes: this.composeOrderNotes(body.notes, orderType, tableNumber, waiterName) || undefined,
        origin: Origin.painel,
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

    return {
      order: accepted.order,
      printJobs: accepted.printJobs,
      notification: accepted.notification,
      message: "Pedido recebido e aceito automaticamente."
    };
  }

  private normalizeOrderType(value: unknown): OrderType {
    if (value === OrderType.pickup) return OrderType.pickup;
    if (value === OrderType.table) return OrderType.table;
    return OrderType.delivery;
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
        label: "Entrega",
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
