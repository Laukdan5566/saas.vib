import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const defaultModules = [
  { moduleKey: "dashboard", name: "Dashboard", description: "Indicadores operacionais." },
  { moduleKey: "companies", name: "Empresas", description: "Cadastro e configuracao de empresas." },
  { moduleKey: "users", name: "Usuarios", description: "Usuarios, papeis e permissoes." },
  { moduleKey: "menu", name: "Cardapio", description: "Categorias, produtos e adicionais." },
  { moduleKey: "services", name: "Servicos", description: "Servicos, profissionais e disponibilidade." },
  { moduleKey: "customers", name: "Clientes", description: "Clientes finais e enderecos." },
  { moduleKey: "connections", name: "Conexoes WhatsApp", description: "Canais WhatsApp, QR Code e integracao Ticketz." },
  { moduleKey: "chat", name: "Chat e tickets", description: "Recebimento de tickets, mensagens e ponte com n8n." },
  { moduleKey: "orders", name: "Pedidos", description: "Pedidos e itens." },
  { moduleKey: "deliveries", name: "Entregas", description: "Entregas, zonas e motoboys." },
  { moduleKey: "appointments", name: "Agendamentos", description: "Agenda de servicos." },
  { moduleKey: "payments", name: "Pagamentos", description: "Formas e registros de pagamento." },
  { moduleKey: "coupons", name: "Cupons", description: "Cupons e promocoes." },
  { moduleKey: "knowledge", name: "FAQ e conhecimento", description: "FAQ e base de conhecimento para IA." },
  { moduleKey: "bot", name: "Bot", description: "Configuracoes do assistente virtual." },
  { moduleKey: "tickets", name: "Tickets", description: "Espelho do Ticketz/Whaticket." },
  { moduleKey: "printing", name: "Impressao", description: "Impressoras e fila de impressao." },
  { moduleKey: "audit", name: "Auditoria", description: "Logs e auditoria." },
  { moduleKey: "integrations", name: "Integracoes", description: "Ticketz, n8n e webhooks." }
];

async function ensureModules(companyId: string, overrides: Record<string, boolean> = {}) {
  for (const module of defaultModules) {
    await prisma.companyModule.upsert({
      where: {
        companyId_moduleKey: {
          companyId,
          moduleKey: module.moduleKey
        }
      },
      update: {
        name: module.name,
        description: module.description,
        active: overrides[module.moduleKey] ?? true
      },
      create: {
        companyId,
        moduleKey: module.moduleKey,
        name: module.name,
        description: module.description,
        active: overrides[module.moduleKey] ?? true
      }
    });
  }
}

async function seedRestaurant() {
  const company = await prisma.company.upsert({
    where: { slug: "restaurante-delivery-exemplo" },
    update: {},
    create: {
      name: "Restaurante Delivery Exemplo",
      slug: "restaurante-delivery-exemplo",
      segment: "restaurant",
      phone: "1133334444",
      whatsapp: "11999999999",
      email: "restaurante@example.com",
      city: "Sao Paulo",
      state: "SP",
      botEnabled: true
    }
  });

  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      allowDelivery: true,
      allowPickup: true,
      preparationTimeMinutes: 55,
      deliveryFeeDefault: 8
    }
  });

  await prisma.botSettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      tone: "friendly",
      greetingMessage: "Ola! Posso ajudar com seu pedido?",
      humanHandoffKeywords: "atendente, humano, suporte"
    }
  });

  await ensureModules(company.id, {
    services: false,
    appointments: false
  });

  if ((await prisma.paymentMethod.count({ where: { companyId: company.id } })) === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        { companyId: company.id, name: "Pix", type: "pix", instructions: "Enviar comprovante no WhatsApp." },
        { companyId: company.id, name: "Dinheiro", type: "cash", instructions: "Informe se precisa de troco." },
        { companyId: company.id, name: "Cartao na entrega", type: "credit_card" }
      ]
    });
  }

  if ((await prisma.menuCategory.count({ where: { companyId: company.id } })) === 0) {
    const lanches = await prisma.menuCategory.create({
      data: {
        companyId: company.id,
        name: "Lanches",
        description: "Hamburgueres artesanais",
        sortOrder: 1
      }
    });

    const bebidas = await prisma.menuCategory.create({
      data: {
        companyId: company.id,
        name: "Bebidas",
        sortOrder: 2
      }
    });

    const xbacon = await prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: lanches.id,
        name: "X-Bacon",
        description: "Pao, burger, queijo, bacon e molho da casa",
        price: 29.9,
        preparationTimeMinutes: 25
      }
    });

    const extras = await prisma.productAddonGroup.create({
      data: {
        companyId: company.id,
        productId: xbacon.id,
        name: "Extras",
        maxChoices: 3
      }
    });

    await prisma.productAddon.createMany({
      data: [
        { companyId: company.id, addonGroupId: extras.id, name: "Bacon extra", price: 5 },
        { companyId: company.id, addonGroupId: extras.id, name: "Cheddar extra", price: 4 },
        { companyId: company.id, addonGroupId: extras.id, name: "Carne extra", price: 9 }
      ]
    });

    await prisma.product.create({
      data: {
        companyId: company.id,
        categoryId: bebidas.id,
        name: "Coca lata",
        price: 7
      }
    });
  }

  if ((await prisma.deliveryPerson.count({ where: { companyId: company.id } })) === 0) {
    await prisma.deliveryPerson.create({
      data: {
        companyId: company.id,
        name: "Motoboy Exemplo",
        phone: "11988887777",
        whatsapp: "11988887777",
        vehicleType: "motorcycle",
        plate: "ABC1D23",
        available: true
      }
    });
  }

  if ((await prisma.deliveryZone.count({ where: { companyId: company.id } })) === 0) {
    await prisma.deliveryZone.create({
      data: {
        companyId: company.id,
        name: "Centro",
        neighborhood: "Centro",
        deliveryFee: 8,
        estimatedDeliveryTimeMinutes: 45
      }
    });
  }

  if ((await prisma.faq.count({ where: { companyId: company.id } })) === 0) {
    await prisma.faq.createMany({
      data: [
        {
          companyId: company.id,
          question: "Qual o horario de funcionamento?",
          answer: "Atendemos todos os dias das 18h as 23h.",
          category: "horarios"
        },
        {
          companyId: company.id,
          question: "Quais formas de pagamento aceitam?",
          answer: "Aceitamos Pix, dinheiro e cartao na entrega.",
          category: "pagamento"
        }
      ]
    });
  }

  if ((await prisma.printer.count({ where: { companyId: company.id } })) === 0) {
    await prisma.printer.create({
      data: {
        companyId: company.id,
        name: "Cozinha",
        printerType: "windows",
        connectionType: "local_agent",
        paperWidth: "mm80",
        defaultForKitchen: true,
        defaultForDelivery: true,
        defaultForOrders: true
      }
    });
  }

  if ((await prisma.whatsappConnection.count({ where: { companyId: company.id } })) === 0) {
    await prisma.whatsappConnection.create({
      data: {
        companyId: company.id,
        name: "WhatsApp Restaurante",
        channel: "whatsapp",
        provider: "native",
        status: "DISCONNECTED",
        isDefault: true,
        greetingMessage: "Ola! Bem-vindo ao Restaurante Delivery Exemplo."
      }
    });
  }

  return company;
}

async function seedBarbershop() {
  const company = await prisma.company.upsert({
    where: { slug: "barbearia-exemplo" },
    update: {},
    create: {
      name: "Barbearia Exemplo",
      slug: "barbearia-exemplo",
      segment: "barbershop",
      phone: "1144445555",
      whatsapp: "11977776666",
      email: "barbearia@example.com",
      city: "Sao Paulo",
      state: "SP",
      botEnabled: true
    }
  });

  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      acceptOrders: false,
      acceptAppointments: true,
      allowScheduling: true
    }
  });

  await prisma.botSettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      tone: "neutral",
      greetingMessage: "Ola! Vamos agendar seu horario?",
      confirmAppointmentBeforeFinish: true
    }
  });

  await ensureModules(company.id, {
    menu: false,
    orders: false,
    deliveries: false,
    printing: false,
    coupons: false
  });

  if ((await prisma.service.count({ where: { companyId: company.id } })) === 0) {
    const corte = await prisma.service.create({
      data: {
        companyId: company.id,
        name: "Corte masculino",
        description: "Corte com finalizacao",
        price: 45,
        durationMinutes: 40
      }
    });

    const profissional = await prisma.professional.create({
      data: {
        companyId: company.id,
        name: "Joao Barbeiro",
        phone: "11966665555",
        whatsapp: "11966665555"
      }
    });

    await prisma.professionalService.create({
      data: {
        companyId: company.id,
        serviceId: corte.id,
        professionalId: profissional.id
      }
    });

    await prisma.professionalAvailability.createMany({
      data: [1, 2, 3, 4, 5].map(day => ({
        companyId: company.id,
        professionalId: profissional.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00"
      }))
    });
  }

  if ((await prisma.faq.count({ where: { companyId: company.id } })) === 0) {
    await prisma.faq.create({
      data: {
        companyId: company.id,
        question: "Precisa agendar?",
        answer: "Sim, recomendamos agendar para garantir horario.",
        category: "agenda"
      }
    });
  }

  return company;
}

async function main() {
  const adminPassword = String(process.env.SEED_ADMIN_PASSWORD || "");
  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD deve ser definida com pelo menos 12 caracteres.");
  }
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || "admin@example.invalid");
  const passwordHash = await hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "super_admin", active: true },
    create: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash,
      role: "super_admin",
      permissions: {
        "*": true
      },
      active: true
    }
  });

  if (process.env.SEED_DEMO_DATA !== "true") return;

  const restaurant = await seedRestaurant();
  await seedBarbershop();

  const adminHash = await hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: "restaurante@example.com" },
    update: {},
    create: {
      companyId: restaurant.id,
      name: "Admin Restaurante",
      email: "restaurante@example.com",
      passwordHash: adminHash,
      role: "company_admin",
      permissions: {
        "users:view": true,
        "connections:view": true,
        "orders:view": true,
        "deliveries:view": true,
        "menu:view": true
      },
      active: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
