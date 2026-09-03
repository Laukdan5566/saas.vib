import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from "@nestjs/common";
import { BillingInvoiceStatus, BillingProvider, Prisma, UserRole } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { URL } from "node:url";
import { PrismaService } from "./prisma.service";
import { AuthUser } from "./types";
import { billingAmounts } from "./billing-amounts";

type AnyRecord = Record<string, any>;
type EfiRuntimeConfig = {
  environment: "homologation" | "production";
  pixBaseUrl: string;
  chargesBaseUrl: string;
  clientId: string;
  clientSecret: string;
  certPath?: string;
  certPassphrase: string;
  pixKey?: string;
};

@Injectable()
export class BillingService implements OnModuleInit {
  private billingCycleRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.BILLING_AUTOMATION_ENABLED === "false") return;
    const interval = Number(process.env.BILLING_AUTOMATION_INTERVAL_MS || 60 * 60 * 1000);
    setTimeout(() => void this.processBillingCycle().catch(error => console.error("[billing-cycle]", error)), 15_000);
    setInterval(() => void this.processBillingCycle().catch(error => console.error("[billing-cycle]", error)), interval);
  }

  private requireSuperAdmin(user: AuthUser) {
    if (user.role !== UserRole.super_admin) {
      throw new ForbiddenException("Apenas super admin pode gerenciar cobrancas da plataforma.");
    }
  }

  private scopedCompanyId(user: AuthUser, companyId?: string | null) {
    if (user.role === UserRole.super_admin) return companyId || undefined;
    return user.companyId || "__none__";
  }

  private async getInvoiceOrThrow(id: string, user: AuthUser) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: {
        id,
        ...(user.role === UserRole.super_admin ? {} : { companyId: user.companyId || "__none__" })
      },
      include: { company: true, plan: true, subscription: true }
    });

    if (!invoice) throw new NotFoundException("Fatura nao encontrada.");
    return invoice;
  }

  private normalizeDate(value: unknown) {
    if (!value) return undefined;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Data invalida.");
    return date;
  }

  private money(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new BadRequestException("Valor da cobranca deve ser maior que zero.");
    }
    return number.toFixed(2);
  }

  private moneyToCents(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new BadRequestException("Valor da cobranca deve ser maior que zero.");
    }
    return Math.round(number * 100);
  }

  private text(value: unknown) {
    return String(value || "").trim();
  }

  private onlyDigits(value: unknown) {
    return this.text(value).replace(/\D/g, "");
  }

  private localPhone(value: unknown) {
    const digits = this.onlyDigits(value);
    return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  }

  private dateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private publicWebhookUrl(path: string) {
    if (process.env.EFI_CHARGES_NOTIFICATION_URL && path.includes("charges")) {
      return process.env.EFI_CHARGES_NOTIFICATION_URL;
    }
    const configured = String(
      process.env.PUBLIC_API_URL ||
        process.env.SAAS_PUBLIC_URL ||
        process.env.FRONTEND_PUBLIC_URL ||
        "https://saas.correacloud.com.br"
    ).replace(/\/+$/, "");
    const base = configured.endsWith("/api") ? configured.slice(0, -4) : configured;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private boletoCustomer(company: AnyRecord) {
    const name = this.text(company.billingName || company.name);
    const document = this.onlyDigits(company.billingDocument || company.document);
    const email = this.text(company.billingEmail || company.email);
    const phone = this.localPhone(company.billingPhone || company.phone || company.whatsapp);
    const street = this.text(company.billingStreet || company.address);
    const number = this.text(company.billingNumber);
    const neighborhood = this.text(company.billingNeighborhood);
    const zipcode = this.onlyDigits(company.billingZipCode || company.zipCode);
    const city = this.text(company.billingCity || company.city);
    const state = this.text(company.billingState || company.state).toUpperCase();
    const complement = this.text(company.billingComplement);

    const missing: string[] = [];
    if (!name) missing.push("nome/razao social de cobranca");
    if (![11, 14].includes(document.length)) missing.push("CPF ou CNPJ de cobranca valido");
    if (!email) missing.push("email de cobranca");
    if (phone.length < 10 || phone.length > 11) missing.push("telefone de cobranca com DDD");
    if (!street) missing.push("rua de cobranca");
    if (!number) missing.push("numero de cobranca");
    if (!neighborhood) missing.push("bairro de cobranca");
    if (zipcode.length !== 8) missing.push("CEP de cobranca com 8 digitos");
    if (!city) missing.push("cidade de cobranca");
    if (state.length !== 2) missing.push("UF de cobranca com 2 letras");

    if (missing.length) {
      throw new BadRequestException(`Complete os dados de cobranca da empresa antes de gerar boleto: ${missing.join(", ")}.`);
    }

    const customer: AnyRecord = {
      email,
      phone_number: phone,
      address: {
        street,
        number,
        neighborhood,
        zipcode,
        city,
        complement,
        state
      }
    };

    if (document.length === 14) {
      customer.juridical_person = {
        corporate_name: name,
        cnpj: document
      };
    } else {
      customer.name = name;
      customer.cpf = document;
    }

    return customer;
  }

  private graceDays() {
    return Math.max(0, Number(process.env.BILLING_GRACE_DAYS || 7));
  }

  private generateDaysAhead() {
    return Math.max(0, Number(process.env.BILLING_GENERATE_DAYS_AHEAD || 0));
  }

  private dayStart(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private dayEnd(date: Date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
  }

  private activeInvoiceStatuses(): BillingInvoiceStatus[] {
    return [
      BillingInvoiceStatus.open,
      BillingInvoiceStatus.pending,
      BillingInvoiceStatus.overdue,
      BillingInvoiceStatus.failed
    ];
  }

  private formatMoney(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "valor informado";
  }

  private duplicateInvoiceMessage(invoice: { value: unknown; dueDate: Date }) {
    return `Ja existe uma fatura em aberto para esta empresa com ${this.formatMoney(invoice.value)} e vencimento ${this.dateOnly(invoice.dueDate)}. Use a fatura existente ou cancele antes de gerar outra.`;
  }

  private async findActiveDuplicateInvoice(companyId: string, value: string, dueDate: Date, excludeId?: string) {
    const where: Prisma.BillingInvoiceWhereInput = {
      companyId,
      value,
      dueDate: {
        gte: this.dayStart(dueDate),
        lte: this.dayEnd(dueDate)
      },
      status: { in: this.activeInvoiceStatuses() }
    };
    if (excludeId) where.id = { not: excludeId };

    return this.prisma.billingInvoice.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      include: { company: true, plan: true, subscription: true }
    });
  }

  private addCycle(date: Date, cycle: string) {
    const next = new Date(date);
    const months = cycle === "annual" ? 12 : cycle === "semiannual" ? 6 : cycle === "quarterly" ? 3 : 1;
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private periodLabel(date: Date) {
    return date.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
  }

  private planSlug(name: string, fallback?: string) {
    const source = fallback || name;
    return source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || randomUUID();
  }

  private encryptionKey() {
    return createHash("sha256")
      .update(process.env.BILLING_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-secret")
      .digest();
  }

  private encryptSecret(value?: string | null) {
    const text = String(value || "");
    if (!text) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  private decryptSecret(value?: string | null) {
    if (!value) return "";
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) return "";
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  private certBaseDir() {
    return process.env.EFI_SECRETS_DIR || "/app/secrets/efi";
  }

  async listPlans() {
    return this.prisma.platformPlan.findMany({ orderBy: [{ active: "desc" }, { price: "asc" }] });
  }

  async createPlan(data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const name = String(data.name || "").trim();
    if (!name) throw new BadRequestException("Informe o nome do plano.");

    return this.prisma.platformPlan.create({
      data: {
        name,
        slug: this.planSlug(name, data.slug ? String(data.slug) : undefined),
        description: data.description ? String(data.description) : null,
        price: this.money(data.price),
        currency: String(data.currency || "BRL"),
        billingCycle: data.billingCycle || "monthly",
        maxUsers: data.maxUsers === "" || data.maxUsers == null ? null : Number(data.maxUsers),
        maxWhatsapp: data.maxWhatsapp === "" || data.maxWhatsapp == null ? null : Number(data.maxWhatsapp),
        maxCompanies: data.maxCompanies === "" || data.maxCompanies == null ? null : Number(data.maxCompanies),
        enabledModules: data.enabledModules || undefined,
        active: data.active !== false,
        public: Boolean(data.public)
      }
    });
  }

  async updatePlan(id: string, data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const current = await this.prisma.platformPlan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Plano nao encontrado.");

    const update: Prisma.PlatformPlanUpdateInput = {};
    if (data.name !== undefined) update.name = String(data.name).trim();
    if (data.slug !== undefined) update.slug = this.planSlug(String(data.slug));
    if (data.description !== undefined) update.description = data.description ? String(data.description) : null;
    if (data.price !== undefined) update.price = this.money(data.price);
    if (data.currency !== undefined) update.currency = String(data.currency || "BRL");
    if (data.billingCycle !== undefined) update.billingCycle = data.billingCycle;
    if (data.maxUsers !== undefined) update.maxUsers = data.maxUsers === "" || data.maxUsers == null ? null : Number(data.maxUsers);
    if (data.maxWhatsapp !== undefined) update.maxWhatsapp = data.maxWhatsapp === "" || data.maxWhatsapp == null ? null : Number(data.maxWhatsapp);
    if (data.maxCompanies !== undefined) update.maxCompanies = data.maxCompanies === "" || data.maxCompanies == null ? null : Number(data.maxCompanies);
    if (data.enabledModules !== undefined) update.enabledModules = data.enabledModules || Prisma.JsonNull;
    if (data.active !== undefined) update.active = Boolean(data.active);
    if (data.public !== undefined) update.public = Boolean(data.public);

    return this.prisma.platformPlan.update({ where: { id }, data: update });
  }

  async listSubscriptions(user: AuthUser, companyId?: string) {
    this.requireSuperAdmin(user);
    return this.prisma.companySubscription.findMany({
      where: companyId ? { companyId } : {},
      include: { company: true, plan: true },
      orderBy: { updatedAt: "desc" }
    });
  }

  async mySubscription(user: AuthUser, companyId?: string) {
    const scopedCompanyId = this.scopedCompanyId(user, companyId);
    if (!scopedCompanyId) throw new BadRequestException("Empresa nao informada.");

    return this.prisma.companySubscription.findUnique({
      where: { companyId: scopedCompanyId },
      include: { company: true, plan: true }
    });
  }

  async upsertSubscription(data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const companyId = String(data.companyId || "");
    if (!companyId) throw new BadRequestException("Informe a empresa.");

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

    return this.prisma.companySubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: data.planId || null,
        status: data.status || "active",
        startsAt: this.normalizeDate(data.startsAt) || new Date(),
        currentPeriodStart: this.normalizeDate(data.currentPeriodStart),
        currentPeriodEnd: this.normalizeDate(data.currentPeriodEnd),
        nextDueDate: this.normalizeDate(data.nextDueDate),
        paymentMethodPreference: data.paymentMethodPreference || null,
        notes: data.notes ? String(data.notes) : null
      },
      update: {
        planId: data.planId || null,
        status: data.status || "active",
        currentPeriodStart: this.normalizeDate(data.currentPeriodStart),
        currentPeriodEnd: this.normalizeDate(data.currentPeriodEnd),
        nextDueDate: this.normalizeDate(data.nextDueDate),
        paymentMethodPreference: data.paymentMethodPreference || null,
        notes: data.notes ? String(data.notes) : null
      },
      include: { company: true, plan: true }
    });
  }

  async listInvoices(user: AuthUser, companyId?: string) {
    const scopedCompanyId = this.scopedCompanyId(user, companyId);
    const invoices = await this.prisma.billingInvoice.findMany({
      where: scopedCompanyId ? { companyId: scopedCompanyId } : {},
      include: { company: true, plan: true, subscription: true },
      orderBy: { dueDate: "desc" },
      take: 200
    });
    return invoices.map(invoice => this.invoiceForPayment(invoice));
  }

  private invoiceForPayment(invoice: any) {
    const amounts = billingAmounts(invoice);
    const payload = invoice.providerPayload as AnyRecord | null;
    const calendar = payload?.charge?.calendario;
    const expiresAt = calendar ? Date.parse(calendar.criacao) + Number(calendar.expiracao) * 1000 : NaN;
    const pixExpired = invoice.paymentMethod === "pix" && Boolean(invoice.txId) &&
      (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || Number(payload?.charge?.valor?.original) !== amounts.payableValue);
    return {
      ...invoice, ...amounts,
      status: amounts.daysLate ? "overdue" : invoice.status,
      pixExpired,
      ...(pixExpired ? { paymentUrl: null, pixCopyPaste: null, pixQrCodeImage: null } : {})
    };
  }

  async billingConfig(user: AuthUser) {
    this.requireSuperAdmin(user);
    const dbConfigs = await this.prisma.billingGatewayConfig.findMany({
      where: { provider: "efi" }
    });
    const activeDbConfig = dbConfigs.find(config => config.active);
    const env = String(activeDbConfig?.environment || process.env.EFI_ENV || "homologation").toLowerCase();
    const production = ["prod", "production", "producao"].includes(env);
    const describe = (environment: "homologation" | "production") => {
      const suffix = environment === "production" ? "PROD" : "HOMOLOG";
      const dbConfig = dbConfigs.find(config => config.environment === environment);
      const certPath = dbConfig?.certPath || process.env[`EFI_CERT_PATH_${suffix}`] || process.env.EFI_CERT_PATH || "";
      return {
        source: dbConfig ? "system" : "env",
        active: Boolean(dbConfig?.active || (environment === (production ? "production" : "homologation") && !activeDbConfig)),
        clientIdConfigured: Boolean(dbConfig?.clientId || process.env[`EFI_CLIENT_ID_${suffix}`] || process.env.EFI_CLIENT_ID),
        clientSecretConfigured: Boolean(dbConfig?.encryptedClientSecret || process.env[`EFI_CLIENT_SECRET_${suffix}`] || process.env.EFI_CLIENT_SECRET),
        pixKeyConfigured: Boolean(dbConfig?.pixKey || process.env[`EFI_PIX_KEY_${suffix}`] || process.env.EFI_PIX_KEY),
        certPath,
        certExists: Boolean(certPath && existsSync(certPath))
      };
    };

    return {
      env: production ? "production" : "homologation",
      automationEnabled: process.env.BILLING_AUTOMATION_ENABLED !== "false",
      automationIntervalMs: Number(process.env.BILLING_AUTOMATION_INTERVAL_MS || 60 * 60 * 1000),
      generateDaysAhead: this.generateDaysAhead(),
      graceDays: this.graceDays(),
      pixExpirationSeconds: Number(process.env.EFI_PIX_EXPIRATION_SECONDS || 86400),
      homologation: describe("homologation"),
      production: describe("production")
    };
  }

  async saveBillingConfig(data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const environment = data.environment === "production" ? "production" : "homologation";
    const existing = await this.prisma.billingGatewayConfig.findUnique({
      where: {
        provider_environment: {
          provider: "efi",
          environment
        }
      }
    });

    let certPath = existing?.certPath || null;
    const certDataUrl = String(data.certDataUrl || "");
    if (certDataUrl) {
      const base64 = certDataUrl.includes(",") ? certDataUrl.split(",").pop() || "" : certDataUrl;
      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) throw new BadRequestException("Certificado Efí invalido.");
      const dir = `${this.certBaseDir()}/${environment}`;
      mkdirSync(dir, { recursive: true });
      certPath = `${dir}/certificate.p12`;
      writeFileSync(certPath, buffer, { mode: 0o600 });
    }

    if (data.active !== false) {
      await this.prisma.billingGatewayConfig.updateMany({
        where: { provider: "efi", environment: { not: environment } },
        data: { active: false }
      });
    }

    const saved = await this.prisma.billingGatewayConfig.upsert({
      where: {
        provider_environment: {
          provider: "efi",
          environment
        }
      },
      create: {
        provider: "efi",
        environment,
        active: data.active !== false,
        clientId: String(data.clientId || "").trim() || null,
        encryptedClientSecret: this.encryptSecret(data.clientSecret ? String(data.clientSecret) : ""),
        pixKey: String(data.pixKey || "").trim() || null,
        certPath,
        encryptedCertPassphrase: this.encryptSecret(data.certPassphrase ? String(data.certPassphrase) : "")
      },
      update: {
        active: data.active !== false,
        clientId: data.clientId === undefined ? undefined : String(data.clientId || "").trim() || null,
        encryptedClientSecret: data.clientSecret ? this.encryptSecret(String(data.clientSecret)) : undefined,
        pixKey: data.pixKey === undefined ? undefined : String(data.pixKey || "").trim() || null,
        certPath: certPath || undefined,
        encryptedCertPassphrase: data.certPassphrase ? this.encryptSecret(String(data.certPassphrase)) : undefined
      }
    });

    return {
      ok: true,
      id: saved.id,
      config: await this.billingConfig(user)
    };
  }

  async processBillingCycle() {
    if (this.billingCycleRunning) return { ok: true, skipped: true };
    this.billingCycleRunning = true;
    try {
      const now = new Date();
      const horizon = new Date(now);
      horizon.setDate(horizon.getDate() + this.generateDaysAhead());

      const subscriptions = await this.prisma.companySubscription.findMany({
        where: {
          status: { in: ["active", "trialing"] },
          planId: { not: null },
          nextDueDate: { lte: horizon }
        },
        include: { company: true, plan: true }
      });

      let createdInvoices = 0;
      for (const subscription of subscriptions) {
        if (!subscription.plan || !subscription.nextDueDate) continue;
        const dueDate = subscription.nextDueDate;
        const existing = await this.prisma.billingInvoice.findFirst({
          where: {
            subscriptionId: subscription.id,
            dueDate: {
              gte: this.dayStart(dueDate),
              lte: this.dayEnd(dueDate)
            }
          }
        });

        if (!existing) {
          await this.prisma.billingInvoice.create({
            data: {
              companyId: subscription.companyId,
              subscriptionId: subscription.id,
              planId: subscription.planId,
              detail: `Assinatura ${subscription.plan.name} - ${this.periodLabel(dueDate)}`,
              status: "open",
              value: subscription.plan.price,
              currency: subscription.plan.currency,
              dueDate,
              paymentMethod: subscription.paymentMethodPreference || "pix"
            }
          });
          createdInvoices += 1;
        }

        await this.prisma.companySubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: subscription.currentPeriodStart || dueDate,
            currentPeriodEnd: this.addCycle(dueDate, subscription.plan.billingCycle),
            nextDueDate: this.addCycle(dueDate, subscription.plan.billingCycle)
          }
        });
      }

      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - this.graceDays());
      const overdueUpdate = await this.prisma.billingInvoice.updateMany({
        where: {
          status: { in: ["open", "pending", "failed"] },
          dueDate: { lt: this.dayStart(now) }
        },
        data: { status: "overdue" }
      });

      const overdueCompanies = await this.prisma.billingInvoice.findMany({
        where: {
          status: "overdue",
          paidAt: null,
          dueDate: { lt: this.dayStart(cutoff) }
        },
        select: { companyId: true },
        distinct: ["companyId"]
      });

      if (overdueCompanies.length) {
        await this.prisma.companySubscription.updateMany({
          where: {
            companyId: { in: overdueCompanies.map(item => item.companyId) },
            status: { in: ["active", "trialing"] }
          },
          data: { status: "past_due" }
        });
      }

      return {
        ok: true,
        createdInvoices,
        markedOverdue: overdueUpdate.count,
        blockedCompanies: overdueCompanies.length
      };
    } finally {
      this.billingCycleRunning = false;
    }
  }

  async runBillingCycle(user: AuthUser) {
    this.requireSuperAdmin(user);
    return this.processBillingCycle();
  }

  async createInvoice(data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const companyId = String(data.companyId || "");
    if (!companyId) throw new BadRequestException("Informe a empresa.");

    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true }
    });
    const plan = data.planId
      ? await this.prisma.platformPlan.findUnique({ where: { id: String(data.planId) } })
      : subscription?.plan || null;
    const detail = String(data.detail || (plan ? `Assinatura ${plan.name}` : "Assinatura da plataforma")).trim();
    const value = this.money(data.value ?? plan?.price ?? 0);
    const dueDate = this.normalizeDate(data.dueDate) || new Date();
    const duplicate = await this.findActiveDuplicateInvoice(companyId, value, dueDate);
    if (duplicate) throw new BadRequestException(this.duplicateInvoiceMessage(duplicate));

    return this.prisma.billingInvoice.create({
      data: {
        companyId,
        subscriptionId: data.subscriptionId || subscription?.id || null,
        planId: data.planId || plan?.id || null,
        detail,
        status: data.status || "open",
        value,
        currency: String(data.currency || "BRL"),
        dueDate,
        paymentMethod: data.paymentMethod || null
      },
      include: { company: true, plan: true, subscription: true }
    });
  }

  async updateInvoice(id: string, data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    await this.getInvoiceOrThrow(id, user);

    return this.prisma.billingInvoice.update({
      where: { id },
      data: {
        detail: data.detail === undefined ? undefined : String(data.detail),
        status: data.status || undefined,
        value: data.value === undefined ? undefined : this.money(data.value),
        dueDate: data.dueDate === undefined ? undefined : this.normalizeDate(data.dueDate),
        paymentMethod: data.paymentMethod === undefined ? undefined : data.paymentMethod || null
      },
      include: { company: true, plan: true, subscription: true }
    });
  }

  async markPaid(id: string, user: AuthUser) {
    this.requireSuperAdmin(user);
    const invoice = await this.getInvoiceOrThrow(id, user);
    const updated = await this.prisma.billingInvoice.update({
      where: { id },
      data: { status: "paid", paidAt: new Date(), provider: BillingProvider.manual },
      include: { company: true, plan: true, subscription: true }
    });
    await this.refreshCompanySubscriptionStatus(invoice.companyId);
    return updated;
  }

  async cancelBoleto(id: string, user: AuthUser) {
    this.requireSuperAdmin(user);
    const invoice = await this.getInvoiceOrThrow(id, user);
    if (invoice.status === "paid") throw new BadRequestException("Fatura ja esta paga.");
    if (invoice.status === "canceled") throw new BadRequestException("Fatura ja esta cancelada.");
    if (!invoice.providerChargeId) throw new BadRequestException("Fatura sem charge_id da Efi para cancelar.");

    const config = await this.efiConfig({ requirePixKey: false, requireCert: false });
    const token = await this.efiChargesToken(config);
    const cancelResponse = await this.requestJson<AnyRecord>(
      `${config.chargesBaseUrl}/v1/charge/${encodeURIComponent(invoice.providerChargeId)}/cancel`,
      {
        method: "PUT",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const previousPayload =
      invoice.providerPayload && typeof invoice.providerPayload === "object" && !Array.isArray(invoice.providerPayload)
        ? invoice.providerPayload as AnyRecord
        : {};

    const updated = await this.prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "canceled",
        provider: BillingProvider.efi,
        providerPayload: {
          ...previousPayload,
          boletoCancel: {
            at: new Date().toISOString(),
            response: cancelResponse
          }
        }
      },
      include: { company: true, plan: true, subscription: true }
    });
    await this.refreshCompanySubscriptionStatus(invoice.companyId);
    return updated;
  }

  async releaseSubscription(companyId: string, data: AnyRecord, user: AuthUser) {
    this.requireSuperAdmin(user);
    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException("Assinatura nao encontrada.");

    return this.prisma.companySubscription.update({
      where: { companyId },
      data: {
        status: "active",
        nextDueDate: this.normalizeDate(data.nextDueDate) || subscription.nextDueDate,
        notes: data.notes ? String(data.notes) : subscription.notes
      },
      include: { company: true, plan: true }
    });
  }

  private async refreshCompanySubscriptionStatus(companyId: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.graceDays());
    const overdue = await this.prisma.billingInvoice.count({
      where: {
        companyId,
        status: { in: ["overdue"] },
        paidAt: null,
        dueDate: { lt: this.dayStart(cutoff) }
      }
    });

    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) return;
    if (overdue === 0 && subscription.status === "past_due") {
      await this.prisma.companySubscription.update({
        where: { companyId },
        data: { status: "active" }
      });
    }
  }

  private async efiConfig(options: { requirePixKey?: boolean; requireCert?: boolean } = {}): Promise<EfiRuntimeConfig> {
    const activeConfig = await this.prisma.billingGatewayConfig.findFirst({
      where: { provider: "efi", active: true },
      orderBy: { updatedAt: "desc" }
    });
    const env = String(activeConfig?.environment || process.env.EFI_ENV || "homologation").toLowerCase();
    const production = ["prod", "production", "producao"].includes(env);
    const environment = production ? "production" : "homologation";
    const suffix = production ? "PROD" : "HOMOLOG";
    const dbConfig = activeConfig || await this.prisma.billingGatewayConfig.findUnique({
      where: {
        provider_environment: {
          provider: "efi",
          environment
        }
      }
    });
    const clientId = dbConfig?.clientId || process.env[`EFI_CLIENT_ID_${suffix}`] || process.env.EFI_CLIENT_ID || "";
    const clientSecret = this.decryptSecret(dbConfig?.encryptedClientSecret) || process.env[`EFI_CLIENT_SECRET_${suffix}`] || process.env.EFI_CLIENT_SECRET || "";
    const certPath = dbConfig?.certPath || process.env[`EFI_CERT_PATH_${suffix}`] || process.env.EFI_CERT_PATH || "";
    const certPassphrase = this.decryptSecret(dbConfig?.encryptedCertPassphrase) || process.env[`EFI_CERT_PASSPHRASE_${suffix}`] || process.env.EFI_CERT_PASSPHRASE || "";
    const pixKey = dbConfig?.pixKey || process.env[`EFI_PIX_KEY_${suffix}`] || process.env.EFI_PIX_KEY || "";

    const missing: string[] = [];
    if (!clientId) missing.push("Client ID");
    if (!clientSecret) missing.push("Client Secret");
    if (options.requireCert !== false && !certPath) missing.push("certificado");
    if (options.requirePixKey !== false && !pixKey) missing.push("chave Pix");
    if (missing.length) {
      throw new BadRequestException(`Configure a Efí no Painel master > Config Efí. Faltando: ${missing.join(", ")}.`);
    }
    if (certPath && !existsSync(certPath)) {
      throw new BadRequestException("Certificado Efí nao encontrado no caminho configurado.");
    }

    return {
      environment,
      pixBaseUrl: production ? "https://pix.api.efipay.com.br" : "https://pix-h.api.efipay.com.br",
      chargesBaseUrl: production ? "https://cobrancas.api.efipay.com.br" : "https://cobrancas-h.api.efipay.com.br",
      clientId,
      clientSecret,
      certPath: certPath || undefined,
      certPassphrase,
      pixKey: pixKey || undefined
    };
  }

  private requestJson<T>(url: string, options: AnyRecord, body?: AnyRecord): Promise<T> {
    const target = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      ...(options.headers || {})
    };

    return new Promise((resolve, reject) => {
      const requestOptions: AnyRecord = {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: options.method || "GET",
        headers
      };
      if (options.certPath) {
        requestOptions.pfx = readFileSync(options.certPath);
        requestOptions.passphrase = options.certPassphrase || undefined;
      }

      const req = request(
        requestOptions,
        response => {
          const chunks: Buffer[] = [];
          response.on("data", chunk => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let data: AnyRecord = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch {
              data = { raw: text };
            }
            if ((response.statusCode || 500) >= 400) {
              reject(new BadRequestException(data?.mensagem || data?.message || data?.error_description || data?.raw || "Erro na Efí."));
              return;
            }
            resolve(data as T);
          });
        }
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  private async efiToken(config: EfiRuntimeConfig) {
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const data = await this.requestJson<{ access_token: string }>(
      `${config.pixBaseUrl}/oauth/token`,
      {
        method: "POST",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Basic ${auth}` }
      },
      { grant_type: "client_credentials" }
    );
    return data.access_token;
  }

  private async efiChargesToken(config: EfiRuntimeConfig) {
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const data = await this.requestJson<{ access_token: string }>(
      `${config.chargesBaseUrl}/v1/authorize`,
      {
        method: "POST",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Basic ${auth}` }
      },
      { grant_type: "client_credentials" }
    );
    return data.access_token;
  }

  async generatePix(id: string, user: AuthUser) {
    const invoice = await this.getInvoiceOrThrow(id, user);
    if (invoice.paidAt || ["paid", "canceled", "failed"].includes(invoice.status)) throw new BadRequestException("Esta fatura nao pode gerar Pix.");
    if (invoice.providerChargeId) throw new BadRequestException("Esta fatura possui boleto. Consulte o boleto antes de emitir outro meio de pagamento.");

    const config = await this.efiConfig();
    const token = await this.efiToken(config);
    const amounts = billingAmounts(invoice);
    const value = this.money(amounts.payableValue);
    let existing: AnyRecord | null = null;
    if (invoice.txId) {
      existing = await this.requestJson<AnyRecord>(`${config.pixBaseUrl}/v2/cob/${invoice.txId}`, {
        method: "GET", certPath: config.certPath, certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (existing.status === "CONCLUIDA") {
        const paid = await this.prisma.billingInvoice.update({ where: { id }, data: { status: "paid", paidAt: new Date(), providerPayload: { ...(invoice.providerPayload as AnyRecord || {}), charge: existing } } });
        await this.refreshCompanySubscriptionStatus(invoice.companyId);
        return this.invoiceForPayment(paid);
      }
      if (existing.status !== "ATIVA") throw new BadRequestException("Pix removido na Efi. Revise a cobranca antes de reemitir.");
    }
    // Reuse the bank transaction so retries and delayed webhooks still identify this debt.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const secondsUntilMidnight = Math.max(1, Math.floor((Date.parse(`${today}T00:00:00-03:00`) + 86400000 - Date.now()) / 1000));
    const lifetime = Math.min(secondsUntilMidnight, Math.max(1, Number(process.env.EFI_PIX_EXPIRATION_SECONDS || 86400)));
    const elapsed = existing ? Math.max(0, Math.ceil((Date.now() - Date.parse(existing.calendario.criacao)) / 1000)) : 0;
    const charge = await this.requestJson<AnyRecord>(
      `${config.pixBaseUrl}/v2/cob${invoice.txId ? `/${invoice.txId}` : ""}`,
      {
        method: invoice.txId ? "PATCH" : "POST",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${token}` }
      },
      {
        calendario: { expiracao: elapsed + lifetime },
        valor: { original: value },
        chave: config.pixKey,
        solicitacaoPagador: invoice.detail.slice(0, 140)
      }
    );

    const locId = charge.loc?.id ? String(charge.loc.id) : null;
    const qr = locId
      ? await this.requestJson<AnyRecord>(
          `${config.pixBaseUrl}/v2/loc/${locId}/qrcode`,
          {
            method: "GET",
            certPath: config.certPath,
            certPassphrase: config.certPassphrase,
            headers: { Authorization: `Bearer ${token}` }
          }
        )
      : {};

    const updated = await this.prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: amounts.daysLate ? "overdue" : "pending",
        paymentMethod: "pix",
        provider: "efi",
        txId: charge.txid ? String(charge.txid) : invoice.txId,
        providerLocationId: locId,
        pixCopyPaste: String(qr.qrcode || charge.pixCopiaECola || ""),
        pixQrCodeImage: String(qr.imagemQrcode || ""),
        paymentUrl: String(qr.linkVisualizacao || invoice.paymentUrl || ""),
        providerPayload: { ...(invoice.providerPayload as AnyRecord || {}), charge, qr, chargedAmounts: amounts }
      },
      include: { company: true, plan: true, subscription: true }
    });
    return this.invoiceForPayment(updated);
  }

  async generateBoleto(id: string, user: AuthUser) {
    const invoice = await this.getInvoiceOrThrow(id, user);
    if (invoice.status === "paid") throw new BadRequestException("Fatura ja esta paga.");
    if (["canceled", "expired"].includes(String(invoice.status))) {
      throw new BadRequestException("Fatura cancelada ou expirada nao pode gerar boleto.");
    }
    if (invoice.providerChargeId && invoice.paymentMethod === "boleto" && this.activeInvoiceStatuses().includes(invoice.status)) {
      throw new BadRequestException("Esta fatura ja possui boleto gerado. Use o link/PDF existente ou cancele o boleto antes de gerar outro.");
    }
    if (billingAmounts(invoice).daysLate) {
      throw new BadRequestException("O vencimento original ja passou. Pague esta mesma fatura por Pix atualizado com encargos. Um novo boleto exige uma reemissao acordada com o master; o vencimento da divida nao sera alterado automaticamente.");
    }
    const duplicate = await this.findActiveDuplicateInvoice(invoice.companyId, this.money(invoice.value), invoice.dueDate, invoice.id);
    if (duplicate) throw new BadRequestException(this.duplicateInvoiceMessage(duplicate));

    const config = await this.efiConfig({ requirePixKey: false, requireCert: false });
    const token = await this.efiChargesToken(config);
    const chargeValue = this.moneyToCents(invoice.value);
    const daysToWriteOff = Math.min(120, Math.max(0, Number(process.env.EFI_BOLETO_DAYS_TO_WRITE_OFF || 30)));
    const payload = {
      items: [
        {
          name: this.text(invoice.detail || "Assinatura da plataforma").slice(0, 255),
          value: chargeValue,
          amount: 1
        }
      ],
      metadata: {
        custom_id: invoice.id,
        notification_url: this.publicWebhookUrl("/api/webhooks/efi/charges")
      },
      payment: {
        banking_billet: {
          customer: this.boletoCustomer(invoice.company as AnyRecord),
          expire_at: this.dateOnly(invoice.dueDate),
          configurations: {
            days_to_write_off: daysToWriteOff,
            fine: 200,
            interest: { value: 100, type: "monthly" }
          },
          message: "Assinatura da plataforma Vib"
        }
      }
    };

    const response = await this.requestJson<AnyRecord>(
      `${config.chargesBaseUrl}/v1/charge/one-step`,
      {
        method: "POST",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${token}` }
      },
      payload
    );
    const charge = response.data || response;
    const boletoPdfUrl = this.text(charge.pdf?.charge);
    const paymentUrl = this.text(charge.billet_link || charge.link || boletoPdfUrl);

    return this.prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "pending",
        paymentMethod: "boleto",
        provider: "efi",
        providerChargeId: charge.charge_id ? String(charge.charge_id) : invoice.providerChargeId,
        paymentUrl: paymentUrl || invoice.paymentUrl,
        boletoBarcode: this.text(charge.barcode) || null,
        boletoPdfUrl: boletoPdfUrl || null,
        pixCopyPaste: this.text(charge.pix?.qrcode) || invoice.pixCopyPaste,
        pixQrCodeImage: this.text(charge.pix?.qrcode_image) || invoice.pixQrCodeImage,
        providerError: null,
        providerPayload: { boleto: charge, boletoRequest: payload }
      },
      include: { company: true, plan: true, subscription: true }
    });
  }

  async refreshBoleto(id: string, user: AuthUser) {
    this.requireSuperAdmin(user);
    const invoice = await this.getInvoiceOrThrow(id, user);
    if (!invoice.providerChargeId || invoice.paymentMethod !== "boleto") {
      throw new BadRequestException("Esta fatura nao possui boleto Efí para atualizar.");
    }

    const config = await this.efiConfig({ requirePixKey: false, requireCert: false });
    const token = await this.efiChargesToken(config);
    const response = await this.requestJson<AnyRecord>(
      `${config.chargesBaseUrl}/v1/charge/${encodeURIComponent(invoice.providerChargeId)}`,
      {
        method: "GET",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const charge = response.data || response;
    const boletoPdfUrl = this.text(charge.pdf?.charge);
    const paymentUrl = this.text(charge.billet_link || charge.link || boletoPdfUrl);
    const mappedStatus = this.invoiceStatusFromEfi(this.text(charge.status), invoice.dueDate);
    const status = mappedStatus === "paid" || mappedStatus === "canceled" || mappedStatus === "expired" || mappedStatus === "failed"
      ? mappedStatus
      : invoice.status;

    const currentPayload = invoice.providerPayload && typeof invoice.providerPayload === "object"
      ? invoice.providerPayload as AnyRecord
      : {};

    const updated = await this.prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status,
        provider: "efi",
        providerChargeId: this.text(charge.charge_id) || invoice.providerChargeId,
        paymentUrl: paymentUrl || invoice.paymentUrl,
        boletoBarcode: this.text(charge.barcode) || invoice.boletoBarcode,
        boletoPdfUrl: boletoPdfUrl || invoice.boletoPdfUrl,
        pixCopyPaste: this.text(charge.pix?.qrcode) || invoice.pixCopyPaste,
        pixQrCodeImage: this.text(charge.pix?.qrcode_image) || invoice.pixQrCodeImage,
        providerError: null,
        providerPayload: {
          ...currentPayload,
          boletoRefresh: { charge, refreshedAt: new Date().toISOString() }
        }
      },
      include: { company: true, plan: true, subscription: true }
    });

    if (updated.status === "paid") await this.refreshCompanySubscriptionStatus(updated.companyId);
    return updated;
  }

  private invoiceStatusFromEfi(status: string, dueDate?: Date): "pending" | "paid" | "overdue" | "canceled" | "expired" | "failed" | null {
    const current = status.toLowerCase();
    if (["paid", "settled"].includes(current)) return "paid";
    if (["waiting", "new", "link"].includes(current)) return dueDate && billingAmounts({ value: 1, dueDate, status: "open" }).daysLate ? "overdue" : "pending";
    if (["canceled", "cancelled"].includes(current)) return "canceled";
    if (current === "expired") return "overdue";
    if (["refunded", "chargeback", "contested"].includes(current)) return "failed";
    if (current === "unpaid") {
      return dueDate && dueDate < this.dayStart(new Date()) ? "overdue" : "pending";
    }
    return null;
  }

  async processPixWebhook(body: AnyRecord) {
    const pixItems = Array.isArray(body?.pix) ? body.pix : [];
    const updated = [];

    for (const item of pixItems) {
      const txId = String(item.txid || "");
      if (!txId) continue;
      const invoice = await this.prisma.billingInvoice.findFirst({ where: { txId } });
      if (!invoice) continue;
      updated.push(
        await this.prisma.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "paid",
            paidAt: item.horario ? new Date(String(item.horario)) : new Date(),
            providerPayload: { ...(invoice.providerPayload as AnyRecord || {}), webhook: body }
          }
        })
      );
      await this.refreshCompanySubscriptionStatus(invoice.companyId);
    }

    return { ok: true, updated: updated.length };
  }

  async processChargesWebhook(body: AnyRecord) {
    const token = this.text(body.notification || body.token || body.notification_token);
    if (!token) return { ok: true, skipped: true };

    const config = await this.efiConfig({ requirePixKey: false, requireCert: false });
    const accessToken = await this.efiChargesToken(config);
    const notification = await this.requestJson<AnyRecord>(
      `${config.chargesBaseUrl}/v1/notification/${encodeURIComponent(token)}`,
      {
        method: "GET",
        certPath: config.certPath,
        certPassphrase: config.certPassphrase,
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    const items = Array.isArray(notification.data) ? notification.data : [];
    const latest = items
      .slice()
      .sort((left, right) => Number(left.id || 0) - Number(right.id || 0))
      .pop();

    if (!latest) return { ok: true, updated: 0 };

    const customId = this.text(latest.custom_id);
    const chargeId = this.text(latest.identifiers?.charge_id);
    const or: AnyRecord[] = [];
    if (customId) or.push({ id: customId });
    if (chargeId) or.push({ providerChargeId: chargeId });
    if (!or.length) return { ok: true, updated: 0 };

    const invoice = await this.prisma.billingInvoice.findFirst({ where: { OR: or } });
    if (!invoice) return { ok: true, updated: 0 };

    const mappedStatus = this.invoiceStatusFromEfi(this.text(latest.status?.current), invoice.dueDate);
    const previousPayload =
      invoice.providerPayload && typeof invoice.providerPayload === "object" && !Array.isArray(invoice.providerPayload)
        ? invoice.providerPayload as AnyRecord
        : {};
    const update: AnyRecord = {
      provider: "efi",
      providerChargeId: chargeId || invoice.providerChargeId,
      providerPayload: {
        ...previousPayload,
        chargesWebhook: body,
        chargesNotification: notification
      }
    };

    if (mappedStatus) update.status = mappedStatus;
    if (mappedStatus === "paid") {
      update.paidAt = latest.received_by_bank_at ? new Date(String(latest.received_by_bank_at)) : new Date();
    }

    await this.prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: update
    });
    if (mappedStatus === "paid") {
      await this.refreshCompanySubscriptionStatus(invoice.companyId);
    }

    return { ok: true, updated: mappedStatus ? 1 : 0, status: mappedStatus || this.text(latest.status?.current) };
  }
}
