import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { RequestWithUser } from "./types";

const defaultCompanyModules = [
  ["connections", "WhatsApp", "Conexoes e atendimento WhatsApp"],
  ["chat", "Chat/Tickets", "Conversas, tickets e envio para n8n"],
  ["orders", "Pedidos", "Pedidos, mesas e tela do garcom"],
  ["deliveries", "Entregas", "Motoboys, rotas e entregas"],
  ["menu", "Cardapio", "Categorias, produtos, adicionais e sabores"],
  ["payments", "Financeiro", "Formas de pagamento e historico financeiro"],
  ["printing", "Impressao", "Impressoras e fila de impressao"],
  ["users", "Usuarios", "Usuarios da empresa"],
  ["customers", "Clientes", "Cadastro e historico de clientes"],
  ["services", "Servicos", "Servicos para barbearia e agenda"],
  ["appointments", "Agendamentos", "Agenda e profissionais"],
  ["coupons", "Cupons", "Cupons e promocoes"],
  ["knowledge", "Base de conhecimento", "FAQ e base usada pela IA"],
  ["bot", "Automacoes", "Mensagens automaticas e regras do bot"]
] as const;

const defaultPaymentMethods = [
  { name: "Dinheiro", type: "cash" },
  { name: "Pix", type: "pix" },
  { name: "Cartao de credito", type: "credit_card" },
  { name: "Cartao de debito", type: "debit_card" }
] as const;

const companyFields = [
  "name",
  "slug",
  "segment",
  "document",
  "logoUrl",
  "phone",
  "whatsapp",
  "email",
  "address",
  "city",
  "state",
  "zipCode",
  "billingName",
  "billingDocument",
  "billingEmail",
  "billingPhone",
  "billingStreet",
  "billingNumber",
  "billingNeighborhood",
  "billingComplement",
  "billingCity",
  "billingState",
  "billingZipCode",
  "active",
  "plan",
  "botEnabled",
  "ticketzBaseUrl",
  "ticketzCompanyId",
  "ticketzWhatsappId",
  "ticketzQueueId",
  "ticketzApiToken",
  "n8nWebhookUrl",
  "webhookSecret"
];

const settingsFields = [
  "timezone",
  "currency",
  "defaultLanguage",
  "acceptOrders",
  "acceptAppointments",
  "allowDelivery",
  "allowPickup",
  "allowScheduling",
  "minimumOrderValue",
  "deliveryFeeDefault",
  "preparationTimeMinutes",
  "autoAcceptOrders",
  "requireHumanConfirmationBeforeFinish",
  "orderAcceptedMessageTemplate",
  "orderOutForDeliveryMessageTemplate",
  "orderReadyMessageTemplate"
];

const botSettingsFields = [
  "tone",
  "useEmojis",
  "greetingMessage",
  "outOfHoursMessage",
  "humanHandoffMessage",
  "askCustomerName",
  "askCustomerLocation",
  "askCustomerAddress",
  "confirmOrderBeforeFinish",
  "confirmAppointmentBeforeFinish",
  "transferToHumanWhenUnknown",
  "humanHandoffKeywords",
  "maxBotInteractionsBeforeHandoff",
  "autoCloseAfterMinutes"
];

const booleanFields = new Set([
  "active",
  "botEnabled",
  "acceptOrders",
  "acceptAppointments",
  "allowDelivery",
  "allowPickup",
  "allowScheduling",
  "autoAcceptOrders",
  "requireHumanConfirmationBeforeFinish",
  "useEmojis",
  "askCustomerName",
  "askCustomerLocation",
  "askCustomerAddress",
  "confirmOrderBeforeFinish",
  "confirmAppointmentBeforeFinish",
  "transferToHumanWhenUnknown"
]);

const numberFields = new Set([
  "minimumOrderValue",
  "deliveryFeeDefault",
  "preparationTimeMinutes",
  "maxBotInteractionsBeforeHandoff",
  "autoCloseAfterMinutes"
]);

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function slugify(value: unknown) {
  return String(value || "empresa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "empresa";
}

function cleanBaseUrl(value: unknown) {
  return String(value || "").trim().replace(/\/backend\/?$/, "").replace(/\/$/, "");
}

function n8nWebhookBaseUrl() {
  return cleanBaseUrl(
    process.env.N8N_WEBHOOK_BASE_URL ||
      process.env.N8N_WEBHOOK_URL ||
      process.env.WEBHOOK_URL ||
      "https://n8n.correacloud.com.br"
  );
}

function workflowPath(company: { id: string; slug: string }, ticketzCompanyId?: string | number) {
  return `vib/recepcao/${slugify(company.slug)}/${ticketzCompanyId || company.id}/ticketz`;
}

function webhookUrlForCompany(company: { id: string; slug: string }, ticketzCompanyId?: string | number) {
  return `${n8nWebhookBaseUrl()}/webhook/${workflowPath(company, ticketzCompanyId)}`;
}

function saasPublicApiUrl() {
  return cleanBaseUrl(process.env.PUBLIC_API_URL || process.env.SAAS_API_URL || "https://saas.correacloud.com.br");
}

function pickData(body: Record<string, unknown>, fields: string[], options: { allowNull?: boolean } = {}) {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === undefined) continue;
    if (raw === "" || raw === null) {
      if (options.allowNull) data[field] = null;
      continue;
    }
    if (booleanFields.has(field)) data[field] = Boolean(raw === true || raw === "true");
    else if (numberFields.has(field)) data[field] = Number(raw);
    else data[field] = raw;
  }
  return data;
}

@UseGuards(AuthGuard)
@Controller("api/companies")
export class CompaniesController {
  constructor(
    private readonly app: AppService,
    private readonly prisma: PrismaService
  ) {}

  private assertCompanyScope(id: string, req: RequestWithUser) {
    if (req.user?.role !== UserRole.super_admin && req.user?.companyId !== id) {
      throw new ForbiddenException("Empresa fora do escopo do usuario.");
    }
  }

  private async companyWithSetup(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: { settings: true, botSettings: true }
    });
  }

  private n8nWorkflow(company: any, webhookPath: string, webhookSecret: string) {
    const apiUrl = saasPublicApiUrl();
    const bookingLink = `${apiUrl}/cliente/${company.publicId || company.slug}`;
    const defaultReply =
      company.segment === "barbershop"
        ? `Ola! Para escolher servico, barbeiro e um horario livre, acesse: ${bookingLink}\n\nSe tiver alguma duvida sobre os servicos, pode falar comigo por aqui.`
        : "Recebi sua mensagem. Um atendente vai continuar o atendimento por aqui.";
    return {
      name: `Vib - ${company.name} - Recepcao IA`,
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: webhookPath,
            responseMode: "lastNode",
            options: {}
          },
          id: "company-webhook",
          name: "Entrada Ticketz",
          type: "n8n-nodes-base.webhook",
          typeVersion: 2,
          position: [220, 300],
          webhookId: `vib-${company.id}`
        },
        {
          parameters: {
            jsCode: `
const input = $input.first().json;
const event = {
  event: "ticketz.message.received",
  receivedAt: new Date().toISOString(),
  company: {
    id: "${company.id}",
    name: ${JSON.stringify(company.name)},
    slug: ${JSON.stringify(company.slug)},
    segment: ${JSON.stringify(company.segment)}
  },
  ticket: input.ticket,
  customer: input.customer,
  message: input.message,
  raw: input
};

let vib = { sent: false };
try {
  vib = await this.helpers.httpRequest({
    method: "POST",
    url: "${apiUrl}/api/n8n/events",
    headers: { "Content-Type": "application/json" },
    body: event,
    json: true
  });
} catch (error) {
  vib = { sent: false, error: error.message };
}

return [{
  json: {
    ok: true,
    vib,
    output: [
      {
        type: "message",
        text: ${JSON.stringify(defaultReply)}
      }
    ]
  }
}];
`
          },
          id: "company-router",
          name: "Registrar evento no SaaS",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [540, 300]
        }
      ],
      connections: {
        "Entrada Ticketz": {
          main: [[{ node: "Registrar evento no SaaS", type: "main", index: 0 }]]
        }
      },
      settings: { executionOrder: "v1" },
      staticData: {
        vibCompanyId: company.id,
        vibCompanySlug: company.slug,
        vibWebhookSecret: webhookSecret
      }
    };
  }

  private async provisionN8n(company: any, webhookPathValue: string, webhookSecret: string) {
    const apiKey = String(process.env.N8N_API_KEY || "").trim();
    const apiBaseUrl = cleanBaseUrl(process.env.N8N_API_BASE_URL || n8nWebhookBaseUrl());
    const webhookUrl = `${n8nWebhookBaseUrl()}/webhook/${webhookPathValue}`;

    if (!apiKey) {
      return {
        created: false,
        configured: false,
        webhookUrl,
        reason: "N8N_API_KEY nao configurada no SaaS."
      };
    }

    const headers = {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey
    };
    const workflowPayload = this.n8nWorkflow(company, webhookPathValue, webhookSecret);
    const searchResponse = await fetch(`${apiBaseUrl}/api/v1/workflows?name=${encodeURIComponent(workflowPayload.name)}&limit=20`, {
      headers
    });
    const searchData = await searchResponse.json().catch(() => null);
    const existingWorkflow = Array.isArray(searchData?.data)
      ? searchData.data.find((workflow: any) => workflow.name === workflowPayload.name && !workflow.isArchived)
      : null;

    let data: any = null;
    let created = false;
    let updated = false;
    if (existingWorkflow?.id) {
      const updateResponse = await fetch(`${apiBaseUrl}/api/v1/workflows/${existingWorkflow.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(workflowPayload)
      });
      data = await updateResponse.json().catch(() => null);
      if (!updateResponse.ok) {
        return {
          created: false,
          updated: false,
          configured: true,
          webhookUrl,
          error: data?.message || data?.error || `n8n update retornou ${updateResponse.status}`
        };
      }
      updated = true;
    } else {
      const createResponse = await fetch(`${apiBaseUrl}/api/v1/workflows`, {
        method: "POST",
        headers,
        body: JSON.stringify(workflowPayload)
      });
      data = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        return {
          created: false,
          updated: false,
          configured: true,
          webhookUrl,
          error: data?.message || data?.error || `n8n retornou ${createResponse.status}`
        };
      }
      created = true;
    }

    if (!data?.id) {
      return {
        created: false,
        updated,
        configured: true,
        webhookUrl,
        error: "n8n nao retornou id do workflow."
      };
    }

    let activated = Boolean(data?.active || data?.activeVersionId);
    let activationError: string | null = null;
    if (data?.id && !activated) {
      const activateResponse = await fetch(`${apiBaseUrl}/api/v1/workflows/${data.id}/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          versionId: data.versionId,
          name: data.name,
          description: data.description || ""
        })
      });
      const activateData = await activateResponse.json().catch(() => null);
      if (activateResponse.ok) {
        activated = Boolean(activateData?.active || activateData?.activeVersionId || activateData?.id);
      } else {
        activationError = activateData?.message || activateData?.error || `n8n activate retornou ${activateResponse.status}`;
      }
    }

    return {
      created,
      updated,
      configured: true,
      activated,
      webhookUrl,
      workflow: { id: data?.id, name: data?.name, active: data?.active, versionId: data?.versionId },
      ...(activationError ? { activationError } : {})
    };
  }

  private async provisionTicketz(company: any, n8nWebhookUrl: string, ticketzCompanyId?: string | number) {
    const baseUrl = cleanBaseUrl(company.ticketzBaseUrl || process.env.TICKETZ_BASE_URL);
    const token = String(process.env.TICKETZ_PROVISION_TOKEN || process.env.TICKETZ_API_TOKEN || "").trim();
    if (!baseUrl) throw new BadRequestException("TICKETZ_BASE_URL nao configurado.");
    if (!token) throw new BadRequestException("TICKETZ_PROVISION_TOKEN/TICKETZ_API_TOKEN nao configurado.");

    const response = await fetch(`${baseUrl}/backend/saas/provision-company`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Saas-Provision-Token": token
      },
      body: JSON.stringify({
        saasCompanyId: company.id,
        ticketzCompanyId,
        name: company.name,
        slug: company.slug,
        phone: company.phone,
        whatsapp: company.whatsapp,
        email: company.email,
        segment: company.segment,
        n8nWebhookUrl
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BadRequestException(data?.message || data?.error || `Ticketz retornou ${response.status}`);
    }
    return { baseUrl, data };
  }

  private async provisionIntegrations(id: string, req: RequestWithUser) {
    if (req.user?.role !== UserRole.super_admin) {
      throw new ForbiddenException("Apenas super admin pode provisionar integracoes.");
    }

    const company = await this.companyWithSetup(id);
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

    const webhookSecret = company.webhookSecret || randomBytes(24).toString("hex");
    const finalWebhookPath = workflowPath(company, company.id);
    const finalN8nUrl = `${n8nWebhookBaseUrl()}/webhook/${finalWebhookPath}`;
    const n8n = await this.provisionN8n(company, finalWebhookPath, webhookSecret);

    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        n8nWebhookUrl: finalN8nUrl,
        webhookSecret
      },
      include: { settings: true, botSettings: true }
    });

    const existingConnection = await this.prisma.whatsappConnection.findFirst({
      where: { companyId: company.id, isDefault: true, channel: "whatsapp" }
    });
    const whatsapp = existingConnection || await this.prisma.whatsappConnection.create({
      data: {
        companyId: company.id,
        name: updated.name,
        status: "DISCONNECTED",
        provider: "native",
        channel: "whatsapp",
        isDefault: true
      }
    });

    return {
      ok: true,
      company: updated,
      whatsapp,
      n8n
    };
  }

  @Post()
  async createCompany(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    if (req.user?.role !== UserRole.super_admin) {
      throw new ForbiddenException("Apenas super admin pode criar empresas.");
    }

    const name = cleanText(body.name);
    if (!name) throw new BadRequestException("Nome da empresa obrigatorio.");

    const companyData = pickData(body, companyFields);
    companyData.name = name;
    companyData.slug = slugify(companyData.slug || name);
    companyData.segment = companyData.segment || "restaurant";
    companyData.active = companyData.active ?? true;
    companyData.plan = companyData.plan || "starter";

    const settingsInput = (body.settings || {}) as Record<string, unknown>;
    const botSettingsInput = (body.botSettings || {}) as Record<string, unknown>;
    const adminInput = (body.adminUser || {}) as Record<string, unknown>;
    const adminEmail = cleanText(adminInput.email);

    const company = await this.prisma.$transaction(async tx => {
      const created = await tx.company.create({ data: companyData as any });

      await tx.companySettings.create({
        data: {
          companyId: created.id,
          timezone: "America/Sao_Paulo",
          currency: "BRL",
          defaultLanguage: "pt-BR",
          acceptOrders: true,
          allowDelivery: true,
          allowPickup: true,
          allowScheduling: true,
          preparationTimeMinutes: 30,
          ...pickData(settingsInput, settingsFields)
        } as any
      });

      await tx.botSettings.create({
        data: {
          companyId: created.id,
          tone: "friendly",
          useEmojis: true,
          greetingMessage: "Ola! Como posso ajudar?",
          outOfHoursMessage: "No momento estamos fechados. Assim que abrirmos, seguimos seu atendimento.",
          humanHandoffMessage: "Vou chamar um atendente humano para continuar com voce.",
          ...pickData(botSettingsInput, botSettingsFields)
        } as any
      });

      await tx.companyModule.createMany({
        data: defaultCompanyModules.map(([moduleKey, moduleName, description]) => ({
          companyId: created.id,
          moduleKey,
          name: moduleName,
          description,
          active: true
        })),
        skipDuplicates: true
      });

      await tx.paymentMethod.createMany({
        data: defaultPaymentMethods.map(method => ({
          companyId: created.id,
          name: method.name,
          type: method.type as any,
          active: true
        })),
        skipDuplicates: true
      });

      if (adminEmail) {
        const password = String(cleanText(adminInput.password) || "");
        if (password.length < 8) {
          throw new BadRequestException("Informe uma senha inicial de administrador com pelo menos 8 caracteres.");
        }
        await tx.user.create({
          data: {
            companyId: created.id,
            name: cleanText(adminInput.name) || name,
            email: adminEmail,
            phone: cleanText(adminInput.phone),
            role: UserRole.company_admin,
            active: true,
            passwordHash: await hash(password, 10)
          }
        });
      }

      return created;
    });

    const saved = await this.companyWithSetup(company.id);
    if (body.provisionIntegrations === false) return saved;

    try {
      const provisioning = await this.provisionIntegrations(company.id, req);
      return { ...provisioning.company, provisioning };
    } catch (err) {
      return {
        ...saved,
        provisioning: {
          ok: false,
          error: err instanceof Error ? err.message : "Erro ao provisionar Ticketz/n8n."
        }
      };
    }
  }

  @Post(":id/provision-integrations")
  provisionCompanyIntegrations(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.provisionIntegrations(id, req);
  }

  @Put(":id/setup")
  async setup(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    this.assertCompanyScope(id, req);

    const companyData = pickData(body, companyFields, { allowNull: true });
    if (req.user?.role !== UserRole.super_admin) {
      delete companyData.active;
      delete companyData.plan;
      delete companyData.ticketzApiToken;
    }
    if (companyData.slug) companyData.slug = slugify(companyData.slug);

    const settingsInput = (body.settings || {}) as Record<string, unknown>;
    const settingsData = pickData(settingsInput, settingsFields, { allowNull: true });
    const botSettingsInput = (body.botSettings || {}) as Record<string, unknown>;
    const botSettingsData = pickData(botSettingsInput, botSettingsFields, { allowNull: true });

    await this.prisma.$transaction(async tx => {
      if (Object.keys(companyData).length) {
        await tx.company.update({ where: { id }, data: companyData as any });
      }
      if (Object.keys(settingsData).length) {
        await tx.companySettings.upsert({
          where: { companyId: id },
          create: { companyId: id, ...settingsData } as any,
          update: settingsData as any
        });
      }
      if (Object.keys(botSettingsData).length) {
        await tx.botSettings.upsert({
          where: { companyId: id },
          create: { companyId: id, ...botSettingsData } as any,
          update: botSettingsData as any
        });
      }
    });

    return this.companyWithSetup(id);
  }

  @Get(":id/context")
  context(@Param("id") id: string) {
    return this.app.context(id);
  }

  @Get(":id/ai-prompt")
  prompt(@Param("id") id: string) {
    return this.app.aiPrompt(id);
  }

  @Put(":id/order-acceptance")
  async orderAcceptance(
    @Param("id") id: string,
    @Body() body: { acceptOrders?: boolean },
    @Req() req: RequestWithUser
  ) {
    this.assertCompanyScope(id, req);

    await this.prisma.companySettings.upsert({
      where: { companyId: id },
      create: {
        companyId: id,
        acceptOrders: Boolean(body.acceptOrders)
      },
      update: {
        acceptOrders: Boolean(body.acceptOrders)
      }
    });

    return this.prisma.company.findUnique({
      where: { id },
      include: { settings: true }
    });
  }

  @Put(":id/message-templates")
  async messageTemplates(
    @Param("id") id: string,
    @Body()
    body: {
      orderAcceptedMessageTemplate?: string;
      orderOutForDeliveryMessageTemplate?: string;
      orderReadyMessageTemplate?: string;
    },
    @Req() req: RequestWithUser
  ) {
    this.assertCompanyScope(id, req);

    const data = {
      orderAcceptedMessageTemplate: body.orderAcceptedMessageTemplate?.trim() || null,
      orderOutForDeliveryMessageTemplate: body.orderOutForDeliveryMessageTemplate?.trim() || null,
      orderReadyMessageTemplate: body.orderReadyMessageTemplate?.trim() || null
    };

    await this.prisma.companySettings.upsert({
      where: { companyId: id },
      create: {
        companyId: id,
        ...data
      },
      update: data
    });

    return this.prisma.company.findUnique({
      where: { id },
      include: { settings: true, botSettings: true }
    });
  }

  @Get(":id/menu")
  menu(@Param("id") id: string) {
    return this.prisma.menuCategory.findMany({
      where: { companyId: id, active: true },
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
      },
      orderBy: { sortOrder: "asc" }
    });
  }

  @Get(":id/services")
  services(@Param("id") id: string) {
    return this.prisma.service.findMany({
      where: { companyId: id, active: true },
      orderBy: { name: "asc" }
    });
  }
}
