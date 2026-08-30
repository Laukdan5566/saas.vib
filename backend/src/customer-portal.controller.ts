import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { AppointmentStatus, Origin } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { PrismaService } from "./prisma.service";

type AnyRecord = Record<string, any>;

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

type CustomerJwt = {
  type: "customer";
  companyId: string;
  customerId: string;
  accountId: string;
  email: string;
};

function cleanPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function bearerToken(request: AnyRecord) {
  const header = request.headers?.authorization;
  const authHeader = Array.isArray(header) ? header[0] : header;
  return authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
}

@Controller()
export class CustomerPortalController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("api/customer-auth/:slug/register")
  async register(@Param("slug") slug: string, @Body() body: AnyRecord) {
    const company = await this.company(slug);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = cleanPhone(body.phone || body.whatsapp);
    const password = String(body.password || "");

    if (!name || !email || !phone || password.length < 6) {
      throw new BadRequestException("Informe nome, email, WhatsApp e senha com pelo menos 6 caracteres.");
    }

    const existingAccount = await this.prisma.customerAccount.findFirst({
      where: {
        companyId: company.id,
        provider: "local",
        providerAccountId: email
      }
    });
    if (existingAccount) {
      throw new BadRequestException("Ja existe uma conta com este email.");
    }

    const customer = await this.upsertCustomer(company.id, { name, email, phone });
    const account = await this.prisma.customerAccount.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        provider: "local",
        providerAccountId: email,
        email,
        passwordHash: await hash(password, 10),
        name,
        active: true,
        lastLoginAt: new Date()
      }
    });

    return this.customerSession(company, customer, account);
  }

  @Post("api/customer-auth/:slug/login")
  async localLogin(@Param("slug") slug: string, @Body() body: AnyRecord) {
    const company = await this.company(slug);
    const identifier = String(body.identifier || body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!identifier || !password) {
      throw new BadRequestException("Informe login e senha.");
    }

    const cleanIdentifierPhone = cleanPhone(identifier);
    const account = await this.prisma.customerAccount.findFirst({
      where: {
        companyId: company.id,
        provider: "local",
        OR: [
          { providerAccountId: identifier },
          { email: identifier },
          ...(cleanIdentifierPhone
            ? [
                {
                  customer: {
                    OR: [{ phone: cleanIdentifierPhone }, { whatsapp: cleanIdentifierPhone }]
                  }
                }
              ]
            : [])
        ],
        active: true
      },
      include: { customer: true }
    });

    if (!account?.passwordHash || !(await compare(password, account.passwordHash))) {
      throw new UnauthorizedException("Login ou senha invalidos.");
    }

    await this.prisma.customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() }
    });

    return this.customerSession(company, account.customer, account);
  }

  @Post("api/customer-auth/:slug/google")
  async googleLogin(@Param("slug") slug: string, @Body() body: { credential?: string }) {
    const company = await this.company(slug);
    const googleUser = await this.verifyGoogleCredential(String(body.credential || ""));
    return this.googleCustomerSession(company, googleUser);
  }

  @Post("api/customer-auth/:slug/google-code")
  async googleCodeLogin(@Param("slug") slug: string, @Body() body: AnyRecord) {
    const company = await this.company(slug);
    const tokenData = await this.exchangeGoogleCode(String(body.code || ""), String(body.redirectUri || ""));
    const googleUser = await this.verifyGoogleCredential(String(tokenData.id_token || ""));
    return this.googleCustomerSession(company, googleUser);
  }

  private async googleCustomerSession(company: AnyRecord, googleUser: GoogleTokenInfo) {
    const customer = await this.upsertCustomer(company.id, {
      name: googleUser.name || googleUser.email || "Cliente",
      email: googleUser.email,
      profilePicUrl: googleUser.picture
    });

    const account = await this.prisma.customerAccount.upsert({
      where: {
        companyId_provider_providerAccountId: {
          companyId: company.id,
          provider: "google",
          providerAccountId: googleUser.sub!
        }
      },
      create: {
        companyId: company.id,
        customerId: customer.id,
        provider: "google",
        providerAccountId: googleUser.sub!,
        email: googleUser.email!,
        name: googleUser.name || customer.name,
        avatarUrl: googleUser.picture,
        lastLoginAt: new Date()
      },
      update: {
        customerId: customer.id,
        email: googleUser.email!,
        name: googleUser.name || customer.name,
        avatarUrl: googleUser.picture,
        active: true,
        lastLoginAt: new Date()
      }
    });

    return this.customerSession(company, customer, account);
  }

  @Get("api/customer/:slug/me")
  async me(@Param("slug") slug: string, @Req() request: AnyRecord) {
    const company = await this.company(slug);
    const session = this.customerFromRequest(request, company.id);
    const account = await this.prisma.customerAccount.findFirst({
      where: { id: session.accountId, companyId: company.id, active: true },
      include: { customer: true }
    });
    if (!account) throw new UnauthorizedException("Sessao do cliente invalida.");

    const appointments = await this.prisma.appointment.findMany({
      where: { companyId: company.id, customerId: account.customerId },
      include: { service: true, professional: true },
      orderBy: { date: "desc" },
      take: 20
    });

    return {
      company: this.publicCompany(company),
      account,
      customer: account.customer,
      appointments
    };
  }

  @Patch("api/customer/:slug/profile")
  async updateProfile(@Param("slug") slug: string, @Req() request: AnyRecord, @Body() body: AnyRecord) {
    const company = await this.company(slug);
    const session = this.customerFromRequest(request, company.id);
    const account = await this.prisma.customerAccount.findFirst({
      where: { id: session.accountId, companyId: company.id, active: true },
      include: { customer: true }
    });
    if (!account) throw new UnauthorizedException("Sessao do cliente invalida.");

    const phone = cleanPhone(body.phone || body.whatsapp || account.customer.phone);
    const name = String(body.name || account.customer.name || "").trim();
    const customer = await this.prisma.customer.update({
      where: { id: account.customerId },
      data: {
        name: name || account.customer.name,
        phone: phone || account.customer.phone,
        whatsapp: phone || account.customer.whatsapp
      }
    });

    return { customer };
  }

  @Get("api/customer/:slug/catalog")
  async catalog(@Param("slug") slug: string) {
    const company = await this.company(slug);
    const services = await this.prisma.service.findMany({
      where: { companyId: company.id, active: true },
      include: {
        professionalServices: {
          include: { professional: true }
        }
      },
      orderBy: [{ price: "asc" }, { name: "asc" }]
    });
    const professionals = await this.prisma.professional.findMany({
      where: { companyId: company.id, active: true },
      include: {
        professionalServices: {
          include: { service: true }
        }
      },
      orderBy: { name: "asc" }
    });

    return {
      company: this.publicCompany(company),
      services,
      professionals
    };
  }

  @Get("api/customer/:slug/appointments")
  async appointments(@Param("slug") slug: string, @Req() request: AnyRecord) {
    const company = await this.company(slug);
    const session = this.customerFromRequest(request, company.id);
    return this.prisma.appointment.findMany({
      where: { companyId: company.id, customerId: session.customerId },
      include: { service: true, professional: true },
      orderBy: { date: "desc" },
      take: 30
    });
  }

  @Get("api/customer/:slug/availability")
  async availability(
    @Param("slug") slug: string,
    @Query("serviceId") serviceId: string,
    @Query("date") date: string
  ) {
    const company = await this.company(slug);
    const service = await this.prisma.service.findFirst({
      where: { id: String(serviceId || ""), companyId: company.id, active: true }
    });
    if (!service) throw new BadRequestException("Servico indisponivel.");

    return this.serviceAvailability(company.id, service.id, String(date || ""), Number(service.durationMinutes || 20));
  }

  @Post("api/customer/:slug/appointments")
  async createAppointment(@Param("slug") slug: string, @Req() request: AnyRecord, @Body() body: AnyRecord) {
    const company = await this.company(slug);
    const session = this.customerFromRequest(request, company.id);
    const serviceId = String(body.serviceId || "");
    const professionalId = String(body.professionalId || "");
    const date = String(body.date || "");
    const time = String(body.time || "");

    if (!serviceId || !date || !time) {
      throw new BadRequestException("Servico, data e horario sao obrigatorios.");
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId: company.id, active: true }
    });
    if (!service) throw new BadRequestException("Servico indisponivel.");

    let professional = professionalId
      ? await this.prisma.professional.findFirst({
          where: { id: professionalId, companyId: company.id, active: true }
        })
      : null;
    if (professionalId && !professional) throw new BadRequestException("Profissional indisponivel.");

    if (professional) {
      const allowed = await this.prisma.professionalService.findFirst({
        where: {
          companyId: company.id,
          professionalId: professional.id,
          serviceId: service.id
        }
      });
      if (!allowed) throw new BadRequestException("Este profissional nao atende o servico escolhido.");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: session.customerId, companyId: company.id }
    });
    if (!customer) throw new UnauthorizedException("Cliente nao encontrado.");
    if (!cleanPhone(customer.phone || customer.whatsapp)) {
      throw new BadRequestException("Complete seu WhatsApp antes de agendar.");
    }

    if (!professional) {
      professional = await this.findFreeProfessional(company.id, service.id, date, time, Number(service.durationMinutes || 20));
      if (!professional) {
        throw new BadRequestException("Todos os profissionais estao ocupados neste horario.");
      }
    }

    const free = await this.isProfessionalFree(company.id, professional.id, date, time, Number(service.durationMinutes || 20));
    if (!free) {
      throw new BadRequestException("Esse horario acabou de ser ocupado. Escolha outro horario.");
    }

    const appointmentDate = this.appointmentDate(date, time);
    const appointment = await this.prisma.appointment.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        serviceId: service.id,
        professionalId: professional.id,
        date: appointmentDate,
        time,
        status: AppointmentStatus.requested,
        price: service.price,
        notes: String(body.notes || "").trim() || undefined,
        origin: Origin.painel
      },
      include: { service: true, professional: true }
    });

    return { appointment };
  }

  private async company(slug: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ slug }, { publicId: slug }] },
      include: { settings: true }
    });
    if (!company || !company.active) throw new NotFoundException("Empresa nao encontrada.");
    return company;
  }

  private publicCompany(company: AnyRecord) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      publicId: company.publicId,
      logoUrl: company.logoUrl,
      phone: company.phone,
      whatsapp: company.whatsapp,
      segment: company.segment,
      acceptAppointments: company.settings?.acceptAppointments ?? true
    };
  }

  private async verifyGoogleCredential(credential: string): Promise<GoogleTokenInfo> {
    if (!credential) throw new UnauthorizedException("Credencial Google ausente.");

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const data = (await response.json().catch(() => ({}))) as GoogleTokenInfo & { error_description?: string };
    if (!response.ok || !data.sub || !data.email) {
      throw new UnauthorizedException(data.error_description || "Credencial Google invalida.");
    }

    const expectedClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    if (expectedClientId && data.aud !== expectedClientId) {
      throw new UnauthorizedException("Credencial Google emitida para outro aplicativo.");
    }

    if (data.email_verified === false || data.email_verified === "false") {
      throw new UnauthorizedException("Email Google ainda nao verificado.");
    }

    return data;
  }

  private async exchangeGoogleCode(code: string, redirectUri: string) {
    if (!code) throw new UnauthorizedException("Codigo Google ausente.");
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
      throw new BadRequestException("OAuth Google nao configurado no servidor.");
    }

    const safeRedirectUri = redirectUri || "https://saas.correacloud.com.br";
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: safeRedirectUri,
        grant_type: "authorization_code"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id_token) {
      throw new UnauthorizedException(data.error_description || data.error || "Falha ao validar login Google.");
    }
    return data;
  }

  private async upsertCustomer(
    companyId: string,
    profile: { name: string; email?: string; phone?: string; profilePicUrl?: string }
  ) {
    const existing = profile.email
      ? await this.prisma.customer.findFirst({ where: { companyId, email: profile.email } })
      : null;

    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: profile.name || existing.name,
          email: profile.email || existing.email,
          phone: profile.phone || existing.phone,
          whatsapp: profile.phone || existing.whatsapp,
          profilePicUrl: profile.profilePicUrl || existing.profilePicUrl
        }
      });
    }

    return this.prisma.customer.create({
      data: {
        companyId,
        name: profile.name || "Cliente",
        email: profile.email,
        phone: profile.phone,
        whatsapp: profile.phone,
        profilePicUrl: profile.profilePicUrl
      }
    });
  }

  private customerSession(company: AnyRecord, customer: AnyRecord, account: AnyRecord) {
    const token = sign(
      {
        type: "customer",
        companyId: company.id,
        customerId: customer.id,
        accountId: account.id,
        email: account.email
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "30d" }
    );

    return {
      token,
      company: this.publicCompany(company),
      customer,
      account
    };
  }

  private customerFromRequest(request: AnyRecord, companyId: string) {
    const token = bearerToken(request);
    if (!token) throw new UnauthorizedException("Token do cliente ausente.");
    try {
      const session = verify(token, process.env.JWT_SECRET || "dev-secret") as CustomerJwt;
      if (session.type !== "customer" || session.companyId !== companyId) {
        throw new Error("invalid_customer_session");
      }
      return session;
    } catch {
      throw new UnauthorizedException("Token do cliente invalido.");
    }
  }

  private appointmentDate(date: string, time: string) {
    const cleanDate = date.includes("T") ? date.slice(0, 10) : date;
    const cleanTime = time.length === 5 ? `${time}:00` : time;
    const parsed = new Date(`${cleanDate}T${cleanTime}-03:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Data ou horario invalido.");
    }
    return parsed;
  }

  private async serviceAvailability(companyId: string, serviceId: string, date: string, durationMinutes: number) {
    const serviceProfessionals = await this.prisma.professionalService.findMany({
      where: { companyId, serviceId, professional: { active: true } },
      include: { professional: true }
    });
    const professionals = serviceProfessionals.map(item => item.professional);
    const times = this.availableTimesForDate(date);
    const availability = [];

    for (const time of times) {
      const freeProfessionals = [];
      for (const professional of professionals) {
        const works = await this.professionalWorksAt(companyId, professional.id, date, time, durationMinutes);
        if (!works) continue;
        const free = await this.isProfessionalFree(companyId, professional.id, date, time, durationMinutes);
        if (free) freeProfessionals.push(professional);
      }
      availability.push({
        time,
        available: freeProfessionals.length > 0,
        professionals: freeProfessionals.map(professional => ({
          id: professional.id,
          name: professional.name
        }))
      });
    }

    return { date, serviceId, times: availability };
  }

  private async findFreeProfessional(companyId: string, serviceId: string, date: string, time: string, durationMinutes: number) {
    const serviceProfessionals = await this.prisma.professionalService.findMany({
      where: { companyId, serviceId, professional: { active: true } },
      include: { professional: true }
    });

    for (const item of serviceProfessionals) {
      const works = await this.professionalWorksAt(companyId, item.professionalId, date, time, durationMinutes);
      if (!works) continue;
      if (await this.isProfessionalFree(companyId, item.professionalId, date, time, durationMinutes)) {
        return item.professional;
      }
    }

    return null;
  }

  private async isProfessionalFree(companyId: string, professionalId: string, date: string, time: string, durationMinutes = 20) {
    const start = this.startOfLocalDay(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        professionalId,
        date: { gte: start, lt: end },
        status: { in: [AppointmentStatus.requested, AppointmentStatus.confirmed] }
      },
      include: { service: true }
    });

    const requestedStart = this.timeToMinutes(time);
    const requestedEnd = requestedStart + durationMinutes;

    return !existingAppointments.some(appointment => {
      const existingStart = this.timeToMinutes(appointment.time);
      const existingEnd = existingStart + Number(appointment.service?.durationMinutes || 20);
      return existingStart < requestedEnd && requestedStart < existingEnd;
    });
  }

  private async professionalWorksAt(
    companyId: string,
    professionalId: string,
    date: string,
    time: string,
    durationMinutes: number
  ) {
    const weekday = this.weekdaySaoPaulo(date);
    const availability = await this.prisma.professionalAvailability.findMany({
      where: { companyId, professionalId, dayOfWeek: weekday, isAvailable: true }
    });

    if (!availability.length) {
      return this.timeToMinutes(time) >= 9 * 60 && this.timeToMinutes(time) + durationMinutes <= 18 * 60;
    }

    const start = this.timeToMinutes(time);
    const end = start + durationMinutes;
    return availability.some(slot => {
      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd = this.timeToMinutes(slot.endTime);
      return start >= slotStart && end <= slotEnd;
    });
  }

  private availableTimesForDate(date: string) {
    const times = [];
    const start = 9 * 60;
    const end = 18 * 60;
    for (let minutes = start; minutes < end; minutes += 20) {
      times.push(this.minutesToTime(minutes));
    }
    return times;
  }

  private startOfLocalDay(date: string) {
    const cleanDate = date.includes("T") ? date.slice(0, 10) : date;
    return new Date(`${cleanDate}T00:00:00-03:00`);
  }

  private weekdaySaoPaulo(date: string) {
    return this.startOfLocalDay(date).getDay();
  }

  private timeToMinutes(value: string) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
  }

  private minutesToTime(value: number) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
}
