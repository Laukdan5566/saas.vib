import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, ClipboardList, CupSoda, Home, LogOut, Pizza, Share2, ShoppingBag } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3101";
const SERVICE_TIME_LABEL = "Atendimento por ordem de chegada ou agendamento.";
const DELIVERY_TIME_LABEL = "Tempo médio de entrega: 30 a 70 Minutos.";

type PublicCompany = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  segment?: string | null;
  acceptOrders: boolean;
  allowDelivery: boolean;
  allowPickup: boolean;
  deliveryFeeDefault: number | string;
  minimumOrderValue: number | string;
  preparationTimeMinutes: number;
  paymentMethods?: Array<{
    name: string;
    type: string;
    instructions?: string | null;
  }>;
};

type ProductAddon = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  imageUrl?: string | null;
  addonGroupId: string;
};

type ProductAddonGroup = {
  id: string;
  name: string;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  addons: ProductAddon[];
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  promotionalPrice?: number | string | null;
  imageUrl?: string | null;
  addonGroups: ProductAddonGroup[];
};

type MenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  products: Product[];
};

type PublicMenuResponse = {
  company: PublicCompany;
  categories: MenuCategory[];
};

type CustomerProfile = {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  profilePicUrl?: string | null;
};

type CustomerAccount = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
};

type PublicService = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  durationMinutes: number;
  professionalServices?: Array<{
    professional: PublicProfessional;
  }>;
};

type PublicProfessional = {
  id: string;
  name: string;
  active: boolean;
};

type PublicAppointment = {
  id: string;
  date: string;
  time: string;
  status: string;
  price: number | string;
  notes?: string | null;
  service: PublicService;
  professional?: PublicProfessional | null;
};

type CustomerSession = {
  token: string;
  company: PublicCompany;
  customer: CustomerProfile;
  account: CustomerAccount;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function publicCompanyInitials(company: PublicCompany) {
  return (
    company.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("") || "EM"
  );
}

function publicCompanyLogo(company: PublicCompany) {
  return String(company.logoUrl || "").trim();
}

function PublicCompanyMark({ company }: { company: PublicCompany }) {
  const logo = publicCompanyLogo(company);
  if (logo) return <img src={logo} alt={company.name} />;
  return <span className="companyAvatar publicCompanyAvatar">{publicCompanyInitials(company)}</span>;
}

function isPublicBarbershop(company: PublicCompany | null | undefined) {
  return String(company?.segment || "") === "barbershop";
}

type CartAddon = {
  id: string;
  name: string;
  price: number;
};

type CartItem = {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  addons: CartAddon[];
};

type PublicOrder = {
  id: string;
  displayNumber?: string;
  status: string;
  orderType: string;
  total: number | string;
  createdAt: string;
  items: Array<{
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: number | string;
    notes?: string | null;
    addons: Array<{
      addonId?: string | null;
      addonName: string;
      price: number | string;
    }>;
  }>;
};

type View = "home" | "menu" | "pizzas" | "beverages" | "juices" | "additionals" | "pizza" | "checkout" | "orders";

type PublicPrefill = {
  customerName: string;
  customerPhone: string;
  initialView: View;
};

function publicPrefillFromLocation(): PublicPrefill {
  const params = new URLSearchParams(window.location.search);
  const viewParam = String(params.get("view") || params.get("abrir") || "").toLowerCase();
  const initialView: View = ["orders", "pedidos", "status"].includes(viewParam) ? "orders" : "home";

  return {
    customerName: params.get("name") || params.get("nome") || params.get("customerName") || "",
    customerPhone: params.get("phone") || params.get("telefone") || params.get("whatsapp") || "",
    initialView
  };
}

function publicMenuStorageKey(slug: string, name: string) {
  return `vib-public-menu:${slug}:${name}`;
}

function readPublicMenuStorage<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePublicMenuStorage(key: string, value: unknown) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O cardápio continua funcionando mesmo se o navegador bloquear armazenamento local.
  }
}

function money(value: unknown) {
  return Number(value || 0);
}

function brl(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(money(value));
}

function publicGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function publicOrderNumber(order: PublicOrder | null) {
  if (!order) return "-";
  return order.displayNumber || `#${order.id.slice(0, 8)}`;
}

function publicDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

function companyAreaCode(company: PublicCompany) {
  const phone = cleanPhone(company.phone || "");
  if (phone.startsWith("55") && phone.length >= 12) return phone.slice(2, 4);
  if (phone.length >= 10) return phone.slice(0, 2);
  return "27";
}

function companyWhatsappUrl(company: PublicCompany, order: PublicOrder | null) {
  const rawPhone = cleanPhone(company.whatsapp || company.phone || "5527999677577");
  const localAreaCode = companyAreaCode(company);
  let phone = rawPhone;

  if (phone.startsWith("55")) {
    const nationalPhone = phone.slice(2);
    phone = nationalPhone.length <= 9 ? `55${localAreaCode}${nationalPhone}` : phone;
  } else if (phone.length <= 9) {
    phone = `55${localAreaCode}${phone}`;
  } else if (phone.length <= 11) {
    phone = `55${phone}`;
  }

  const orderNumber = publicOrderNumber(order);
  const text = encodeURIComponent(`Ola! Fiz o pedido ${orderNumber} e quero acompanhar por aqui.`);
  return `https://wa.me/${phone}?text=${text}`;
}

function isPizzaProduct(product: Product) {
  return product.addonGroups.some(group => group.name.toLowerCase().includes("sabor"));
}

function textKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isBeverageCategory(category: MenuCategory) {
  const name = textKey(category.name);
  return ["bebida", "refrigerante", "suco", "agua", "cerveja"].some(term => name.includes(term));
}

function isJuiceCategory(category: MenuCategory) {
  return textKey(category.name).includes("suco");
}

function isAdditionalCategory(category: MenuCategory) {
  const name = textKey(category.name);
  return ["adicional", "extra", "borda", "molho", "porcao"].some(term => name.includes(term));
}

function scrollToMenuSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function MenuQuickNav({ beverageId, additionalId, onPizzas, onBeverages }: { beverageId?: string; additionalId?: string; onPizzas?: () => void; onBeverages?: () => void }) {
  return (
    <nav className="menuQuickNav" aria-label="Categorias do cardapio">
      <button type="button" onClick={() => onPizzas ? onPizzas() : scrollToMenuSection("menu-pizzas")}>Pizzas</button>
      <button type="button" onClick={() => beverageId && (onBeverages ? onBeverages() : scrollToMenuSection("menu-bebidas"))} disabled={!beverageId}>Bebidas</button>
      <button type="button" onClick={() => additionalId && scrollToMenuSection("menu-adicionais")} disabled={!additionalId}>Adicionais</button>
    </nav>
  );
}

function pizzaSizePublicName(product: Product) {
  const name = textKey(product.name);
  if (!isPizzaProduct(product)) return product.name;
  if (name.includes("30cm") || name.includes("media")) return "Pizzas tamanho Media - 8 Fatias";
  if (name.includes("35cm") || name.includes("grande")) return "Pizzas tamanho Grande - 10 Fatias";
  if (name.includes("40cm") || name.includes("gigante")) return "Pizzas tamanho Gigante - 12 Fatias";
  if (name.includes("50cm") || name.includes("maracana")) return "Pizzas tamanho Maracanã - 20 Fatias";
  return product.name;
}

function pizzaSizePublicDescription(product: Product) {
  if (!isPizzaProduct(product)) return product.description;
  return "Pizza com até 2 sabores. Escolha o tamanho e em seguida escolha o sabor";
}

function productPrice(product: Product) {
  return money(product.promotionalPrice ?? product.price);
}

function pizzaTotalFor(product: Product, selectedFlavorNames: string[]) {
  const flavorAddons = product.addonGroups
    .find(group => textKey(group.name).includes("sabor"))
    ?.addons || [];
  const selectedFlavorPrices = selectedFlavorNames
    .map(name => flavorAddons.find(addon => textKey(addon.name) === name))
    .filter((addon): addon is ProductAddon => Boolean(addon))
    .map(addon => money(addon.price));

  return Math.max(productPrice(product), ...selectedFlavorPrices);
}

function imageFor(item: { imageUrl?: string | null }) {
  return item.imageUrl || "/pizza-thumb.jpeg";
}

async function publicApi<T>(slug: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/public/${slug}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Erro na API");
  }
  return data as T;
}

async function customerApi<T>(slug: string, path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/customer/${slug}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Erro na API");
  }
  return data as T;
}

async function customerAuthApi<T>(slug: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/customer-auth/${slug}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Erro na API");
  }
  return data as T;
}

function encodeCustomerOAuthState(slug: string) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(`vib-customer-oauth:${slug}`, nonce);
  return window.btoa(JSON.stringify({ type: "customer", slug, nonce }));
}

function decodeCustomerOAuthState(rawState: string | null) {
  try {
    const parsed = JSON.parse(window.atob(String(rawState || "")));
    if (parsed?.type === "customer" && parsed?.slug) return parsed as { slug: string; nonce?: string };
  } catch {
    return null;
  }
  return null;
}

function customerGoogleAuthUrl(slug: string, clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin,
    response_type: "code",
    scope: "openid email profile",
    state: encodeCustomerOAuthState(slug),
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function persistCustomerSession(slug: string, session: CustomerSession) {
  localStorage.setItem(`vib-customer-session:${slug}`, JSON.stringify(session));
}

export function CustomerOAuthCallbackApp() {
  const [message, setMessage] = useState("Validando login Google...");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || "";
    const state = decodeCustomerOAuthState(params.get("state"));
    if (!code || !state?.slug) {
      setError("Retorno Google invalido.");
      return;
    }

    const expectedNonce = localStorage.getItem(`vib-customer-oauth:${state.slug}`);
    if (state.nonce && expectedNonce && state.nonce !== expectedNonce) {
      setError("Sessao Google expirada. Tente entrar novamente.");
      return;
    }

    customerAuthApi<CustomerSession>(state.slug, "/google-code", {
      method: "POST",
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin
      })
    })
      .then(session => {
        localStorage.removeItem(`vib-customer-oauth:${state.slug}`);
        persistCustomerSession(state.slug, session);
        setMessage("Login confirmado. Abrindo sua conta...");
        window.location.replace(`/cliente/${state.slug}`);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Falha no login Google."));
  }, []);

  return (
    <main className="customerPortal">
      <section className="customerLoginCard">
        <CalendarDays />
        <h1>{error ? "Nao foi possivel entrar" : "Entrando com Google"}</h1>
        <p>{error || message}</p>
        {error && <a className="customerGoogleButton" href="/cliente/brum-cortes-barbearia">Voltar para o login</a>}
      </section>
    </main>
  );
}

export function CustomerPortalApp({ slug }: { slug: string }) {
  const storageKey = `vib-customer-session:${slug}`;
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const [session, setSession] = useState<CustomerSession | null>(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CustomerSession;
    } catch {
      return null;
    }
  });
  const [catalog, setCatalog] = useState<{
    company: PublicCompany;
    services: PublicService[];
    professionals: PublicProfessional[];
  } | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(session?.customer || null);
  const [appointments, setAppointments] = useState<PublicAppointment[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [phone, setPhone] = useState(session?.customer?.phone || session?.customer?.whatsapp || "");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customerApi<typeof catalog>(slug, "/catalog")
      .then(data => {
        setCatalog(data);
        const firstService = data?.services?.[0];
        if (firstService) {
          setSelectedServiceId(current => current || firstService.id);
          const firstProfessional = firstService.professionalServices?.[0]?.professional;
          if (firstProfessional) setSelectedProfessionalId(current => current || firstProfessional.id);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar painel do cliente"));
  }, [slug]);

  useEffect(() => {
    if (!session?.token) return;
    customerApi<{
      customer: CustomerProfile;
      appointments: PublicAppointment[];
    }>(slug, "/me", session.token)
      .then(data => {
        setCustomer(data.customer);
        setPhone(data.customer.phone || data.customer.whatsapp || "");
        setAppointments(data.appointments || []);
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
        setSession(null);
      });
  }, [session?.token, slug, storageKey]);

  const selectedService = catalog?.services.find(service => service.id === selectedServiceId) || null;
  const serviceProfessionals = selectedService?.professionalServices?.map(item => item.professional).filter(Boolean) || [];
  const company = catalog?.company || session?.company;
  const googleAuthUrl = googleClientId ? customerGoogleAuthUrl(slug, googleClientId) : "";

  function applyCustomerSession(nextSession: CustomerSession) {
    persistCustomerSession(slug, nextSession);
    setSession(nextSession);
    setCustomer(nextSession.customer);
    setPhone(nextSession.customer.phone || nextSession.customer.whatsapp || "");
    setIdentifier("");
    setPassword("");
    setRegisterPassword("");
  }

  async function submitCustomerAuth(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const nextSession =
        loginMode === "login"
          ? await customerAuthApi<CustomerSession>(slug, "/login", {
              method: "POST",
              body: JSON.stringify({ identifier, password })
            })
          : await customerAuthApi<CustomerSession>(slug, "/register", {
              method: "POST",
              body: JSON.stringify({
                name: registerName,
                email: registerEmail,
                phone: registerPhone,
                password: registerPassword
              })
            });
      applyCustomerSession(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await customerApi<{ customer: CustomerProfile }>(slug, "/profile", session.token, {
        method: "PATCH",
        body: JSON.stringify({
          name: customer?.name,
          phone
        })
      });
      setCustomer(result.customer);
      const nextSession = { ...session, customer: result.customer };
      setSession(nextSession);
      localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setSuccess("Perfil atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function createAppointment(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (phone && phone !== customer?.phone && phone !== customer?.whatsapp) {
        await customerApi(slug, "/profile", session.token, {
          method: "PATCH",
          body: JSON.stringify({ name: customer?.name, phone })
        });
      }
      const result = await customerApi<{ appointment: PublicAppointment }>(slug, "/appointments", session.token, {
        method: "POST",
        body: JSON.stringify({
          serviceId: selectedServiceId,
          professionalId: selectedProfessionalId || undefined,
          date,
          time,
          notes
        })
      });
      setAppointments(current => [result.appointment, ...current]);
      setNotes("");
      setSuccess("Agendamento solicitado. A equipe vai confirmar pelo WhatsApp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setSession(null);
    setCustomer(null);
    setAppointments([]);
  }

  if (!catalog && !company) {
    return <main className="customerPortal"><div className="publicLoading">{error || "Carregando painel do cliente..."}</div></main>;
  }

  return (
    <main className="customerPortal">
      <header className="customerPortalHeader">
        <div className="publicBrand">
          {company && <PublicCompanyMark company={company} />}
          <div>
            <strong>{company?.name || "Painel do cliente"}</strong>
            <span>Minha conta, agendamentos e historico.</span>
          </div>
        </div>
        {session ? (
          <button type="button" className="customerLogout" onClick={logout}>
            <LogOut /> Sair
          </button>
        ) : null}
      </header>

      {!session ? (
        <section className="customerLoginCard">
          <h1>{loginMode === "login" ? "Entrar" : "Cadastrar"}</h1>
          <form className="customerAuthForm" onSubmit={submitCustomerAuth}>
            {loginMode === "register" && (
              <label>
                Nome
                <input value={registerName} onChange={event => setRegisterName(event.target.value)} required />
              </label>
            )}
            <label>
              {loginMode === "login" ? "Telefone, nome de usuario ou email" : "Email"}
              <input
                value={loginMode === "login" ? identifier : registerEmail}
                onChange={event => (loginMode === "login" ? setIdentifier(event.target.value) : setRegisterEmail(event.target.value))}
                autoComplete={loginMode === "login" ? "username" : "email"}
                type={loginMode === "register" ? "email" : "text"}
                required
              />
            </label>
            {loginMode === "register" && (
              <label>
                WhatsApp
                <input value={registerPhone} onChange={event => setRegisterPhone(event.target.value)} placeholder="(27) 99999-9999" required />
              </label>
            )}
            <label>
              Senha
              <input
                value={loginMode === "login" ? password : registerPassword}
                onChange={event => (loginMode === "login" ? setPassword(event.target.value) : setRegisterPassword(event.target.value))}
                autoComplete={loginMode === "login" ? "current-password" : "new-password"}
                type="password"
                minLength={6}
                required
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Aguarde..." : loginMode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <div className="customerAuthDivider"><span />ou<span /></div>
          {googleClientId ? (
            <a className="customerGoogleButton" href={googleAuthUrl}>
              <strong>G</strong> Entrar com Google
            </a>
          ) : (
            <div className="error">Configure VITE_GOOGLE_CLIENT_ID no frontend para habilitar o login Google.</div>
          )}
          <p className="customerAuthSwitch">
            {loginMode === "login" ? "Novo por aqui?" : "Ja tenho conta."}
            <button type="button" onClick={() => {
              setError("");
              setLoginMode(current => (current === "login" ? "register" : "login"));
            }}>
              {loginMode === "login" ? "Cadastrar" : "Entrar"}
            </button>
          </p>
          {error && <div className="error">{error}</div>}
        </section>
      ) : (
        <div className="customerPortalGrid">
          <section className="customerCard">
            <h2>Meus dados</h2>
            <form onSubmit={saveProfile} className="customerForm">
              <label>
                Nome
                <input
                  value={customer?.name || ""}
                  onChange={event => setCustomer(current => ({ ...(current || session.customer), name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input value={customer?.email || session.account.email || ""} disabled />
              </label>
              <label>
                WhatsApp
                <input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(27) 99999-9999" />
              </label>
              <button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar dados"}</button>
            </form>
          </section>

          <section className="customerCard scheduleCard">
            <h2>Novo agendamento</h2>
            <form onSubmit={createAppointment} className="customerForm">
              <label>
                Servico
                <select
                  value={selectedServiceId}
                  onChange={event => {
                    const nextServiceId = event.target.value;
                    setSelectedServiceId(nextServiceId);
                    const nextService = catalog?.services.find(service => service.id === nextServiceId);
                    setSelectedProfessionalId(nextService?.professionalServices?.[0]?.professional?.id || "");
                  }}
                >
                  {catalog?.services.map(service => (
                    <option value={service.id} key={service.id}>
                      {service.name} - {brl(service.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Barbeiro
                <select value={selectedProfessionalId} onChange={event => setSelectedProfessionalId(event.target.value)}>
                  <option value="">Qualquer profissional</option>
                  {serviceProfessionals.map(professional => (
                    <option value={professional.id} key={professional.id}>{professional.name}</option>
                  ))}
                </select>
              </label>
              <div className="customerFormSplit">
                <label>
                  Data
                  <input type="date" value={date} onChange={event => setDate(event.target.value)} />
                </label>
                <label>
                  Horario
                  <input type="time" value={time} onChange={event => setTime(event.target.value)} />
                </label>
              </div>
              <label>
                Observacao
                <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: preferencia de corte, horario flexivel..." />
              </label>
              {selectedService && (
                <div className="selectedServiceSummary">
                  <strong>{selectedService.name}</strong>
                  <span>{selectedService.durationMinutes} min - {brl(selectedService.price)}</span>
                </div>
              )}
              <button type="submit" disabled={saving || !selectedServiceId || !phone}>
                {saving ? "Agendando..." : "Solicitar agendamento"}
              </button>
              {!phone && <small className="muted">Informe seu WhatsApp para liberar o agendamento.</small>}
            </form>
          </section>

          <section className="customerCard appointmentsCard">
            <h2>Meus agendamentos</h2>
            {appointments.length === 0 ? (
              <p className="muted">Nenhum agendamento por enquanto.</p>
            ) : (
              <div className="customerAppointments">
                {appointments.map(appointment => (
                  <article key={appointment.id}>
                    <div>
                      <strong>{appointment.service?.name || "Servico"}</strong>
                      <span>{appointment.professional?.name || "Qualquer profissional"}</span>
                      <small>{publicDateTime(appointment.date)} - {appointment.time}</small>
                    </div>
                    <b>{appointment.status}</b>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {(success || error) && session ? (
        <div className={error ? "customerToast error" : "customerToast"}>{error || success}</div>
      ) : null}
    </main>
  );
}

export function PublicMenuApp({ slug }: { slug: string }) {
  const prefill = useMemo(publicPrefillFromLocation, []);
  const cartStorageKey = publicMenuStorageKey(slug, "cart");
  const viewStorageKey = publicMenuStorageKey(slug, "view");
  const lastOrderStorageKey = publicMenuStorageKey(slug, "last-order");
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [view, setView] = useState<View>(() => {
    if (prefill.initialView === "orders") return "orders";
    const storedView = readPublicMenuStorage<View>(viewStorageKey, "home");
    return ["home", "pizzas", "beverages", "juices", "additionals", "checkout", "orders"].includes(storedView) ? storedView : "home";
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => readPublicMenuStorage<CartItem[]>(cartStorageKey, []));
  const [addedProductId, setAddedProductId] = useState("");
  const [error, setError] = useState("");
  const [lastOrder, setLastOrder] = useState<PublicOrder | null>(() => readPublicMenuStorage<PublicOrder | null>(lastOrderStorageKey, null));
  const isBarbershop = isPublicBarbershop(data?.company);

  useEffect(() => {
    publicApi<PublicMenuResponse>(slug, "/menu")
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar catalogo"));
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    document.title = `${isPublicBarbershop(data.company) ? "Agendamentos" : "Cardápio"} | ${data.company.name}`;
  }, [data]);

  useEffect(() => {
    writePublicMenuStorage(cartStorageKey, cart);
  }, [cart, cartStorageKey]);

  useEffect(() => {
    writePublicMenuStorage(viewStorageKey, view);
  }, [view, viewStorageKey]);

  useEffect(() => {
    writePublicMenuStorage(lastOrderStorageKey, lastOrder);
  }, [lastOrder, lastOrderStorageKey]);

  useEffect(() => {
    if (view === "checkout" && cart.length === 0) setView("home");
  }, [cart.length, view]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );

  const pizzaProducts = useMemo(
    () => (isBarbershop ? [] : data?.categories.flatMap(category => category.products.filter(isPizzaProduct)) || []),
    [data, isBarbershop]
  );

  const regularCategories = useMemo(
    () =>
      data?.categories
        .map(category => ({
          ...category,
          products: isBarbershop ? category.products : category.products.filter(product => !isPizzaProduct(product))
        }))
        .filter(category => category.products.length > 0) || [],
    [data, isBarbershop]
  );
  const firstBeverageCategoryId = regularCategories.find(isBeverageCategory)?.id;
  const firstAdditionalCategoryId = regularCategories.find(isAdditionalCategory)?.id;
  const beverageCategories = regularCategories.filter(category => isBeverageCategory(category) && !isJuiceCategory(category));
  const juiceCategories = regularCategories.filter(isJuiceCategory);
  const additionalCategories = regularCategories.filter(isAdditionalCategory);

  function addProduct(product: Product) {
    setCart(current => [
      ...current,
      {
        key: `${product.id}-${Date.now()}-${current.length}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: productPrice(product),
        addons: []
      }
    ]);
    setAddedProductId(product.id);
    window.setTimeout(() => {
      setAddedProductId(current => (current === product.id ? "" : current));
    }, 1600);
  }

  function openPizza(product: Product) {
    setSelectedProduct(product);
    setView("pizza");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go(viewName: View) {
    setView(viewName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function shareMenu() {
    const shareTitle = isBarbershop ? "Servicos" : "Cardapio";
    const shareData = {
      title: data?.company.name || shareTitle,
      text: `${shareTitle} ${data?.company.name || ""}`.trim(),
      url: window.location.href
    };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
  }

  if (!data) {
    return (
      <main className="publicMenu">
        <div className="publicLoading" role="status">
          {!error && <span className="publicLoadingSpinner" aria-hidden="true" />}
          <span>{error || "Carregando cardapio..."}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="publicMenu">
      <div className="publicPageTransition" key={view}>
        {view === "home" ? (
        <PublicHomeView
          company={data.company}
          categories={data.categories}
          pizzaProducts={pizzaProducts}
          onPizzas={() => go("pizzas")}
          onBeverages={() => go("beverages")}
          onJuices={() => go("juices")}
          onAdditionals={() => go("additionals")}
          onOrders={() => go("orders")}
          onShare={shareMenu}
        />
      ) : view === "pizzas" ? (
        <PizzaBuilderView
          company={data.company}
          products={pizzaProducts}
          onBack={() => go("home")}
          onAdd={item => {
            setCart(current => [...current, item]);
            go("home");
          }}
        />
      ) : view === "beverages" ? (
        <CategoryPageView
          company={data.company}
          title="Refrigerantes"
          categories={beverageCategories}
          addedProductId={addedProductId}
          onBack={() => go("home")}
          onAdd={addProduct}
        />
      ) : view === "juices" ? (
        <CategoryPageView
          company={data.company}
          title="Sucos"
          categories={juiceCategories}
          addedProductId={addedProductId}
          onBack={() => go("home")}
          onAdd={addProduct}
        />
      ) : view === "additionals" ? (
        <CategoryPageView
          company={data.company}
          title="Adicionais"
          categories={additionalCategories}
          addedProductId={addedProductId}
          onBack={() => go("home")}
          onAdd={addProduct}
        />
      ) : view === "pizza" && selectedProduct ? (
        <PizzaFlavorView
          product={selectedProduct}
          company={data.company}
          onBack={() => go("home")}
          onAdd={item => {
            setCart(current => [...current, item]);
            go("home");
          }}
          onShare={shareMenu}
        />
      ) : view === "checkout" ? (
        <CheckoutView
          company={data.company}
          cart={cart}
          total={total}
          slug={slug}
          prefill={prefill}
          onBack={() => go("home")}
          onRemove={key => setCart(current => current.filter(item => item.key !== key))}
          onOrderCreated={order => {
            setLastOrder(order);
            setCart([]);
            go("orders");
          }}
        />
      ) : view === "orders" ? (
        <OrdersView
          company={data.company}
          slug={slug}
          lastOrder={lastOrder}
          initialPhone={prefill.customerPhone}
          onBack={() => go("home")}
          onRepeat={order => {
            setCart(orderToCart(order));
            go("checkout");
          }}
        />
      ) : (
        <>
          <PublicHeader company={data.company} onShare={shareMenu} />
          {!isBarbershop && <MenuQuickNav beverageId={firstBeverageCategoryId} additionalId={firstAdditionalCategoryId} onPizzas={() => go("pizzas")} onBeverages={() => go("beverages")} />}
          <section className="publicFeatured">
            <div>
              <strong>{publicGreeting()}, seja bem-vindo a {data.company.name}</strong>
              <span>
                {isBarbershop
                  ? "Veja cortes, servicos e produtos disponiveis. Para agendar ou tirar duvidas, fale com o atendimento."
                  : "Veja o cardapio, monte seu pedido e acompanhe tudo pelo WhatsApp."}
              </span>
            </div>
          </section>
          {!isBarbershop && pizzaProducts.length > 0 && (
            <section className="publicSection" id="menu-pizzas">
              <h2>Pizzas</h2>
              <div className="publicList">
                {pizzaProducts.map(product => (
                  <button className="publicItem" type="button" key={product.id} onClick={() => openPizza(product)}>
                    <div>
                      <strong>{pizzaSizePublicName(product)}</strong>
                      <span>{pizzaSizePublicDescription(product)}</span>
                      <small>A partir de</small>
                      <b>{brl(product.price)}</b>
                    </div>
                    <img src={imageFor(product)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {regularCategories.map(category => (
            <section className="publicSection" key={category.id} id={category.id === firstBeverageCategoryId ? "menu-bebidas" : category.id === firstAdditionalCategoryId ? "menu-adicionais" : undefined}>
              <h2>{category.name}</h2>
              <div className="publicGrid">
                {category.products.map(product => (
                  <button
                    className={addedProductId === product.id ? "publicItem added" : "publicItem"}
                    type="button"
                    key={product.id}
                    onClick={() => addProduct(product)}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.description}</span>
                      <b>{brl(product.price)}</b>
                      {addedProductId === product.id && <small className="addedToCartNotice">Adicionado a sacola</small>}
                    </div>
                    <img src={imageFor(product)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
        )}
      </div>

      <BottomNav
        current={view}
        cartCount={cart.length}
        onHome={() => go("home")}
        onCart={() => go("checkout")}
        onOrders={() => go("orders")}
      />
    </main>
  );
}

export function WaiterOrderApp({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicMenuResponse | null>(null);
  const [view, setView] = useState<"menu" | "pizza" | "checkout" | "success">("menu");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addedProductId, setAddedProductId] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [createdOrder, setCreatedOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isBarbershop = isPublicBarbershop(data?.company);

  useEffect(() => {
    publicApi<PublicMenuResponse>(slug, "/menu")
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar catalogo"));
  }, [slug]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );
  const pizzaProducts = useMemo(
    () => (isBarbershop ? [] : data?.categories.flatMap(category => category.products.filter(isPizzaProduct)) || []),
    [data, isBarbershop]
  );
  const regularCategories = useMemo(
    () =>
      data?.categories
        .map(category => ({
          ...category,
          products: isBarbershop ? category.products : category.products.filter(product => !isPizzaProduct(product))
        }))
        .filter(category => category.products.length > 0) || [],
    [data, isBarbershop]
  );
  const firstBeverageCategoryId = regularCategories.find(isBeverageCategory)?.id;
  const firstAdditionalCategoryId = regularCategories.find(isAdditionalCategory)?.id;

  function go(nextView: "menu" | "pizza" | "checkout" | "success") {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addProduct(product: Product) {
    setCart(current => [
      ...current,
      {
        key: `${product.id}-${Date.now()}-${current.length}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: productPrice(product),
        addons: []
      }
    ]);
    setAddedProductId(product.id);
    window.setTimeout(() => {
      setAddedProductId(current => (current === product.id ? "" : current));
    }, 1600);
  }

  function openPizza(product: Product) {
    setSelectedProduct(product);
    go("pizza");
  }

  async function submitTableOrder(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!tableNumber.trim()) {
      setError(isBarbershop ? "Informe o numero da cadeira." : "Informe o numero da mesa.");
      return;
    }
    if (cart.length === 0) {
      setError("Adicione pelo menos um item.");
      return;
    }

    setSaving(true);
    try {
      const result = await publicApi<{ order: PublicOrder }>(slug, "/orders", {
        method: "POST",
        body: JSON.stringify({
          orderType: "table",
          paymentMethod: isBarbershop ? "Atendimento local" : "Mesa/salao",
          customer: {
            name: customerName || `${isBarbershop ? "Cadeira" : "Mesa"} ${tableNumber}`,
            phone: ""
          },
          table: {
            number: tableNumber,
            waiterName,
            customerName
          },
          notes,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
            addonIds: item.addons.map(addon => addon.id)
          }))
        })
      });
      setCreatedOrder(result.order);
      setCart([]);
      go("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <main className="publicMenu waiterMenu">
        <div className="publicLoading">{error || (isBarbershop ? "Carregando atendimento..." : "Carregando comanda...")}</div>
      </main>
    );
  }

  return (
    <main className="publicMenu waiterMenu">
      {view === "pizza" && selectedProduct ? (
        <PizzaFlavorView
          product={selectedProduct}
          company={data.company}
          onBack={() => go("menu")}
          onAdd={item => {
            setCart(current => [...current, item]);
            go("menu");
          }}
          actionLabel="Adicionar a comanda"
        />
      ) : view === "checkout" ? (
        <WaiterCheckoutView
          cart={cart}
          total={total}
          tableNumber={tableNumber}
          waiterName={waiterName}
          customerName={customerName}
          notes={notes}
          saving={saving}
          error={error}
          onBack={() => go("menu")}
          onRemove={key => setCart(current => current.filter(item => item.key !== key))}
          onTableNumberChange={setTableNumber}
          onWaiterNameChange={setWaiterName}
          onCustomerNameChange={setCustomerName}
          onNotesChange={setNotes}
          onSubmit={submitTableOrder}
          variant={isBarbershop ? "barbershop" : "restaurant"}
        />
      ) : view === "success" ? (
        <WaiterSuccessView
          order={createdOrder}
          tableNumber={tableNumber}
          variant={isBarbershop ? "barbershop" : "restaurant"}
          onNewOrder={() => {
            setNotes("");
            setCustomerName("");
            setCreatedOrder(null);
            go("menu");
          }}
        />
      ) : (
        <>
          <WaiterHeader company={data.company} />
          {!isBarbershop && <MenuQuickNav beverageId={firstBeverageCategoryId} additionalId={firstAdditionalCategoryId} />}
          <section className="waiterDock">
            <label>
              {isBarbershop ? "Cadeira" : "Mesa"}
              <input
                value={tableNumber}
                onChange={event => setTableNumber(event.target.value)}
                inputMode="numeric"
                placeholder="Ex.: 04"
              />
            </label>
            <label>
              {isBarbershop ? "Atendente" : "Garcom"}
              <input value={waiterName} onChange={event => setWaiterName(event.target.value)} placeholder="Nome" />
            </label>
            <button type="button" onClick={() => go("checkout")} disabled={cart.length === 0}>
              {isBarbershop ? "Fechar atendimento" : "Fechar comanda"}
            </button>
          </section>
          {!isBarbershop && pizzaProducts.length > 0 && (
            <section className="publicSection" id="menu-pizzas">
              <h2>Pizzas</h2>
              <div className="publicList">
                {pizzaProducts.map(product => (
                  <button className="publicItem" type="button" key={product.id} onClick={() => openPizza(product)}>
                    <div>
                      <strong>{pizzaSizePublicName(product)}</strong>
                      <span>{pizzaSizePublicDescription(product)}</span>
                      <small>A partir de</small>
                      <b>{brl(product.price)}</b>
                    </div>
                    <img src={imageFor(product)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {regularCategories.map(category => (
            <section className="publicSection" key={category.id} id={category.id === firstBeverageCategoryId ? "menu-bebidas" : category.id === firstAdditionalCategoryId ? "menu-adicionais" : undefined}>
              <h2>{category.name}</h2>
              <div className="publicGrid">
                {category.products.map(product => (
                  <button
                    className={addedProductId === product.id ? "publicItem added" : "publicItem"}
                    type="button"
                    key={product.id}
                    onClick={() => addProduct(product)}
                  >
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.description}</span>
                      <b>{brl(product.price)}</b>
                      {addedProductId === product.id && <small className="addedToCartNotice">Adicionado a comanda</small>}
                    </div>
                    <img src={imageFor(product)} alt="" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <CartButton count={cart.length} total={total} onClick={() => go("checkout")} />
    </main>
  );
}

function PublicHomeView({
  company,
  categories,
  pizzaProducts,
  onPizzas,
  onBeverages,
  onJuices,
  onAdditionals,
  onOrders,
  onShare
}: {
  company: PublicCompany;
  categories: MenuCategory[];
  pizzaProducts: Product[];
  onPizzas: () => void;
  onBeverages: () => void;
  onJuices: () => void;
  onAdditionals: () => void;
  onOrders: () => void;
  onShare: () => void;
}) {
  const beverageCategory = categories.find(category => isBeverageCategory(category) && !isJuiceCategory(category));
  const juiceCategory = categories.find(isJuiceCategory);
  const additionalCategory = categories.find(isAdditionalCategory);
  const useBigBurgerHomeBanner = company.slug === "pizzaria-big-burguer";
  const categoryShortcuts = [
    { id: "pizzas", name: "Pizzas", icon: <Pizza />, onClick: onPizzas, disabled: pizzaProducts.length === 0 },
    { id: beverageCategory?.id || "refrigerantes", name: beverageCategory?.name || "Refrigerantes", icon: <CupSoda />, onClick: onBeverages, disabled: !beverageCategory?.products.length },
    { id: juiceCategory?.id || "sucos", name: juiceCategory?.name || "Sucos", icon: <CupSoda />, onClick: onJuices, disabled: !juiceCategory?.products.length },
    { id: additionalCategory?.id || "adicionais", name: additionalCategory?.name || "Adicionais", icon: <ShoppingBag />, onClick: onAdditionals, disabled: !additionalCategory?.products.length }
  ];
  return (
    <>
      <PublicHeader company={company} onShare={onShare} />
      <section className={useBigBurgerHomeBanner ? "publicHomeHero publicHomeHeroBanner" : "publicHomeHero"}>
        {useBigBurgerHomeBanner ? (
          <img className="publicHomeBannerImage" src="/big-burguer-home-banner.png" alt="Seu cardápio de forma rápida e prática" />
        ) : (
          <>
        <div>
          <span>{publicGreeting()}</span>
          <h1>Seu cardápio online</h1>
          <p>Peça de forma rápida e prática.</p>
          <button type="button" onClick={onPizzas}>Ver pizzas</button>
        </div>
        <div className="publicHomeHeroOrb" aria-hidden="true">
          {pizzaProducts[0]?.imageUrl ? <img src={pizzaProducts[0].imageUrl} alt="Pizza em destaque" /> : <Pizza className="publicHomeHeroPizza" />}
        </div>
          </>
        )}
      </section>
      <section className="publicHomeCategories" aria-label="Categorias em destaque">
        {categoryShortcuts.map(category => (
          <button type="button" key={category.id} onClick={category.onClick} disabled={category.disabled}>
            <span>{category.icon}</span>
            <strong>{category.name}</strong>
          </button>
        ))}
      </section>
      {useBigBurgerHomeBanner && (
        <section className="publicHomeDeliveryBanner">
          <img src="/big-burguer-delivery-banner.png" alt="Levamos sua pizza até você" />
        </section>
      )}
    </>
  );
}

function PizzaBuilderView({
  company,
  products,
  onBack,
  onAdd
}: {
  company: PublicCompany;
  products: Product[];
  onBack: () => void;
  onAdd: (item: CartItem) => void;
}) {
  const [step, setStep] = useState<"flavors" | "size">("flavors");
  const [selectedFlavorNames, setSelectedFlavorNames] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isPizzaSummaryOpen, setIsPizzaSummaryOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const baseProduct = products[0];
  const baseFlavors = baseProduct?.addonGroups.find(group => textKey(group.name).includes("sabor"))?.addons || [];
  const selectedProduct = products.find(product => product.id === selectedProductId);
  const selectedAddons = selectedProduct
    ? selectedFlavorNames
        .map(name => selectedProduct.addonGroups.find(group => textKey(group.name).includes("sabor"))?.addons.find(addon => textKey(addon.name) === name))
        .filter((addon): addon is ProductAddon => Boolean(addon))
    : [];
  const total = selectedProduct ? pizzaTotalFor(selectedProduct, selectedFlavorNames) : 0;
  const selectedFlavorLabels = baseFlavors
    .filter(flavor => selectedFlavorNames.includes(textKey(flavor.name)))
    .map(flavor => flavor.name);

  function toggleFlavor(flavor: ProductAddon) {
    const name = textKey(flavor.name);
    setSelectedFlavorNames(current => {
      if (current.includes(name)) return current.filter(item => item !== name);
      if (current.length >= 2) return current;
      return [...current, name];
    });
  }

  useEffect(() => {
    if (step !== "flavors" || selectedFlavorNames.length !== 2) return;
    const timer = window.setTimeout(() => continueButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [selectedFlavorNames.length, step]);

  useEffect(() => {
    if (step === "size") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function addPizza() {
    if (!selectedProduct || selectedAddons.length === 0) return;
    setIsPizzaSummaryOpen(false);
    onAdd({
      key: `${selectedProduct.id}-${Date.now()}`,
      productId: selectedProduct.id,
      productName: pizzaSizePublicName(selectedProduct),
      quantity: 1,
      unitPrice: total,
      notes,
      addons: selectedAddons.map(addon => ({ id: addon.id, name: addon.name, price: money(addon.price) }))
    });
  }

  function selectPizzaSize(productId: string) {
    setSelectedProductId(productId);
    setIsPizzaSummaryOpen(true);
  }

  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={step === "size" ? () => setStep("flavors") : onBack} className="plainIcon"><ArrowLeft /></button>
        <strong>{step === "flavors" ? "Escolha os sabores" : "Escolha o tamanho"}</strong>
        <span />
      </header>
      {step === "flavors" ? (
        <>
          <section className="publicSection noTopGap pizzaBuilderStep">
            <div className="flavorTitle"><div><h2>Sabores</h2><p>Escolha entre 1 e 2 sabores.</p></div><strong>{selectedFlavorNames.length}/2</strong></div>
            <div className="flavorList pizzaBuilderList">
              {baseFlavors.map(flavor => {
                const selected = selectedFlavorNames.includes(textKey(flavor.name));
                return <button className={selected ? "flavorItem selected" : "flavorItem"} type="button" key={flavor.id} disabled={!selected && selectedFlavorNames.length >= 2} onClick={() => toggleFlavor(flavor)}><img src={imageFor(flavor)} alt="" /><div><strong>{flavor.name}</strong><span>{flavor.description}</span></div></button>;
              })}
            </div>
            <section className="observationBox"><h2>Observações</h2><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: sem cebola, bem assada..." /></section>
          </section>
          <div className="publicActionBar"><button ref={continueButtonRef} type="button" disabled={selectedFlavorNames.length === 0} onClick={() => setStep("size")}>Continuar para tamanhos</button></div>
        </>
      ) : (
        <>
          <section className="publicSection noTopGap pizzaBuilderStep pizzaBuilderSizesStep">
            <div className="flavorTitle"><div><h2>Tamanho</h2><p>Os sabores selecionados serão mantidos.</p></div></div>
            <div className="publicList pizzaBuilderSizes">
              {products.map(product => {
                return <button className={selectedProductId === product.id ? "publicItem added" : "publicItem"} type="button" key={product.id} onClick={() => selectPizzaSize(product.id)}><div><strong>{pizzaSizePublicName(product)}</strong><span>{selectedFlavorNames.length === 2 ? "Pizza com 2 sabores" : "Pizza com 1 sabor"}</span></div><img src={imageFor(product)} alt="" /></button>;
              })}
            </div>
          </section>
          {isPizzaSummaryOpen && selectedProduct && (
            <div className="modalBackdrop pizzaSummaryBackdrop" role="presentation" onMouseDown={() => setIsPizzaSummaryOpen(false)}>
              <section className="pizzaSummaryModal" role="dialog" aria-modal="true" aria-labelledby="pizza-summary-title" onMouseDown={event => event.stopPropagation()}>
                <button className="pizzaSummaryClose" type="button" aria-label="Fechar resumo" onClick={() => setIsPizzaSummaryOpen(false)}>×</button>
                <span>Pizza selecionada</span>
                <h2 id="pizza-summary-title">{pizzaSizePublicName(selectedProduct)}</h2>
                <p>{selectedFlavorLabels.join(" e ")}</p>
                <div className="pizzaSummaryTotal"><span>Total da pizza</span><strong>{brl(total)}</strong></div>
                <button className="pizzaSummaryAdd" type="button" disabled={!company.acceptOrders} onClick={addPizza}>Adicionar ao pedido</button>
                <button className="pizzaSummaryChange" type="button" onClick={() => setIsPizzaSummaryOpen(false)}>Escolher outro tamanho</button>
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}

function CategoryPageView({
  company,
  title,
  products = [],
  categories = [],
  addedProductId = "",
  pizzaMode = false,
  onBack,
  onPizza,
  onAdd
}: {
  company: PublicCompany;
  title: string;
  products?: Product[];
  categories?: MenuCategory[];
  addedProductId?: string;
  pizzaMode?: boolean;
  onBack: () => void;
  onPizza?: (product: Product) => void;
  onAdd: (product: Product) => void;
}) {
  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={onBack} className="plainIcon"><ArrowLeft /></button>
        <strong>{title}</strong>
        <span />
      </header>
      <section className="publicSection categoryPage">
        <p className="categoryPageIntro">Escolha seus produtos e adicione ao pedido.</p>
        {pizzaMode ? (
          <div className="publicList">
            {products.map(product => (
              <button className="publicItem" type="button" key={product.id} onClick={() => onPizza?.(product)}>
                <div><strong>{pizzaSizePublicName(product)}</strong><span>{pizzaSizePublicDescription(product)}</span><small>A partir de</small><b>{brl(product.price)}</b></div>
                <img src={imageFor(product)} alt="" />
              </button>
            ))}
          </div>
        ) : categories.map(category => (
          <div key={category.id} className="categoryPageGroup">
            <h2>{category.name}</h2>
            <div className="publicGrid">
              {category.products.map(product => (
                <button className={addedProductId === product.id ? "publicItem added" : "publicItem"} type="button" key={product.id} onClick={() => onAdd(product)}>
                  <div><strong>{product.name}</strong><span>{product.description}</span><b>{brl(product.price)}</b>{addedProductId === product.id && <small className="addedToCartNotice">Adicionado ao pedido</small>}</div>
                  <img src={imageFor(product)} alt="" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function PublicHeader({ company, onShare }: { company: PublicCompany; onShare: () => void }) {
  return (
    <header className="publicHeader">
      <div className="publicBrand">
        <PublicCompanyMark company={company} />
        <div>
          <strong>{company.name}</strong>
        </div>
      </div>
      <div className="publicHeaderActions">
        <span className={company.acceptOrders ? "statusOpen" : "statusClosed"}>
          {company.acceptOrders ? "Aberta" : "Fechada"}
        </span>
      </div>
    </header>
  );
}

function WaiterHeader({ company }: { company: PublicCompany }) {
  const isBarbershop = isPublicBarbershop(company);
  return (
    <header className="publicHeader waiterHeader">
      <div className="publicBrand">
        <PublicCompanyMark company={company} />
        <div>
          <strong>{isBarbershop ? "Atendimento" : "Comanda de mesa"}</strong>
          <span>{company.name}</span>
        </div>
      </div>
      <button className={company.acceptOrders ? "statusOpen" : "statusClosed"} type="button">
        {company.acceptOrders ? "Online" : "Offline"}
      </button>
    </header>
  );
}

function PizzaFlavorView({
  product,
  company,
  onBack,
  onAdd,
  onShare,
  actionLabel = "Adicionar"
}: {
  product: Product;
  company: PublicCompany;
  onBack: () => void;
  onAdd: (item: CartItem) => void;
  onShare?: () => void;
  actionLabel?: string;
}) {
  const flavorGroup = product.addonGroups.find(group => group.name.toLowerCase().includes("sabor"));
  const flavors = flavorGroup?.addons || [];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const selectedFlavors = flavors.filter(flavor => selectedIds.includes(flavor.id));
  const unitPrice = selectedFlavors.length
    ? Math.max(productPrice(product), ...selectedFlavors.map(flavor => money(flavor.price)))
    : productPrice(product);

  function toggleFlavor(id: string) {
    setSelectedIds(current => {
      if (current.includes(id)) return current.filter(item => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }

  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={onBack} className="plainIcon">
          <ArrowLeft />
        </button>
        <strong>{pizzaSizePublicName(product)}</strong>
        {onShare ? (
          <button className="roundAction" type="button" onClick={onShare} title="Compartilhar cardapio">
            <Share2 />
          </button>
        ) : (
          <span />
        )}
      </header>
      <section className="publicSection noTopGap">
        <div className="flavorTitle">
          <div>
            <h2>Sabores</h2>
            <p>Escolha entre 1 e 2 sabores.</p>
          </div>
          <strong>{selectedIds.length}/2</strong>
        </div>
        <div className="flavorList">
          {flavors.map(flavor => {
            const selected = selectedIds.includes(flavor.id);
            const disabled = !selected && selectedIds.length >= 2;
            return (
              <button
                className={selected ? "flavorItem selected" : "flavorItem"}
                type="button"
                key={flavor.id}
                disabled={disabled}
                onClick={() => toggleFlavor(flavor.id)}
              >
                <img src={imageFor(flavor)} alt="" />
                <div>
                  <strong>{flavor.name}</strong>
                  <span>{flavor.description}</span>
                  <b>{brl(flavor.price)}</b>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <section className="publicSection observationBox">
        <h2>Observacoes</h2>
        <textarea
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Ex.: tirar cebola, ovo, etc."
        />
      </section>
      <div className="publicActionBar">
        <button
          type="button"
          disabled={!company.acceptOrders || selectedFlavors.length === 0}
          onClick={() =>
            onAdd({
              key: `${product.id}-${Date.now()}`,
              productId: product.id,
              productName: pizzaSizePublicName(product),
              quantity: 1,
              unitPrice,
              notes,
              addons: selectedFlavors.map(flavor => ({
                id: flavor.id,
                name: flavor.name,
                price: money(flavor.price)
              }))
            })
          }
        >
          {actionLabel} {brl(unitPrice)}
        </button>
      </div>
    </>
  );
}

function WaiterCheckoutView({
  cart,
  total,
  tableNumber,
  waiterName,
  customerName,
  notes,
  saving,
  error,
  onBack,
  onRemove,
  onTableNumberChange,
  onWaiterNameChange,
  onCustomerNameChange,
  onNotesChange,
  onSubmit,
  variant = "restaurant"
}: {
  cart: CartItem[];
  total: number;
  tableNumber: string;
  waiterName: string;
  customerName: string;
  notes: string;
  saving: boolean;
  error: string;
  onBack: () => void;
  onRemove: (key: string) => void;
  onTableNumberChange: (value: string) => void;
  onWaiterNameChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  variant?: "restaurant" | "barbershop";
}) {
  const isBarbershop = variant === "barbershop";
  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={onBack} className="plainIcon">
          <ArrowLeft />
        </button>
        <strong>{isBarbershop ? "Enviar atendimento" : "Enviar pedido da mesa"}</strong>
        <span />
      </header>
      <form className="checkoutForm waiterCheckout" onSubmit={onSubmit}>
        <section className="publicSection noTopGap">
          <h2>{isBarbershop ? "Dados da cadeira" : "Dados da mesa"}</h2>
          <div className="formGrid waiterFormGrid">
            <label>
              {isBarbershop ? "Cadeira" : "Mesa"}
              <input
                value={tableNumber}
                onChange={event => onTableNumberChange(event.target.value)}
                inputMode="numeric"
                required
              />
            </label>
            <label>
              {isBarbershop ? "Atendente" : "Garcom"}
              <input value={waiterName} onChange={event => onWaiterNameChange(event.target.value)} />
            </label>
          </div>
          <label>
            {isBarbershop ? "Cliente opcional" : "Cliente na mesa opcional"}
            <input value={customerName} onChange={event => onCustomerNameChange(event.target.value)} />
          </label>
        </section>
        <section className="publicSection">
          <h2>Itens</h2>
          {cart.length === 0 ? (
            <p className="muted">Nenhum item adicionado.</p>
          ) : (
            <div className="checkoutItems">
              {cart.map(item => (
                <article key={item.key}>
                  <div>
                    <strong>{item.productName}</strong>
                    {item.addons.length > 0 && <span>{item.addons.map(addon => addon.name).join(" + ")}</span>}
                    {item.notes && <small>Obs: {item.notes}</small>}
                  </div>
                  <div>
                    <b>{brl(item.unitPrice * item.quantity)}</b>
                    <button type="button" onClick={() => onRemove(item.key)}>
                      Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="publicSection">
          <h2>{isBarbershop ? "Observacao do atendimento" : "Observacao da mesa"}</h2>
          <textarea
            value={notes}
            onChange={event => onNotesChange(event.target.value)}
            placeholder={isBarbershop ? "Ex.: acabamento, preferencia do cliente, produto vendido..." : "Ex.: entregar primeiro as bebidas, sem talheres, etc."}
          />
          <div className="checkoutTotals">
            <strong>Total {brl(total)}</strong>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={saving || cart.length === 0}>
            {saving ? "Enviando..." : isBarbershop ? "Enviar atendimento" : "Enviar para a cozinha"}
          </button>
        </section>
      </form>
    </>
  );
}

function WaiterSuccessView({
  order,
  tableNumber,
  variant = "restaurant",
  onNewOrder
}: {
  order: PublicOrder | null;
  tableNumber: string;
  variant?: "restaurant" | "barbershop";
  onNewOrder: () => void;
}) {
  const isBarbershop = variant === "barbershop";
  return (
    <>
      <header className="publicSubHeader">
        <span />
        <strong>{isBarbershop ? "Atendimento enviado" : "Pedido enviado"}</strong>
        <span />
      </header>
      <section className="publicSection waiterSuccess">
        <strong>{isBarbershop ? "Cadeira" : "Mesa"} {tableNumber || "-"}</strong>
        <p>{isBarbershop ? "Atendimento" : "Pedido"} {publicOrderNumber(order)} entrou na fila aguardando aceite.</p>
        <b>{brl(order?.total || 0)}</b>
        <button type="button" onClick={onNewOrder}>
          {isBarbershop ? "Novo atendimento nesta cadeira" : "Novo pedido nesta mesa"}
        </button>
      </section>
    </>
  );
}

function CheckoutView({
  company,
  cart,
  total,
  slug,
  prefill,
  onBack,
  onRemove,
  onOrderCreated
}: {
  company: PublicCompany;
  cart: CartItem[];
  total: number;
  slug: string;
  prefill: PublicPrefill;
  onBack: () => void;
  onRemove: (key: string) => void;
  onOrderCreated: (order: PublicOrder) => void;
}) {
  const isBarbershop = isPublicBarbershop(company);
  const [customerName, setCustomerName] = useState(prefill.customerName);
  const [customerPhone, setCustomerPhone] = useState(prefill.customerPhone);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">(isBarbershop || !company.allowDelivery ? "pickup" : "delivery");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [pixPaymentStep, setPixPaymentStep] = useState(false);
  const [pixCopyStatus, setPixCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    neighborhood: "",
    reference: ""
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pixPaymentCardRef = useRef<HTMLDivElement>(null);
  const orderSubmissionRef = useRef(false);

  const deliveryFee = !isBarbershop && orderType === "delivery" ? money(company.deliveryFeeDefault) : 0;
  const orderTotal = total + deliveryFee;
  const pixMethod = company.paymentMethods?.find(method => textKey(method.type) === "pix" || textKey(method.name).includes("pix"));
  const pixKey = String(pixMethod?.instructions || "").trim();

  async function sendOrder() {
    if (orderSubmissionRef.current) return;

    setError("");

    if (cart.length === 0) {
      setError("Sua sacola esta vazia.");
      return;
    }

    orderSubmissionRef.current = true;
    setSaving(true);
    try {
      const result = await publicApi<{ order: PublicOrder }>(slug, "/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: {
            name: customerName,
            phone: cleanPhone(customerPhone)
          },
          orderType: isBarbershop || orderType === "pickup" ? "pickup" : "delivery",
          paymentMethod,
          deliveryFee,
          notes,
          address,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
            addonIds: item.addons.map(addon => addon.id)
          }))
        })
      });
      onOrderCreated(result.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      orderSubmissionRef.current = false;
      setSaving(false);
    }
  }

  async function copyPixKeyAndSendOrder() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard indisponivel");
      await navigator.clipboard.writeText(pixKey);
      setPixCopyStatus("copied");
    } catch {
      setPixCopyStatus("error");
    }

    window.setTimeout(() => setPixCopyStatus("idle"), 2500);
    await sendOrder();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (cart.length === 0) {
      setError("Sua sacola esta vazia.");
      return;
    }

    if (paymentMethod === "Pix" && !pixPaymentStep) {
      setPixPaymentStep(true);
      window.setTimeout(() => pixPaymentCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      return;
    }

    await sendOrder();
  }

  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={onBack} className="plainIcon">
          <ArrowLeft />
        </button>
        <strong>{isBarbershop ? "Finalizar solicitacao" : "Finalizar pedido"}</strong>
        <span />
      </header>
      <section className="publicSection noTopGap">
          <h2>{isBarbershop ? "Selecao" : "Sacola"}</h2>
        {cart.length === 0 ? (
          <p className="muted">Nenhum item adicionado.</p>
        ) : (
          <div className="checkoutItems">
            {cart.map(item => (
              <article key={item.key}>
                <div>
                  <strong>{item.productName}</strong>
                  {item.addons.length > 0 && <span>{item.addons.map(addon => addon.name).join(" + ")}</span>}
                  {item.notes && <small>Obs: {item.notes}</small>}
                </div>
                <div>
                  <b>{brl(item.unitPrice * item.quantity)}</b>
                  <button type="button" onClick={() => onRemove(item.key)}>
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <form className="checkoutForm" onSubmit={submit}>
        <section className="publicSection">
          <h2>Seus dados</h2>
          <label>
            Nome completo
            <input value={customerName} onChange={event => setCustomerName(event.target.value)} required />
          </label>
          <label>
            WhatsApp
            <input value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} inputMode="tel" required />
          </label>
          <div className="typeSwitch">
            {!isBarbershop && company.allowDelivery && (
              <button type="button" className={orderType === "delivery" ? "active" : ""} onClick={() => setOrderType("delivery")}>
                Delivery
              </button>
            )}
            <button type="button" className={orderType === "pickup" ? "active" : ""} onClick={() => setOrderType("pickup")}>
              {isBarbershop ? "Local/retirada" : "Retirada"}
            </button>
          </div>
        </section>
        {orderType === "delivery" && (
          <section className="publicSection">
            <h2>Endereco</h2>
            <label>
              Rua
              <input value={address.street} onChange={event => setAddress({ ...address, street: event.target.value })} required />
            </label>
            <div className="formGrid">
              <label>
                Numero
                <input value={address.number} onChange={event => setAddress({ ...address, number: event.target.value })} required />
              </label>
              <label>
                Bairro
                <input value={address.neighborhood} onChange={event => setAddress({ ...address, neighborhood: event.target.value })} required />
              </label>
            </div>
            <label>
              Referencia
              <input value={address.reference} onChange={event => setAddress({ ...address, reference: event.target.value })} />
            </label>
          </section>
        )}
        <section className="publicSection">
          <h2>{pixPaymentStep ? "Pagamento Pix" : "Pagamento e observacao"}</h2>
          {pixPaymentStep ? (
            <div className="pixPaymentCard" ref={pixPaymentCardRef}>
              <strong>Pague agora com Pix</strong>
              {pixKey ? (
                <>
                  <code>{pixKey}</code>
                  <button
                    type="button"
                    className={pixCopyStatus === "copied" ? "pixCopyButton copied" : "pixCopyButton"}
                    onClick={copyPixKeyAndSendOrder}
                    disabled={saving || !company.acceptOrders}
                  >
                    {saving ? "Enviando pedido..." : pixCopyStatus === "copied" ? "Chave copiada!" : pixCopyStatus === "error" ? "Nao foi possivel copiar" : "Copiar chave Pix e enviar pedido"}
                  </button>
                  <span className="pixCopyStatus" role="status" aria-live="polite">
                    {saving
                      ? pixCopyStatus === "error"
                        ? "Nao foi possivel copiar a chave. O pedido esta sendo enviado; copie a chave manualmente."
                        : "Chave Pix copiada. Seu pedido esta sendo enviado."
                      : pixCopyStatus === "copied"
                        ? "Chave Pix copiada para a area de transferencia."
                        : pixCopyStatus === "error"
                          ? "Copie a chave manualmente e toque novamente para tentar enviar o pedido."
                          : ""}
                  </span>
                  <p>Envie o comprovante do Pix no nosso WhatsApp para confirmar seu pedido.</p>
                </>
              ) : (
                <p>A chave Pix ainda nao foi cadastrada pela loja. Escolha outro metodo de pagamento ou fale pelo WhatsApp.</p>
              )}
              <button type="button" className="pixChangeMethodButton" onClick={() => setPixPaymentStep(false)}>Escolher outro metodo de pagamento</button>
            </div>
          ) : (
            <label>
              Forma de pagamento
              <select value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value); setPixPaymentStep(false); setPixCopyStatus("idle"); }}>
                <option>Pix</option>
                <option>Cartao na entrega</option>
                <option>Dinheiro na entrega</option>
                <option>Pix na maquina</option>
              </select>
            </label>
          )}
          <label>
            Observacao geral
            <textarea value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          <div className="checkoutTotals">
            <span>Itens {brl(total)}</span>
            {!isBarbershop && <span>Entrega {brl(deliveryFee)}</span>}
            <strong>Total {brl(orderTotal)}</strong>
          </div>
          {error && <div className="error">{error}</div>}
          {!pixPaymentStep && (
            <button type="submit" disabled={saving || !company.acceptOrders}>
              {saving ? "Enviando..." : isBarbershop ? "Enviar solicitacao" : "Avancar para finalizar"}
            </button>
          )}
        </section>
      </form>
    </>
  );
}

function OrdersView({
  company,
  slug,
  lastOrder,
  initialPhone,
  onBack,
  onRepeat
}: {
  company: PublicCompany;
  slug: string;
  lastOrder: PublicOrder | null;
  initialPhone: string;
  onBack: () => void;
  onRepeat: (order: PublicOrder) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [orders, setOrders] = useState<PublicOrder[]>(lastOrder ? [lastOrder] : []);
  const [error, setError] = useState("");

  async function loadOrders(phoneValue: string) {
    setError("");
    try {
      const result = await publicApi<PublicOrder[]>(slug, `/orders?phone=${encodeURIComponent(cleanPhone(phoneValue))}`);
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar pedidos");
    }
  }

  useEffect(() => {
    if (!lastOrder && initialPhone) {
      void loadOrders(initialPhone);
    }
  }, [initialPhone, lastOrder]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    await loadOrders(phone);
  }

  function canFollowOnWhatsapp(order: PublicOrder) {
    return !["completed", "canceled"].includes(String(order.status));
  }

  return (
    <>
      <header className="publicSubHeader">
        <button type="button" onClick={onBack} className="plainIcon">
          <ArrowLeft />
        </button>
        <strong>Meus pedidos</strong>
        <span />
      </header>
      <form className="ordersSearch" onSubmit={search}>
        <label>
          Informe seu WhatsApp
          <input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" />
        </label>
        <button type="submit">Buscar</button>
        {error && <div className="error">{error}</div>}
      </form>
      <section className="ordersList">
        {orders.length === 0 ? (
          <p className="muted">Nenhum pedido encontrado.</p>
        ) : (
          orders.map(order => (
            <article className="orderCard" key={order.id}>
              <div className="orderCardHead">
                <div>
                  <strong>Pedido {publicOrderNumber(order)}</strong>
                  <span>{publicDateTime(order.createdAt)}</span>
                </div>
                <b>{statusLabel(order.status)}</b>
              </div>
              {canFollowOnWhatsapp(order) && (
                <div className="orderWhatsappFollowup">
                  <span>Acompanhe seu pedido pelo WhatsApp.</span>
                  <a href={companyWhatsappUrl(company, order)} target="_blank" rel="noreferrer">
                    Acompanhar pelo WhatsApp
                  </a>
                </div>
              )}
              <div className="orderItemsBox">
                {order.items.map((item, index) => (
                  <span key={`${order.id}-${index}`}>
                    {item.quantity}x {item.productName}
                    {item.addons.length ? ` - ${item.addons.map(addon => addon.addonName).join(" + ")}` : ""}
                  </span>
                ))}
              </div>
              <strong>{brl(order.total)}</strong>
              <button type="button" onClick={() => onRepeat(order)}>
                Repetir pedido
              </button>
            </article>
          ))
        )}
      </section>
    </>
  );
}

function CartButton({ count, total, onClick }: { count: number; total: number; onClick: () => void }) {
  if (count === 0) return null;

  return (
    <button className="publicCartButton" type="button" onClick={onClick}>
      <ShoppingBag />
      <span>{count}</span>
      <strong>{brl(total)}</strong>
    </button>
  );
}

function BottomNav({
  current,
  cartCount,
  onHome,
  onCart,
  onOrders
}: {
  current: View;
  cartCount: number;
  onHome: () => void;
  onCart: () => void;
  onOrders: () => void;
}) {
  return (
    <nav className="publicBottomNav">
      <button type="button" className={current === "home" ? "active" : ""} onClick={onHome}>
        <Home />
        Início
      </button>
      <button type="button" className={current === "checkout" ? "active" : ""} onClick={onCart} disabled={cartCount === 0}>
        <span className="publicBottomNavIcon"><ShoppingBag />{cartCount > 0 && <b>{cartCount}</b>}</span>
        Pedido
      </button>
      <button type="button" className={current === "orders" ? "active" : ""} onClick={onOrders}>
        <ClipboardList />
        Histórico
      </button>
    </nav>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    waiting_confirmation: "Acompanhe pelo WhatsApp",
    confirmed: "Aceito",
    preparing: "Em preparo",
    ready: "Pronto",
    out_for_delivery: "Saiu para entrega",
    completed: "Finalizado",
    canceled: "Cancelado"
  };
  return labels[status] || status;
}

function orderToCart(order: PublicOrder): CartItem[] {
  return order.items
    .filter(item => item.productId)
    .map((item, index) => ({
      key: `${item.productId}-${Date.now()}-${index}`,
      productId: String(item.productId),
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      notes: item.notes || undefined,
      addons: item.addons
        .filter(addon => addon.addonId)
        .map(addon => ({
          id: String(addon.addonId),
          name: addon.addonName,
          price: money(addon.price)
        }))
    }));
}
