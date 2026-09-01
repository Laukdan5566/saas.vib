import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Banknote,
  Bike,
  Bot,
  Building2,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  HelpCircle,
  ImagePlus,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Mic,
  Package,
  Paperclip,
  Percent,
  Plus,
  Printer,
  Scissors,
  Search,
  Settings,
  ShoppingBag,
  Smile,
  Smartphone,
  Square,
  Store,
  Table2,
  Truck,
  Upload,
  Users
} from "lucide-react";
import { CustomerOAuthCallbackApp, CustomerPortalApp, PublicMenuApp, WaiterOrderApp } from "./public-menu";
import "./styles.css";
import "./whatsapp-stability.css";
import "./master-panel.css";
import "./billing-layout.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3101";
const TICKETZ_URL = import.meta.env.VITE_TICKETZ_URL || `${window.location.protocol}//${window.location.hostname}:8085`;

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
};

type Session = {
  token: string;
  user: User;
};

type ResourceConfig = {
  key: string;
  label: string;
  icon: React.ReactNode;
  fields: string[];
  scoped?: boolean;
};

type RestaurantViewKey =
  | "dashboard"
  | "whatsapp"
  | "orders"
  | "deliveries"
  | "tables"
  | "menu"
  | "appointments"
  | "financial"
  | "billing"
  | "payments"
  | "printers"
  | "users"
  | "customers"
  | "reports"
  | "settings";

const resources: ResourceConfig[] = [
  { key: "companies", label: "Empresas", icon: <Building2 />, fields: ["name", "slug", "logoUrl", "segment", "document", "phone", "whatsapp", "email", "city", "state", "billingDocument", "billingEmail"] },
  { key: "companyModules", label: "Modulos", icon: <Package />, scoped: true, fields: ["moduleKey", "name", "description", "active"] },
  { key: "users", label: "Usuarios", icon: <Users />, scoped: true, fields: ["name", "email", "password", "phone", "role", "active"] },
  { key: "whatsappConnections", label: "Conexoes WhatsApp", icon: <Smartphone />, scoped: true, fields: ["name", "channel", "provider", "status", "isDefault", "greetingMessage", "farewellMessage", "outOfHoursMessage", "transferMessage", "token"] },
  { key: "menuCategories", label: "Categorias", icon: <MenuIcon />, scoped: true, fields: ["name", "description", "sortOrder", "active"] },
  { key: "products", label: "Produtos", icon: <Package />, scoped: true, fields: ["categoryId", "name", "description", "price", "promotionalPrice", "imageUrl", "preparationTimeMinutes", "sortOrder", "active", "available"] },
  { key: "productAddonGroups", label: "Grupos de adicionais", icon: <Package />, scoped: true, fields: ["productId", "name", "required", "minChoices", "maxChoices", "sortOrder", "active"] },
  { key: "productAddons", label: "Adicionais e sabores", icon: <Package />, scoped: true, fields: ["addonGroupId", "name", "description", "price", "imageUrl", "sortOrder", "active"] },
  { key: "services", label: "Servicos", icon: <Scissors />, scoped: true, fields: ["name", "description", "price", "durationMinutes", "active"] },
  { key: "professionals", label: "Profissionais", icon: <Scissors />, scoped: true, fields: ["name", "phone", "whatsapp", "active"] },
  { key: "professionalServices", label: "Servicos do profissional", icon: <Scissors />, scoped: true, fields: ["professionalId", "serviceId"] },
  { key: "professionalAvailability", label: "Agenda do profissional", icon: <CalendarDays />, scoped: true, fields: ["professionalId", "dayOfWeek", "startTime", "endTime", "isAvailable"] },
  { key: "customers", label: "Clientes", icon: <Users />, scoped: true, fields: ["name", "phone", "whatsapp", "email", "notes"] },
  { key: "deliveryPersons", label: "Motoboys", icon: <Truck />, scoped: true, fields: ["name", "phone", "whatsapp", "vehicleType", "plate", "active", "available"] },
  { key: "restaurantTables", label: "Mesas", icon: <Table2 />, scoped: true, fields: ["number", "name", "capacity", "location", "status", "active", "notes"] },
  { key: "orders", label: "Pedidos", icon: <ClipboardList />, scoped: true, fields: ["customerName", "customerPhone", "orderType", "status", "subtotal", "deliveryFee", "discount", "total", "paymentMethod", "notes"] },
  { key: "deliveries", label: "Entregas", icon: <Truck />, scoped: true, fields: ["orderId", "deliveryPersonId", "status", "deliveryAddress", "deliveryFee", "estimatedTimeMinutes", "notes"] },
  { key: "appointments", label: "Agendamentos", icon: <CalendarDays />, scoped: true, fields: ["customerId", "serviceId", "professionalId", "date", "time", "status", "price", "notes"] },
  { key: "paymentMethods", label: "Pagamentos", icon: <CreditCard />, scoped: true, fields: ["name", "type", "active", "instructions"] },
  { key: "faqs", label: "FAQ", icon: <HelpCircle />, scoped: true, fields: ["question", "answer", "category", "active"] },
  { key: "botSettings", label: "Bot", icon: <Bot />, scoped: true, fields: ["tone", "useEmojis", "greetingMessage", "outOfHoursMessage", "humanHandoffMessage"] },
  { key: "tickets", label: "Chat/Tickets", icon: <MessageSquare />, scoped: true, fields: ["ticketzTicketId", "ticketzContactId", "status", "channel", "queueId", "botEnabled", "humanTakeover", "lastMessage"] },
  { key: "messageLogs", label: "Mensagens", icon: <MessageSquare />, scoped: true, fields: ["ticketId", "ticketzMessageId", "direction", "senderType", "messageType", "content"] },
  { key: "printers", label: "Impressoras", icon: <Printer />, scoped: true, fields: ["name", "description", "printerType", "connectionType", "ipAddress", "port", "paperWidth", "active", "defaultForOrders", "defaultForKitchen", "defaultForDelivery"] },
  { key: "printJobs", label: "Fila impressao", icon: <ChefHat />, scoped: true, fields: ["orderId", "printerId", "type", "status", "content"] }
];

const booleanFields = new Set(["active", "available", "required", "useEmojis", "botEnabled", "humanTakeover", "defaultForOrders", "defaultForKitchen", "defaultForDelivery", "isDefault", "plugged", "isAvailable"]);
const numberFields = new Set(["sortOrder", "price", "promotionalPrice", "durationMinutes", "subtotal", "deliveryFee", "discount", "total", "estimatedTimeMinutes", "preparationTimeMinutes", "minChoices", "maxChoices", "port", "retries", "capacity", "dayOfWeek"]);
const jsonFields = new Set(["permissions", "config"]);
const fieldLabels: Record<string, string> = {
  name: "Nome",
  description: "Descricao",
  categoryId: "Categoria",
  productId: "Produto",
  addonGroupId: "Grupo",
  price: "Preco",
  promotionalPrice: "Preco promocional",
  imageUrl: "Imagem",
  sortOrder: "Ordem",
  available: "Disponivel",
  email: "Email",
  password: "Senha",
  phone: "Telefone",
  role: "Perfil",
  active: "Ativo",
  durationMinutes: "Duracao em minutos",
  professionalId: "Profissional",
  serviceId: "Servico",
  dayOfWeek: "Dia da semana",
  startTime: "Inicio",
  endTime: "Fim",
  isAvailable: "Disponivel",
  customerName: "Cliente",
  customerPhone: "Telefone",
  orderType: "Tipo",
  status: "Status",
  paymentMethod: "Pagamento",
  notes: "Observacao"
};
const relationFields: Record<string, { resource: string; label: string }> = {
  categoryId: { resource: "menuCategories", label: "Categoria" },
  productId: { resource: "products", label: "Produto" },
  addonGroupId: { resource: "productAddonGroups", label: "Grupo" },
  customerId: { resource: "customers", label: "Cliente" },
  deliveryPersonId: { resource: "deliveryPersons", label: "Motoboy" },
  professionalId: { resource: "professionals", label: "Profissional" },
  serviceId: { resource: "services", label: "Servico" }
};
const selectOptions: Record<string, Array<{ value: string; label: string }>> = {
  "users.role": [
    { value: "company_admin", label: "Administrador da empresa" },
    { value: "manager", label: "Gerente" },
    { value: "attendant", label: "Atendente" },
    { value: "delivery_user", label: "Entregador" }
  ],
  "professionalAvailability.dayOfWeek": [
    { value: "0", label: "Domingo" },
    { value: "1", label: "Segunda-feira" },
    { value: "2", label: "Terca-feira" },
    { value: "3", label: "Quarta-feira" },
    { value: "4", label: "Quinta-feira" },
    { value: "5", label: "Sexta-feira" },
    { value: "6", label: "Sabado" }
  ]
};
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
  printJobs: "printing"
};

type RestaurantNavItem = { key: RestaurantViewKey; label: string; group: string; icon: React.ReactNode };

const restaurantNav: RestaurantNavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Visao geral", icon: <Building2 /> },
  { key: "whatsapp", label: "WhatsApp", group: "Atendimento", icon: <Smartphone /> },
  { key: "orders", label: "Pedidos", group: "Operacao", icon: <ShoppingBag /> },
  { key: "deliveries", label: "Entregadores", group: "Operacao", icon: <Bike /> },
  { key: "tables", label: "Mesas", group: "Operacao", icon: <Table2 /> },
  { key: "menu", label: "Cardapio", group: "Gerenciamento", icon: <MenuIcon /> },
  { key: "financial", label: "Financeiro", group: "Gerenciamento", icon: <Banknote /> },
  { key: "billing", label: "Cobrancas", group: "Gerenciamento", icon: <FileText /> },
  { key: "payments", label: "Formas de pagamento", group: "Gerenciamento", icon: <CreditCard /> },
  { key: "printers", label: "Impressoras", group: "Configuracoes", icon: <Printer /> },
  { key: "users", label: "Usuarios", group: "Configuracoes", icon: <Users /> },
  { key: "customers", label: "Clientes", group: "Configuracoes", icon: <Users /> },
  { key: "reports", label: "Relatorios", group: "Analises", icon: <FileText /> },
  { key: "settings", label: "Configuracoes", group: "Configuracoes", icon: <Settings /> }
];

const barbershopNav: RestaurantNavItem[] = [
  { key: "dashboard", label: "Visao geral", group: "Barbearia", icon: <Building2 /> },
  { key: "whatsapp", label: "WhatsApp", group: "Atendimento", icon: <Smartphone /> },
  { key: "orders", label: "Atendimentos", group: "Operacao", icon: <ClipboardList /> },
  { key: "appointments", label: "Agendamentos", group: "Operacao", icon: <CalendarDays /> },
  { key: "tables", label: "Cadeiras", group: "Operacao", icon: <Table2 /> },
  { key: "menu", label: "Servicos e produtos", group: "Gerenciamento", icon: <Scissors /> },
  { key: "financial", label: "Financeiro", group: "Gerenciamento", icon: <Banknote /> },
  { key: "billing", label: "Cobrancas", group: "Gerenciamento", icon: <FileText /> },
  { key: "payments", label: "Formas de pagamento", group: "Gerenciamento", icon: <CreditCard /> },
  { key: "users", label: "Usuarios", group: "Configuracoes", icon: <Users /> },
  { key: "customers", label: "Clientes", group: "Configuracoes", icon: <Users /> },
  { key: "reports", label: "Relatorios", group: "Analises", icon: <FileText /> },
  { key: "settings", label: "Configuracoes", group: "Configuracoes", icon: <Settings /> }
];

type MasterTab = "companies" | "billing" | "config";

function adminLocation() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const masterTab = params.get("masterTab");
  return {
    mode: params.get("adminMode"),
    companyId: params.get("company"),
    view: [...restaurantNav, ...barbershopNav].some(item => item.key === view) ? view as RestaurantViewKey : null,
    masterTab: ["companies", "billing", "config"].includes(String(masterTab)) ? masterTab as MasterTab : null
  };
}

function updateAdminLocation(values: Record<string, string | null | undefined>) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

const restaurantModules: Partial<Record<RestaurantViewKey, string>> = {
  whatsapp: "connections",
  orders: "orders",
  deliveries: "deliveries",
  tables: "orders",
  menu: "menu",
  appointments: "appointments",
  financial: "payments",
  payments: "payments",
  printers: "printing",
  users: "users",
  customers: "customers"
};

function companySegment(company: Record<string, unknown> | null | undefined) {
  return String(company?.segment || "generic");
}

function isBarbershopCompany(company: Record<string, unknown> | null | undefined) {
  return companySegment(company) === "barbershop";
}

function api(session: Session | null, path: string, init: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init.headers || {})
    }
  }).then(async response => {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Erro na API");
    }
    return data;
  });
}

function normalizePayload(raw: Record<string, string>, config: ResourceConfig, companyId: string | null) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === "") continue;
    if (jsonFields.has(key)) {
      payload[key] = JSON.parse(value);
    } else if (booleanFields.has(key)) payload[key] = value === "true";
    else if (numberFields.has(key)) payload[key] = Number(value);
    else if (key === "date") payload[key] = new Date(value).toISOString();
    else payload[key] = value;
  }
  if (config.key === "users") {
    payload.role = payload.role || "attendant";
    payload.active = payload.active ?? true;
    if (payload.role === "super_admin") {
      payload.companyId = null;
    }
  }
  if (config.scoped && companyId) payload.companyId = companyId;
  if (config.key === "users" && payload.role === "super_admin") payload.companyId = null;
  return payload;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = await api(null, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem("vib-session", JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    }
  }

  return (
    <main className="login">
      <section className="loginPanel">
        <div>
          <span className="mark">Vib</span>
          <h1>Plataforma SaaS</h1>
          <p>Atendimento, pedidos, entregas, agenda, IA e integracoes em um painel multitenant.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ session, companyId }: { session: Session; companyId: string | null }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const keys = ["orders", "deliveries", "deliveryPersons", "appointments", "tickets", "products", "services"];
    Promise.all(keys.map(key => api(session, `/api/resources/${key}`).then(items => [key, items.length])))
      .then(entries => setCounts(Object.fromEntries(entries)))
      .catch(() => setCounts({}));

    if (companyId) {
      api(session, `/api/companies/${companyId}/ai-prompt`)
        .then(data => setPrompt(data.prompt))
        .catch(() => setPrompt(""));
    }
  }, [session, companyId]);

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h2>Dashboard</h2>
          <p>Visao operacional do MVP.</p>
        </div>
      </header>
      <div className="metricGrid">
        {[
          ["Pedidos", counts.orders || 0],
          ["Entregas", counts.deliveries || 0],
          ["Motoboys", counts.deliveryPersons || 0],
          ["Agendamentos", counts.appointments || 0],
          ["Tickets", counts.tickets || 0],
          ["Produtos", counts.products || 0],
          ["Servicos", counts.services || 0]
        ].map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="promptBox">
        <h3>Prompt IA da empresa</h3>
        <pre>{prompt || "Selecione uma empresa para visualizar o prompt."}</pre>
      </section>
    </section>
  );
}

function ResourceView({ config, session, companyId }: { config: ResourceConfig; session: Session; companyId: string | null }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [lookups, setLookups] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [error, setError] = useState("");
  const [uploadingField, setUploadingField] = useState("");

  async function load() {
    setError("");
    try {
      const suffix = config.scoped && companyId ? `?companyId=${companyId}` : "";
      setItems(await api(session, `/api/resources/${config.key}${suffix}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    void load();
  }, [config.key, companyId]);

  useEffect(() => {
    const fields = config.fields.filter(field => relationFields[field]);
    if (!fields.length || !companyId) {
      setLookups({});
      return;
    }

    let cancelled = false;
    Promise.all(
      fields.map(async field => {
        const relation = relationFields[field];
        const data = await api(session, `/api/resources/${relation.resource}?companyId=${companyId}`);
        const options = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
          value: String(item.id),
          label: String(item.name || item.customerName || item.email || item.id)
        }));
        return [field, options] as const;
      })
    )
      .then(entries => {
        if (!cancelled) setLookups(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setLookups({});
      });

    return () => {
      cancelled = true;
    };
  }, [config.fields.join(","), companyId, session.token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(session, editingItem ? `/api/resources/${config.key}/${editingItem.id}` : `/api/resources/${config.key}`, {
        method: editingItem ? "PUT" : "POST",
        body: JSON.stringify(normalizePayload(form, config, companyId))
      });
      setForm({});
      setEditingItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  function editItem(item: Record<string, unknown>) {
    setError("");
    setEditingItem(item);
    setForm(
      Object.fromEntries(
        config.fields.map(field => [
          field,
          field === "password" ? "" : item[field] == null ? "" : String(item[field])
        ])
      )
    );
  }

  function cancelEdit() {
    setEditingItem(null);
    setForm({});
    setError("");
  }

  async function toggleModule(item: Record<string, unknown>) {
    setError("");
    try {
      await api(session, `/api/resources/companyModules/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !Boolean(item.active) })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar modulo");
    }
  }

  async function updateItem(item: Record<string, unknown>, data: Record<string, unknown>) {
    setError("");
    try {
      await api(session, `/api/resources/${config.key}/${item.id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function removeItem(item: Record<string, unknown>) {
    const name = String(item.name || item.question || item.customerName || item.id);
    if (!window.confirm(`Remover ${name}?`)) return;

    setError("");
    try {
      await api(session, `/api/resources/${config.key}/${item.id}`, { method: "DELETE" });
      if (editingItem?.id === item.id) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function uploadImage(field: string, file: File | undefined) {
    if (!file) return;
    if (!companyId) {
      setError("Selecione uma empresa para enviar imagem.");
      return;
    }

    setError("");
    setUploadingField(field);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api(session, "/api/uploads/images", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          fileName: file.name,
          contentType: file.type,
          dataUrl
        })
      });
      setForm(current => ({ ...current, [field]: String(result.url || "") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem");
    } finally {
      setUploadingField("");
    }
  }

  async function whatsappAction(item: Record<string, unknown>, action: string) {
    setError("");
    try {
      await api(session, `/api/whatsapp-connections/${item.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conexao WhatsApp");
    }
  }

  async function confirmOrder(item: Record<string, unknown>) {
    setError("");
    try {
      await api(session, `/api/orders/${item.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ companyId: String(item.companyId || companyId || "") })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar pedido");
    }
  }

  async function reprintOrder(item: Record<string, unknown>) {
    setError("");
    try {
      await api(session, `/api/orders/${item.id}/reprint`, {
        method: "POST",
        body: JSON.stringify({ companyId: String(item.companyId || companyId || "") })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reimprimir pedido");
    }
  }

  function renderField(field: string) {
    const selectKey = `${config.key}.${field}`;
    const options =
      config.key === "users" && field === "role" && session.user.role === "super_admin"
        ? [{ value: "super_admin", label: "Super admin" }, ...selectOptions["users.role"]]
        : selectOptions[selectKey] || lookups[field];
    if (field === "imageUrl") {
      return (
        <label key={field} className="imageUploadField">
          {fieldLabels[field] || field}
          {form[field] && <img className="imageUploadPreview" src={form[field]} alt="Previa da imagem" />}
          <input
            type="text"
            placeholder="URL da imagem ou envie um arquivo abaixo"
            value={form[field] || ""}
            onChange={event => setForm({ ...form, [field]: event.target.value })}
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={event => void uploadImage(field, event.target.files?.[0])}
          />
          <small>{uploadingField === field ? "Enviando imagem..." : "Use JPG, PNG, WEBP ou GIF ate 6MB."}</small>
        </label>
      );
    }
    return (
      <label key={field}>
        {fieldLabels[field] || field}
        {options ? (
          <select value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })}>
            <option value="">Selecione</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : booleanFields.has(field) ? (
          <select value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })}>
            <option value="">Auto</option>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        ) : (
          <input
            type={field === "date" ? "date" : field === "password" ? "password" : numberFields.has(field) ? "number" : "text"}
            step={["price", "promotionalPrice", "subtotal", "deliveryFee", "discount", "total"].includes(field) ? "0.01" : undefined}
            placeholder={field === "password" && config.key === "users" ? "Opcional ao editar" : undefined}
            value={form[field] || ""}
            onChange={event => setForm({ ...form, [field]: event.target.value })}
          />
        )}
      </label>
    );
  }

  function renderItemDetails(item: Record<string, unknown>) {
    const relationLabel = (field: string, value: unknown) =>
      lookups[field]?.find(option => option.value === String(value))?.label || String(value || "-");

    if (["menuCategories", "products", "productAddonGroups", "productAddons"].includes(config.key)) {
      return (
        <div className="simpleDetails menuItemDetails">
          {"imageUrl" in item && item.imageUrl ? (
            <img className="menuItemThumb" src={String(item.imageUrl)} alt="" />
          ) : null}
          {config.key === "products" && <span>Categoria: {relationLabel("categoryId", item.categoryId)}</span>}
          {config.key === "productAddonGroups" && <span>Produto: {relationLabel("productId", item.productId)}</span>}
          {config.key === "productAddons" && <span>Grupo: {relationLabel("addonGroupId", item.addonGroupId)}</span>}
          {"price" in item && <span>Preco: R$ {Number(item.price || 0).toFixed(2).replace(".", ",")}</span>}
          {"sortOrder" in item && <span>Ordem: {String(item.sortOrder ?? "0")}</span>}
          <span>{item.active === false ? "Inativo" : "Ativo"}</span>
          {"available" in item && <span>{item.available === false ? "Indisponivel para venda" : "Disponivel para venda"}</span>}
        </div>
      );
    }

    if (config.key === "services") {
      return (
        <div className="simpleDetails">
          <span>{money(item.price)}</span>
          <span>{String(item.durationMinutes || 0)} min</span>
          <span>{item.active === false ? "Inativo" : "Ativo"}</span>
          {Boolean(item.description) && <span>{String(item.description)}</span>}
        </div>
      );
    }

    if (config.key === "professionals") {
      return (
        <div className="simpleDetails">
          <span>{String(item.phone || item.whatsapp || "sem telefone")}</span>
          <span>{item.active === false ? "Inativo" : "Ativo"}</span>
        </div>
      );
    }

    if (config.key === "professionalServices") {
      return (
        <div className="simpleDetails">
          <span>Profissional: {relationLabel("professionalId", item.professionalId)}</span>
          <span>Servico: {relationLabel("serviceId", item.serviceId)}</span>
        </div>
      );
    }

    if (config.key === "users") {
      const roleLabels = Object.fromEntries(selectOptions["users.role"].map(option => [option.value, option.label]));
      return (
        <div className="simpleDetails">
          <span>{String(item.email || "-")}</span>
          <span>{String(item.phone || "sem telefone")}</span>
          <span>{roleLabels[String(item.role)] || String(item.role || "-")}</span>
          <span>{item.active === false ? "Inativo" : "Ativo"}</span>
        </div>
      );
    }

    return <code>{JSON.stringify(item).slice(0, 220)}</code>;
  }

  return (
    <section className="workspace">
      <header className="pageHeader">
        <div>
          <h2>{config.label}</h2>
          <p>{editingItem ? `Editando ${String(editingItem.name || editingItem.email || editingItem.id)}` : `${items.length} registros`}</p>
        </div>
      </header>
      {config.key === "printers" && (
        <section className="downloadPanel">
          <div>
            <strong>Agente local de impressao</strong>
            <span>Instale no computador Windows que fica conectado a impressora. Ele busca a fila do SaaS e imprime automaticamente.</span>
          </div>
          <a href="/print-agent.zip" download>Baixar agente</a>
        </section>
      )}
      <form className="editor" onSubmit={submit}>
        {config.fields.map(field => renderField(field))}
        {error && <div className="error">{error}</div>}
        <button type="submit">{editingItem ? "Salvar alteracoes" : "Salvar"}</button>
        {editingItem && <button type="button" className="secondaryAction" onClick={cancelEdit}>Cancelar edicao</button>}
      </form>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nome/ID</th>
              <th>Status</th>
              <th>Dados</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={String(item.id)}>
                <td>{String(item.name || item.question || item.customerName || item.id)}</td>
                <td>{String(item.status ?? item.active ?? "-")}</td>
                <td>
                  {renderItemDetails(item)}
                </td>
                {config.key === "companyModules" && (
                  <td>
                    <button type="button" onClick={() => toggleModule(item)}>
                      {item.active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                )}
                {config.key !== "companyModules" && (
                  <td className="actions">
                    <button type="button" onClick={() => editItem(item)}>Editar</button>
                    {"active" in item && (
                      <button type="button" onClick={() => updateItem(item, { active: item.active === false })}>
                        {item.active === false ? "Ativar" : "Desativar"}
                      </button>
                    )}
                    {"available" in item && (
                      <button type="button" onClick={() => updateItem(item, { available: item.available === false })}>
                        {item.available === false ? "Disponibilizar" : "Indisponibilizar"}
                      </button>
                    )}
                    {config.key === "whatsappConnections" && (
                      <>
                        <button type="button" onClick={() => whatsappAction(item, "start")}>QR</button>
                        <button type="button" onClick={() => whatsappAction(item, "connected")}>Conectar</button>
                        <button type="button" onClick={() => whatsappAction(item, "refresh")}>Atualizar</button>
                        <button type="button" onClick={() => whatsappAction(item, "disconnect")}>Desconectar</button>
                      </>
                    )}
                    {config.key === "orders" && (
                      ["draft", "waiting_confirmation"].includes(String(item.status)) ? (
                        <button type="button" onClick={() => confirmOrder(item)}>Aceitar pedido</button>
                      ) : (
                        <button type="button" onClick={() => reprintOrder(item)}>Reimprimir</button>
                      )
                    )}
                    {!["orders", "printJobs", "messageLogs"].includes(config.key) && (
                      <button type="button" className="dangerAction" onClick={() => removeItem(item)}>Remover</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MenuManagementPage({
  session,
  companyId,
  companySlug,
  variant = "restaurant"
}: {
  session: Session;
  companyId: string;
  companySlug: string;
  variant?: "restaurant" | "barbershop";
}) {
  const isBarbershop = variant === "barbershop";
  const sections = isBarbershop
    ? [
        { key: "services", label: "Cortes e servicos" },
        { key: "products", label: "Produtos vendidos" },
        { key: "menuCategories", label: "Categorias de produtos" },
        { key: "professionals", label: "Barbeiros" },
        { key: "professionalServices", label: "Servicos por barbeiro" }
      ]
    : [
        { key: "menuCategories", label: "Categorias" },
        { key: "products", label: "Itens" },
        { key: "productAddonGroups", label: "Grupos de sabores" },
        { key: "productAddons", label: "Sabores e adicionais" }
      ];
  const [activeSection, setActiveSection] = useState(sections[0].key);
  const config = getResourceConfig(activeSection);

  useEffect(() => {
    if (!sections.some(section => section.key === activeSection)) {
      setActiveSection(sections[0].key);
    }
  }, [activeSection, sections]);

  return (
    <section className="workspace menuManager">
      <header className="pageHeader">
        <div>
          <span>{isBarbershop ? "Catalogo da barbearia" : "Cardapio online"}</span>
          <h2>{isBarbershop ? "Servicos e produtos" : "Editar cardapio"}</h2>
          <p>
            {isBarbershop
              ? "Cadastre valores dos cortes, barbeiros, servicos e produtos vendidos no balcao."
              : "Alteracoes salvas aqui aparecem no cardapio publico e no fluxo de pedidos."}
          </p>
        </div>
        <a href={`/cardapio/${companySlug}`} target="_blank">{isBarbershop ? "Ver servicos" : "Ver cardapio"}</a>
      </header>
      <div className="menuManagerTabs" role="tablist" aria-label={isBarbershop ? "Setores da barbearia" : "Setores do cardapio"}>
        {sections.map(section => (
          <button
            type="button"
            key={section.key}
            className={activeSection === section.key ? "active" : ""}
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </button>
        ))}
      </div>
      <ResourceView config={config} session={session} companyId={companyId} />
    </section>
  );
}

type DeliveryPersonForm = {
  name: string;
  phone: string;
  whatsapp: string;
  vehicleType: string;
  plate: string;
  active: string;
  available: string;
};

const vehicleTypeLabels: Record<string, string> = {
  motorcycle: "Moto",
  bicycle: "Bicicleta",
  car: "Carro",
  walking: "A pe"
};

function normalizeVehicleType(value: unknown) {
  const clean = String(value || "motorcycle")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
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
  return map[clean] || "motorcycle";
}

const emptyDeliveryPersonForm: DeliveryPersonForm = {
  name: "",
  phone: "",
  whatsapp: "",
  vehicleType: "motorcycle",
  plate: "",
  active: "true",
  available: "true"
};

function DeliveryPersonsPage({ session, companyId }: { session: Session; companyId: string }) {
  const config = getResourceConfig("deliveryPersons");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<DeliveryPersonForm>(emptyDeliveryPersonForm);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      setItems(await api(session, `/api/resources/deliveryPersons?companyId=${companyId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar motoboys");
    }
  }

  useEffect(() => {
    void load();
  }, [session, companyId]);

  function updateForm(field: keyof DeliveryPersonForm, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function editItem(item: Record<string, unknown>) {
    setError("");
    setEditingItem(item);
    setForm({
      name: String(item.name || ""),
      phone: String(item.phone || ""),
      whatsapp: String(item.whatsapp || item.phone || ""),
      vehicleType: normalizeVehicleType(item.vehicleType),
      plate: String(item.plate || ""),
      active: item.active === false ? "false" : "true",
      available: item.available === false ? "false" : "true"
    });
  }

  function resetForm() {
    setEditingItem(null);
    setForm(emptyDeliveryPersonForm);
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = normalizePayload(form, config, companyId);
      await api(session, editingItem ? `/api/resources/deliveryPersons/${editingItem.id}` : "/api/resources/deliveryPersons", {
        method: editingItem ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar motoboy");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: Record<string, unknown>) {
    const name = String(item.name || "este motoboy");
    if (!window.confirm(`Remover ${name}?`)) return;
    setError("");
    try {
      await api(session, `/api/resources/deliveryPersons/${item.id}`, { method: "DELETE" });
      if (editingItem?.id === item.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover motoboy");
    }
  }

  return (
    <section className="workspace deliveryPeoplePage">
      <header className="pageHeader">
        <div>
          <h2>Motoboys</h2>
          <p>{editingItem ? `Editando ${String(editingItem.name || editingItem.id)}` : `${items.length} entregadores cadastrados`}</p>
        </div>
      </header>

      <form className="deliveryPersonEditor" onSubmit={submit}>
        <div className="deliveryPersonEditorHeader">
          <div>
            <strong>{editingItem ? "Editar motoboy" : "Adicionar motoboy"}</strong>
            <span>Cadastre quem pode receber pedidos de entrega.</span>
          </div>
          {editingItem && <button type="button" className="secondaryAction" onClick={resetForm}>Cancelar edicao</button>}
        </div>

        <label>
          Nome
          <input value={form.name} onChange={event => updateForm("name", event.target.value)} required placeholder="Ex.: Daniel" />
        </label>
        <label>
          Telefone
          <input value={form.phone} onChange={event => updateForm("phone", event.target.value)} placeholder="DDD + numero" />
        </label>
        <label>
          WhatsApp
          <input value={form.whatsapp} onChange={event => updateForm("whatsapp", event.target.value)} placeholder="Numero para avisos" />
        </label>
        <label>
          Veiculo
          <select value={form.vehicleType} onChange={event => updateForm("vehicleType", event.target.value)}>
            <option value="motorcycle">Moto</option>
            <option value="bicycle">Bicicleta</option>
            <option value="car">Carro</option>
            <option value="walking">A pe/outro</option>
          </select>
        </label>
        <label>
          Placa
          <input value={form.plate} onChange={event => updateForm("plate", event.target.value)} placeholder="Opcional" />
        </label>
        <label>
          Status
          <select value={form.active} onChange={event => updateForm("active", event.target.value)}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </label>
        <label>
          Disponibilidade
          <select value={form.available} onChange={event => updateForm("available", event.target.value)}>
            <option value="true">Disponivel</option>
            <option value="false">Indisponivel</option>
          </select>
        </label>

        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={saving}>{saving ? "Salvando..." : editingItem ? "Salvar alteracoes" : "Adicionar motoboy"}</button>
      </form>

      <div className="deliveryPersonList">
        {items.length === 0 ? (
          <div className="emptyState">
            <strong>Nenhum motoboy cadastrado.</strong>
            <span>Adicione o primeiro entregador para enviar pedidos em rota.</span>
          </div>
        ) : (
          items.map(item => (
            <article className={`deliveryPersonCard ${item.active === false ? "inactive" : ""}`} key={String(item.id)}>
              <div>
                <strong>{String(item.name || "Sem nome")}</strong>
                <span>{String(item.phone || item.whatsapp || "Sem telefone")}</span>
              </div>
              <div className="deliveryPersonMeta">
                <span>{vehicleTypeLabels[normalizeVehicleType(item.vehicleType)] || "Veiculo nao informado"}</span>
                <span>{item.plate ? `Placa ${String(item.plate)}` : "Sem placa"}</span>
              </div>
              <div className="deliveryPersonBadges">
                <span className={item.active === false ? "closed" : "open"}>{item.active === false ? "Inativo" : "Ativo"}</span>
                <span className={item.available === false ? "closed" : "open"}>{item.available === false ? "Indisponivel" : "Disponivel"}</span>
              </div>
              <div className="deliveryPersonActions">
                <button type="button" onClick={() => editItem(item)}>Editar</button>
                <button type="button" className="dangerAction" onClick={() => removeItem(item)}>Remover</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function orderDisplayNumber(order: Record<string, unknown>) {
  return String(order.displayNumber || `#${String(order.id || "").slice(0, 8)}`);
}

function orderTypeLabel(value: unknown) {
  const type = String(value || "");
  if (type === "delivery") return "Entrega";
  if (type === "pickup") return "Retirada";
  if (type === "table") return "Mesa";
  return type || "-";
}

function orderStatusLabel(value: unknown) {
  const status = String(value || "");
  if (status === "draft") return "Rascunho";
  if (status === "waiting_confirmation") return "Aguardando confirmacao";
  if (status === "confirmed") return "Confirmado";
  if (status === "preparing") return "Em preparo";
  if (status === "ready") return "Pronto";
  if (status === "out_for_delivery") return "Em rota";
  if (status === "completed") return "Finalizado";
  if (status === "delivered") return "Entregue";
  if (status === "canceled") return "Cancelado";
  return status || "-";
}

function getResourceConfig(key: string) {
  return resources.find(resource => resource.key === key)!;
}

function companyInitials(company: Record<string, unknown>) {
  return String(company.name || "Empresa")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "EM";
}

function companyLogo(company: Record<string, unknown>) {
  return String(company.logoUrl || "").trim();
}

function companySlug(company: Record<string, unknown>) {
  // Public menu and booking routes resolve companies by their human-readable slug.
  return String(company.slug || company.publicId || "pizzaria-big-burguer");
}

function CompanyMark({ company }: { company: Record<string, unknown> }) {
  const logo = companyLogo(company);
  if (logo) return <img src={logo} alt={String(company.name || "Empresa")} />;
  return <span className="companyAvatar">{companyInitials(company)}</span>;
}

function RestaurantOrdersBoard({
  session,
  companyId,
  companySlug,
  variant = "restaurant",
  onOrdersChanged
}: {
  session: Session;
  companyId: string;
  companySlug: string;
  variant?: "restaurant" | "barbershop";
  onOrdersChanged?: (orders: Record<string, unknown>[]) => void;
}) {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<Record<string, unknown>[]>([]);
  const [selectedDeliveryPersons, setSelectedDeliveryPersons] = useState<Record<string, string>>({});
  const [assigningDeliveryId, setAssigningDeliveryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [editingOrder, setEditingOrder] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const isBarbershop = variant === "barbershop";

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setError("");
    try {
      const [loadedOrders, loadedDeliveries, loadedDeliveryPersons] = await Promise.all([
        api(session, `/api/resources/orders?companyId=${companyId}`),
        api(session, `/api/resources/deliveries?companyId=${companyId}`),
        api(session, `/api/resources/deliveryPersons?companyId=${companyId}`)
      ]);
      setOrders(loadedOrders);
      setDeliveries(loadedDeliveries);
      setDeliveryPersons(loadedDeliveryPersons);
      onOrdersChanged?.(loadedOrders);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (!options.silent) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pedidos");
      }
    }
  }

  useEffect(() => {
    void load();
  }, [session, companyId]);

  useEffect(() => {
    if (editingOrder) return;

    const refresh = () => {
      if (document.hidden) return;
      void load({ silent: true });
    };

    const interval = window.setInterval(refresh, 3500);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session, companyId, editingOrder]);

  async function orderAction(order: Record<string, unknown>, action: "confirm" | "reprint") {
    setError("");
    try {
      await api(session, `/api/orders/${order.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ companyId })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar pedido");
    }
  }

  async function orderStatusAction(order: Record<string, unknown>, status: string) {
    setError("");
    try {
      await api(session, `/api/orders/${order.id}/status`, {
        method: "POST",
        body: JSON.stringify({ companyId, status })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status do pedido");
    }
  }

  function renderStatusActions(order: Record<string, unknown>) {
    const status = String(order.status || "");
    const orderType = String(order.orderType || "");

    if (["confirmed", "preparing"].includes(status)) {
      if (isBarbershop) {
        return (
          <button type="button" onClick={() => orderStatusAction(order, "completed")}>
            Finalizar atendimento
          </button>
        );
      }
      if (orderType === "delivery") {
        return (
          <button type="button" onClick={() => orderStatusAction(order, "out_for_delivery")}>
            Liberar entrega
          </button>
        );
      }
      if (orderType === "pickup") {
        return (
          <button type="button" onClick={() => orderStatusAction(order, "ready")}>
            Pronto retirada
          </button>
        );
      }
      if (orderType === "table") {
        return (
          <button type="button" onClick={() => orderStatusAction(order, "ready")}>
            Mesa servida
          </button>
        );
      }
    }

    if (["ready", "out_for_delivery"].includes(status)) {
      return (
        <button type="button" onClick={() => orderStatusAction(order, "completed")}>
          Finalizar
        </button>
      );
    }

    return null;
  }

  function isFinalizedOrder(order: Record<string, unknown>) {
    if (isBarbershop && String(order.status || "") === "canceled") return true;
    return ["completed", "delivered"].includes(String(order.status || ""));
  }

  function openOrderEditor(order: Record<string, unknown>) {
    setError("");
    setEditingOrder(order);
    setEditForm({
      customerName: String(order.customerName || ""),
      customerPhone: String(order.customerPhone || ""),
      orderType: String(order.orderType || (isBarbershop ? "table" : "delivery")),
      status: String(order.status || "draft"),
      paymentMethod: String(order.paymentMethod || ""),
      subtotal: String(order.subtotal ?? order.total ?? "0"),
      deliveryFee: String(order.deliveryFee ?? "0"),
      discount: String(order.discount ?? "0"),
      total: String(order.total ?? "0"),
      notes: String(order.notes || "")
    });
  }

  function orderUpdatePayload(order: Record<string, unknown>, changes: Record<string, unknown>) {
    return {
      id: order.id,
      companyId,
      customerId: order.customerId || undefined,
      customerName: order.customerName || undefined,
      customerPhone: order.customerPhone || undefined,
      orderType: order.orderType || (isBarbershop ? "table" : "delivery"),
      status: order.status || "draft",
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      paymentMethod: order.paymentMethod || undefined,
      deliveryAddressId: order.deliveryAddressId || undefined,
      deliveryLatitude: order.deliveryLatitude || undefined,
      deliveryLongitude: order.deliveryLongitude || undefined,
      notes: order.notes || undefined,
      origin: order.origin || "painel",
      ticketzTicketId: order.ticketzTicketId || undefined,
      ...changes
    };
  }

  async function saveOrderEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingOrder) return;
    setSavingEdit(true);
    setError("");
    try {
      await api(session, "/api/orders", {
        method: "POST",
        body: JSON.stringify(orderUpdatePayload(editingOrder, {
          customerName: editForm.customerName.trim(),
          customerPhone: editForm.customerPhone.trim(),
          orderType: editForm.orderType,
          status: editForm.status,
          paymentMethod: editForm.paymentMethod.trim() || undefined,
          subtotal: Number(editForm.subtotal || 0),
          deliveryFee: isBarbershop ? 0 : Number(editForm.deliveryFee || 0),
          discount: Number(editForm.discount || 0),
          total: Number(editForm.total || 0),
          notes: editForm.notes.trim() || undefined
        }))
      });
      setEditingOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar pedido");
    } finally {
      setSavingEdit(false);
    }
  }

  async function cancelOrder(order: Record<string, unknown>) {
    if (!window.confirm(`Cancelar este ${orderWord}? Ele sai do quadro operacional, mas continua no historico.`)) return;
    setError("");
    try {
      await api(session, "/api/orders", {
        method: "POST",
        body: JSON.stringify(orderUpdatePayload(order, { status: "canceled" }))
      });
      setEditingOrder(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pedido");
    }
  }

  const activeDeliveryPersons = deliveryPersons.filter(person => person.active !== false && person.available !== false);

  function deliveryForOrder(order: Record<string, unknown>) {
    return deliveries.find(delivery => String(delivery.orderId) === String(order.id));
  }

  function deliveryPersonName(id: unknown) {
    const person = deliveryPersons.find(item => String(item.id) === String(id));
    return person ? String(person.name || "Motoboy") : "";
  }

  async function assignOrderDelivery(order: Record<string, unknown>) {
    const delivery = deliveryForOrder(order);
    if (!delivery) {
      setError("Entrega ainda nao foi criada para este pedido. Aceite o pedido primeiro.");
      return;
    }

    const selectedId = selectedDeliveryPersons[String(order.id)] || String(delivery.deliveryPersonId || "");
    if (!selectedId) {
      setError("Selecione o motoboy para enviar esta entrega.");
      return;
    }

    setAssigningDeliveryId(String(delivery.id));
    setError("");
    try {
      await api(session, `/api/deliveries/${delivery.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ companyId, deliveryPersonId: selectedId })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar entrega para motoboy");
    } finally {
      setAssigningDeliveryId(null);
    }
  }

  function renderDeliveryAssignment(order: Record<string, unknown>) {
    const orderType = String(order.orderType || "");
    const status = String(order.status || "");
    if (orderType !== "delivery" || ["draft", "waiting_confirmation", "completed", "delivered", "canceled"].includes(status)) return null;

    const delivery = deliveryForOrder(order);
    const selectedId = selectedDeliveryPersons[String(order.id)] || String(delivery?.deliveryPersonId || "");
    const assignedName = deliveryPersonName(delivery?.deliveryPersonId);

    return (
      <div className="deliveryAssignBox">
        <label>
          Motoboy
          <select
            value={selectedId}
            onChange={event => setSelectedDeliveryPersons(current => ({ ...current, [String(order.id)]: event.target.value }))}
          >
            <option value="">Selecione o motoboy</option>
            {activeDeliveryPersons.map(person => (
              <option value={String(person.id)} key={String(person.id)}>
                {String(person.name || "Motoboy")} {person.whatsapp || person.phone ? `- ${String(person.whatsapp || person.phone)}` : ""}
              </option>
            ))}
          </select>
        </label>
        {assignedName && <span>Atual: {assignedName}</span>}
        <button
          type="button"
          onClick={() => assignOrderDelivery(order)}
          disabled={!delivery || !selectedId || assigningDeliveryId === String(delivery?.id)}
        >
          {assigningDeliveryId === String(delivery?.id) ? "Enviando..." : assignedName ? "Reenviar/alterar motoboy" : "Enviar para motoboy"}
        </button>
      </div>
    );
  }

  const filtered = orders.filter(order => {
    const text = `${order.id} ${order.customerName} ${order.customerPhone} ${order.orderType} ${order.status}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const columns = [
    {
      key: "analysis",
      title: isBarbershop ? "Aguardando" : "Em analise",
      help: isBarbershop ? "Clientes aguardando inicio do atendimento." : "Pedidos novos aguardando aceite.",
      className: "analysis",
      statuses: ["draft", "waiting_confirmation"]
    },
    {
      key: "production",
      title: isBarbershop ? "Em atendimento" : "Em producao",
      help: isBarbershop ? "Atendimentos em andamento." : "Pedidos aceitos em preparo.",
      className: "production",
      statuses: ["confirmed", "preparing"]
    },
    {
      key: "ready",
      title: isBarbershop ? "Finalizados" : "Prontos para entrega",
      help: isBarbershop ? "Atendimentos finalizados ou cancelados." : "Pedidos liberados, em rota ou finalizados.",
      className: "ready",
      statuses: isBarbershop ? ["ready", "completed", "delivered", "canceled"] : ["ready", "out_for_delivery", "completed", "delivered"]
    }
  ];

  const orderWord = isBarbershop ? "atendimento" : "pedido";
  const orderWordTitle = isBarbershop ? "Atendimento" : "Pedido";
  const orderTypeText = (order: Record<string, unknown>) => (isBarbershop ? "Atendimento" : orderTypeLabel(order.orderType));

  return (
    <section className="restaurantPage">
      <div className="restaurantToolbar">
        <div className="restaurantTabs">
          <button type="button" className="active">Todos</button>
          {!isBarbershop && (
            <>
              <button type="button">Delivery</button>
              <button type="button">Mesa</button>
            </>
          )}
        </div>
        <label className="restaurantSearch">
          <Search />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={isBarbershop ? "Busque por cliente, telefone ou atendimento" : "Busque por cliente ou numero do pedido"}
          />
        </label>
        <span className="liveUpdateBadge">
          Ao vivo{lastUpdatedAt ? ` - ${lastUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
        </span>
        <button type="button" onClick={() => window.open(`/garcom/${companySlug}`, "_blank")}>
          {isBarbershop ? "+ Novo atendimento" : "+ Novo pedido"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="orderBoard">
        {columns.map(column => {
          const columnOrders = filtered.filter(order => column.statuses.includes(String(order.status)));
          return (
            <section className={`orderColumn ${column.className}`} key={column.key}>
              <header>
                <strong>{column.title}</strong>
                <span>{columnOrders.length}</span>
              </header>
              {column.key === "analysis" && !isBarbershop && (
                <div className="autoAcceptRow">
                  <span>Balcao: 40 a 60 min</span>
                  <span>Delivery: 50 a 80 min</span>
                  <button type="button">Editar</button>
                </div>
              )}
              <div className="orderCards">
                {columnOrders.length === 0 ? (
                  <div className="emptyColumn">
                    <strong>Nenhum {orderWord} no momento.</strong>
                    <p>{column.help}</p>
                  </div>
                ) : (
                  columnOrders.map(order => (
                    <article className="restaurantOrderCard" key={String(order.id)}>
                      <div>
                        <strong>{orderDisplayNumber(order)} - {String(order.customerName || "Cliente")}</strong>
                        <span>{orderTypeText(order)} - {String(order.customerPhone || "sem telefone")}</span>
                      </div>
                      <p>{String(order.notes || "Sem observacoes.")}</p>
                      <strong>{money(order.total)}</strong>
                      {renderDeliveryAssignment(order)}
                      {isFinalizedOrder(order) ? (
                        <div className="completedOrderBadge">{orderWordTitle} concluido</div>
                      ) : (
                        <div className="actions">
                          {["draft", "waiting_confirmation"].includes(String(order.status)) ? (
                            <button type="button" onClick={() => orderAction(order, "confirm")}>{isBarbershop ? "Iniciar atendimento" : "Aceitar pedido"}</button>
                          ) : (
                            <>
                              {renderStatusActions(order)}
                              {!isBarbershop && <button type="button" onClick={() => orderAction(order, "reprint")}>Reimprimir</button>}
                            </>
                          )}
                          <button type="button" className="secondaryAction" onClick={() => openOrderEditor(order)}>Editar</button>
                          <button type="button" className="dangerAction" onClick={() => cancelOrder(order)}>Cancelar</button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
      {editingOrder && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setEditingOrder(null)}>
          <form className="orderEditModal" onSubmit={saveOrderEdit} onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{orderWordTitle} {orderDisplayNumber(editingOrder)}</span>
                <strong>Editar {orderWord}</strong>
              </div>
              <button type="button" className="iconTextButton" onClick={() => setEditingOrder(null)}>Fechar</button>
            </header>
            <div className="orderEditGrid">
              <label>
                Cliente
                <input value={editForm.customerName || ""} onChange={event => setEditForm({ ...editForm, customerName: event.target.value })} />
              </label>
              <label>
                Telefone
                <input value={editForm.customerPhone || ""} onChange={event => setEditForm({ ...editForm, customerPhone: event.target.value })} />
              </label>
              <label>
                Tipo
                <select value={editForm.orderType || (isBarbershop ? "table" : "delivery")} onChange={event => setEditForm({ ...editForm, orderType: event.target.value })}>
                  {isBarbershop ? (
                    <>
                      <option value="table">Atendimento local</option>
                      <option value="pickup">Venda/retirada no balcao</option>
                    </>
                  ) : (
                    <>
                      <option value="delivery">Delivery</option>
                      <option value="pickup">Retirada</option>
                      <option value="table">Mesa</option>
                    </>
                  )}
                </select>
              </label>
              <label>
                Status
                <select value={editForm.status || "draft"} onChange={event => setEditForm({ ...editForm, status: event.target.value })}>
                  <option value="draft">Rascunho</option>
                  <option value="waiting_confirmation">Aguardando confirmacao</option>
                  <option value="confirmed">{isBarbershop ? "Em atendimento" : "Confirmado"}</option>
                  <option value="preparing">{isBarbershop ? "Em atendimento" : "Em preparo"}</option>
                  <option value="ready">{isBarbershop ? "Pronto/finalizando" : "Pronto"}</option>
                  {!isBarbershop && <option value="out_for_delivery">Em rota</option>}
                  <option value="completed">Concluido</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </label>
              <label>
                Pagamento
                <input value={editForm.paymentMethod || ""} onChange={event => setEditForm({ ...editForm, paymentMethod: event.target.value })} />
              </label>
              <label>
                Subtotal
                <input type="number" step="0.01" value={editForm.subtotal || "0"} onChange={event => setEditForm({ ...editForm, subtotal: event.target.value })} />
              </label>
              {!isBarbershop && (
                <label>
                  Taxa entrega
                  <input type="number" step="0.01" value={editForm.deliveryFee || "0"} onChange={event => setEditForm({ ...editForm, deliveryFee: event.target.value })} />
                </label>
              )}
              <label>
                Desconto
                <input type="number" step="0.01" value={editForm.discount || "0"} onChange={event => setEditForm({ ...editForm, discount: event.target.value })} />
              </label>
              <label>
                Total
                <input type="number" step="0.01" value={editForm.total || "0"} onChange={event => setEditForm({ ...editForm, total: event.target.value })} />
              </label>
              <label className="orderEditNotes">
                Observacao
                <textarea value={editForm.notes || ""} onChange={event => setEditForm({ ...editForm, notes: event.target.value })} />
              </label>
            </div>
            <footer>
              <button type="button" className="dangerAction" onClick={() => editingOrder && cancelOrder(editingOrder)}>Cancelar {orderWord}</button>
              <button type="submit" disabled={savingEdit}>{savingEdit ? "Salvando..." : "Salvar alteracoes"}</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

const tableStatusOptions = [
  { value: "free", label: "Livre" },
  { value: "waiting", label: "Aguardando" },
  { value: "eating", label: "Comendo" },
  { value: "reserved", label: "Reservada" },
  { value: "inactive", label: "Inativa" }
];

type BarberAppointment = Record<string, unknown>;

function appointmentStatusLabel(status: unknown) {
  const labels: Record<string, string> = {
    requested: "Aguardando confirmacao",
    confirmed: "Confirmado",
    completed: "Finalizado",
    canceled: "Cancelado",
    no_show: "Nao compareceu"
  };
  return labels[String(status || "requested")] || "Agendamento";
}

function appointmentTime(value: unknown) {
  return String(value || "").slice(0, 5) || "--:--";
}

function sameCalendarDay(value: unknown, day: string) {
  return dateInput(value) === day;
}

function BarbershopDashboard({ session, companyId }: { session: Session; companyId: string }) {
  const [appointments, setAppointments] = useState<BarberAppointment[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const today = dateInput(new Date());

  async function load() {
    setError("");
    try {
      const [loadedAppointments, loadedServices, loadedProfessionals, loadedCustomers] = await Promise.all([
        api(session, `/api/resources/appointments?companyId=${companyId}`),
        api(session, `/api/resources/services?companyId=${companyId}`),
        api(session, `/api/resources/professionals?companyId=${companyId}`),
        api(session, `/api/resources/customers?companyId=${companyId}`)
      ]);
      setAppointments(loadedAppointments);
      setServices(loadedServices);
      setProfessionals(loadedProfessionals);
      setCustomers(loadedCustomers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a visao da barbearia");
    }
  }

  useEffect(() => {
    void load();
  }, [session, companyId]);

  async function updateAppointmentStatus(item: BarberAppointment, status: string) {
    setError("");
    try {
      await api(session, `/api/resources/appointments/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel atualizar o agendamento");
    }
  }

  const serviceName = (id: unknown) => String(services.find(item => String(item.id) === String(id))?.name || "Servico");
  const professionalName = (id: unknown) => String(professionals.find(item => String(item.id) === String(id))?.name || "Sem preferencia");
  const customerName = (id: unknown) => String(customers.find(item => String(item.id) === String(id))?.name || "Cliente");
  const todayAppointments = appointments.filter(item => sameCalendarDay(item.date, today));
  const scheduled = todayAppointments.filter(item => ["requested", "confirmed"].includes(String(item.status))).sort((a, b) => appointmentTime(a.time).localeCompare(appointmentTime(b.time)));
  const completed = todayAppointments.filter(item => String(item.status) === "completed");
  const noShows = todayAppointments.filter(item => ["canceled", "no_show"].includes(String(item.status)));
  const revenue = completed.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const average = completed.length ? revenue / completed.length : 0;
  const topServices = Object.entries(
    completed.reduce<Record<string, number>>((acc, item) => {
      const name = serviceName(item.serviceId);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <section className="barberPage">
      <header className="barberSectionHeader">
        <div>
          <span>Resumo do dia</span>
          <h2>Barbearia em movimento</h2>
          <p>Agenda, faturamento realizado e proximos clientes em um so lugar.</p>
        </div>
        <button type="button" className="secondaryAction" onClick={() => void load()}>Atualizar dados</button>
      </header>
      {error && <div className="error">{error}</div>}
      <div className="barberMetrics">
        <article><span>Agenda de hoje</span><strong>{todayAppointments.length}</strong><small>{scheduled.length} aguardando atendimento</small></article>
        <article><span>Atendimentos finalizados</span><strong>{completed.length}</strong><small>{noShows.length} cancelados ou faltas</small></article>
        <article><span>Faturamento realizado</span><strong>{money(revenue)}</strong><small>Somente servicos finalizados</small></article>
        <article><span>Ticket medio</span><strong>{money(average)}</strong><small>Baseado nos atendimentos concluidos</small></article>
      </div>
      <div className="barberDashboardGrid">
        <section className="barberPanel">
          <header><div><h3>Proximos horarios</h3><p>Clientes esperados hoje.</p></div><CalendarDays /></header>
          {scheduled.length === 0 ? <div className="barberEmpty">Nenhum cliente aguardando neste momento.</div> : (
            <div className="barberTimeline">
              {scheduled.slice(0, 7).map(item => (
                <article key={String(item.id)}>
                  <time>{appointmentTime(item.time)}</time>
                  <div><strong>{customerName(item.customerId)}</strong><span>{serviceName(item.serviceId)} com {professionalName(item.professionalId)}</span></div>
                  <div className="barberDashboardAppointmentAction">
                    <b className={`appointmentStatus ${String(item.status)}`}>{appointmentStatusLabel(item.status)}</b>
                    {String(item.status) === "requested" && <button type="button" onClick={() => void updateAppointmentStatus(item, "confirmed")}>Aceitar</button>}
                    {String(item.status) === "confirmed" && <button type="button" onClick={() => void updateAppointmentStatus(item, "completed")}>Finalizar</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="barberPanel">
          <header><div><h3>Servicos mais feitos</h3><p>Finalizados hoje.</p></div><Scissors /></header>
          {topServices.length === 0 ? <div className="barberEmpty">Os servicos concluidos aparecerao aqui.</div> : (
            <div className="barberRanking">
              {topServices.map(([name, total], index) => <div key={name}><b>{index + 1}</b><span>{name}</span><strong>{total}</strong></div>)}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function BarbershopAppointmentsPage({ session, companyId }: { session: Session; companyId: string }) {
  const [appointments, setAppointments] = useState<BarberAppointment[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, unknown>[]>([]);
  const [date, setDate] = useState(dateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customerId: "", customerName: "", customerPhone: "", serviceId: "", professionalId: "", time: "09:00", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [loadedAppointments, loadedCustomers, loadedServices, loadedProfessionals] = await Promise.all([
        api(session, `/api/resources/appointments?companyId=${companyId}`),
        api(session, `/api/resources/customers?companyId=${companyId}`),
        api(session, `/api/resources/services?companyId=${companyId}`),
        api(session, `/api/resources/professionals?companyId=${companyId}`)
      ]);
      setAppointments(loadedAppointments);
      setCustomers(loadedCustomers);
      setServices(loadedServices);
      setProfessionals(loadedProfessionals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a agenda");
    }
  }

  useEffect(() => { void load(); }, [session, companyId]);

  const serviceName = (id: unknown) => String(services.find(item => String(item.id) === String(id))?.name || "Servico");
  const professionalName = (id: unknown) => String(professionals.find(item => String(item.id) === String(id))?.name || "Sem preferencia");
  const customer = (id: unknown) => customers.find(item => String(item.id) === String(id));
  const visible = appointments
    .filter(item => sameCalendarDay(item.date, date))
    .filter(item => statusFilter === "all" || String(item.status) === statusFilter)
    .sort((a, b) => appointmentTime(a.time).localeCompare(appointmentTime(b.time)));

  async function setStatus(item: BarberAppointment, status: string) {
    setError("");
    try {
      await api(session, `/api/resources/appointments/${item.id}`, { method: "PUT", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel atualizar o atendimento");
    }
  }

  function selectedService() {
    return services.find(item => String(item.id) === form.serviceId);
  }

  function selectService(value: string) {
    const service = services.find(item => String(item.id) === value);
    setForm(current => ({ ...current, serviceId: value, price: service ? String(service.price || "") : current.price }));
  }

  async function saveAppointment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let customerId = form.customerId;
      if (!customerId) {
        if (!form.customerName.trim()) throw new Error("Selecione ou cadastre o cliente.");
        const createdCustomer = await api(session, "/api/resources/customers", {
          method: "POST",
          body: JSON.stringify({ companyId, name: form.customerName.trim(), phone: form.customerPhone.trim() || undefined, whatsapp: form.customerPhone.trim() || undefined })
        });
        customerId = String(createdCustomer.id);
      }
      const service = selectedService();
      if (!service || !form.professionalId || !form.time) throw new Error("Informe servico, barbeiro e horario.");
      await api(session, "/api/resources/appointments", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          customerId,
          serviceId: form.serviceId,
          professionalId: form.professionalId,
          date: new Date(`${date}T12:00:00`).toISOString(),
          time: form.time,
          status: "confirmed",
          price: Number(form.price || service.price || 0),
          notes: form.notes.trim() || undefined,
          origin: "painel"
        })
      });
      setShowNew(false);
      setForm({ customerId: "", customerName: "", customerPhone: "", serviceId: "", professionalId: "", time: "09:00", price: "", notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="barberPage">
      <header className="barberSectionHeader">
        <div><span>Operacao</span><h2>Agenda</h2><p>Confirme, inicie e finalize atendimentos sem perder o historico do cliente.</p></div>
        <button type="button" onClick={() => setShowNew(value => !value)}>{showNew ? "Fechar" : "+ Novo agendamento"}</button>
      </header>
      <div className="barberAgendaToolbar">
        <label>Data<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos</option><option value="requested">Aguardando</option><option value="confirmed">Confirmados</option><option value="completed">Finalizados</option><option value="canceled">Cancelados</option><option value="no_show">Nao compareceram</option></select></label>
        <button type="button" className="secondaryAction" onClick={() => void load()}>Atualizar</button>
      </div>
      {error && <div className="error">{error}</div>}
      {showNew && <form className="barberAppointmentForm" onSubmit={saveAppointment}>
        <header><div><strong>Novo horario</strong><span>Crie no painel um atendimento para cliente ja cadastrado ou novo.</span></div></header>
        <label>Cliente cadastrado<select value={form.customerId} onChange={event => setForm({ ...form, customerId: event.target.value, customerName: "", customerPhone: "" })}><option value="">Cadastrar cliente novo abaixo</option>{customers.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.name)} {item.phone ? `- ${String(item.phone)}` : ""}</option>)}</select></label>
        {!form.customerId && <><label>Nome do cliente<input value={form.customerName} onChange={event => setForm({ ...form, customerName: event.target.value })} placeholder="Nome completo" /></label><label>WhatsApp<input value={form.customerPhone} onChange={event => setForm({ ...form, customerPhone: event.target.value })} placeholder="DDD + numero" /></label></>}
        <label>Servico<select value={form.serviceId} onChange={event => selectService(event.target.value)} required><option value="">Selecione</option>{services.filter(item => item.active !== false).map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.name)} - {money(item.price)}</option>)}</select></label>
        <label>Barbeiro<select value={form.professionalId} onChange={event => setForm({ ...form, professionalId: event.target.value })} required><option value="">Selecione</option>{professionals.filter(item => item.active !== false).map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select></label>
        <label>Horario<input type="time" value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} required /></label>
        <label>Valor<input type="number" step="0.01" min="0" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>
        <label className="barberAppointmentNotes">Observacao<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Preferencias, observacoes ou recado para o barbeiro" /></label>
        <footer><button type="button" className="secondaryAction" onClick={() => setShowNew(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Salvando..." : "Confirmar horario"}</button></footer>
      </form>}
      <div className="barberAgendaList">
        {visible.length === 0 ? <div className="barberEmpty">Nenhum agendamento para esta data.</div> : visible.map(item => {
          const client = customer(item.customerId);
          const status = String(item.status || "requested");
          return <article className={`barberAppointment status-${status}`} key={String(item.id)}>
            <time>{appointmentTime(item.time)}</time>
            <div className="barberAppointmentIdentity"><strong>{String(client?.name || "Cliente")}</strong><span>{String(client?.whatsapp || client?.phone || "Sem telefone")}</span></div>
            <div><strong>{serviceName(item.serviceId)}</strong><span>{professionalName(item.professionalId)}</span></div>
            <div><strong>{money(item.price)}</strong><span>{String(item.notes || "Sem observacao")}</span></div>
            <div className="barberAppointmentActions"><b className={`appointmentStatus ${status}`}>{appointmentStatusLabel(status)}</b>{status === "requested" && <button type="button" onClick={() => void setStatus(item, "confirmed")}>Confirmar</button>}{status === "confirmed" && <button type="button" onClick={() => void setStatus(item, "completed")}>Finalizar</button>}{["requested", "confirmed"].includes(status) && <button type="button" className="dangerAction" onClick={() => void setStatus(item, "canceled")}>Cancelar</button>}</div>
          </article>;
        })}
      </div>
    </section>
  );
}

function BarbershopFinancialPage({ session, companyId }: { session: Session; companyId: string }) {
  const [appointments, setAppointments] = useState<BarberAppointment[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [period, setPeriod] = useState(dateInput(new Date()).slice(0, 7));
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [loadedAppointments, loadedServices, loadedProfessionals, loadedCustomers] = await Promise.all([
        api(session, `/api/resources/appointments?companyId=${companyId}`), api(session, `/api/resources/services?companyId=${companyId}`), api(session, `/api/resources/professionals?companyId=${companyId}`), api(session, `/api/resources/customers?companyId=${companyId}`)
      ]);
      setAppointments(loadedAppointments); setServices(loadedServices); setProfessionals(loadedProfessionals); setCustomers(loadedCustomers);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao carregar financeiro"); }
  }
  useEffect(() => { void load(); }, [session, companyId]);
  const serviceName = (id: unknown) => String(services.find(item => String(item.id) === String(id))?.name || "Servico");
  const professionalName = (id: unknown) => String(professionals.find(item => String(item.id) === String(id))?.name || "Sem preferencia");
  const customerName = (id: unknown) => String(customers.find(item => String(item.id) === String(id))?.name || "Cliente");
  const monthly = appointments.filter(item => dateInput(item.date).startsWith(period));
  const completed = monthly.filter(item => String(item.status) === "completed");
  const future = monthly.filter(item => ["requested", "confirmed"].includes(String(item.status)));
  const canceled = monthly.filter(item => ["canceled", "no_show"].includes(String(item.status)));
  const revenue = completed.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const expected = future.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const byProfessional = Object.entries(completed.reduce<Record<string, { count: number; value: number }>>((acc, item) => { const name = professionalName(item.professionalId); acc[name] = acc[name] || { count: 0, value: 0 }; acc[name].count += 1; acc[name].value += Number(item.price || 0); return acc; }, {})).sort((a, b) => b[1].value - a[1].value);
  return <section className="barberPage"><header className="barberSectionHeader"><div><span>Financeiro</span><h2>Faturamento da barbearia</h2><p>Valores realizados por atendimento. Produtos e despesas entram na proxima evolucao do caixa.</p></div><label className="barberPeriod">Mes<input type="month" value={period} onChange={event => setPeriod(event.target.value)} /></label></header>{error && <div className="error">{error}</div>}<div className="barberMetrics"><article><span>Faturamento realizado</span><strong>{money(revenue)}</strong><small>{completed.length} atendimentos finalizados</small></article><article><span>Agenda a realizar</span><strong>{money(expected)}</strong><small>{future.length} horarios confirmados/pendentes</small></article><article><span>Cancelamentos e faltas</span><strong>{canceled.length}</strong><small>nao somam no faturamento</small></article><article><span>Ticket medio</span><strong>{money(completed.length ? revenue / completed.length : 0)}</strong><small>por atendimento concluido</small></article></div><div className="barberDashboardGrid"><section className="barberPanel"><header><div><h3>Por barbeiro</h3><p>Producao finalizada no periodo.</p></div><Scissors /></header>{byProfessional.length === 0 ? <div className="barberEmpty">Ainda nao ha atendimentos finalizados neste periodo.</div> : <div className="barberRanking">{byProfessional.map(([name, total], index) => <div key={name}><b>{index + 1}</b><span>{name}<small>{total.count} atendimentos</small></span><strong>{money(total.value)}</strong></div>)}</div>}</section><section className="barberPanel"><header><div><h3>Ultimos recebimentos</h3><p>Atendimentos concluidos.</p></div><Banknote /></header>{completed.length === 0 ? <div className="barberEmpty">Os recebimentos aparecerao quando o atendimento for finalizado.</div> : <div className="barberTimeline">{completed.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 7).map(item => <article key={String(item.id)}><time>{dateInput(item.date).split("-").reverse().slice(0, 2).join("/")}</time><div><strong>{customerName(item.customerId)}</strong><span>{serviceName(item.serviceId)} com {professionalName(item.professionalId)}</span></div><b>{money(item.price)}</b></article>)}</div>}</section></div></section>;
}

function tableStatusLabel(value: unknown) {
  return tableStatusOptions.find(option => option.value === String(value || ""))?.label || "Livre";
}

function tableStatusTone(value: unknown) {
  const status = String(value || "free");
  if (status === "waiting") return "Aguardando";
  if (status === "eating") return "Em uso";
  if (status === "reserved") return "Reservada";
  if (status === "inactive") return "Inativa";
  return "Livre";
}

function RestaurantTablesManagementPage({
  session,
  companyId,
  orders,
  companySlug,
  variant = "restaurant"
}: {
  session: Session;
  companyId: string;
  orders: Record<string, unknown>[];
  companySlug: string;
  variant?: "restaurant" | "barbershop";
}) {
  const isBarbershop = variant === "barbershop";
  const statusOptions = isBarbershop
    ? [
        { value: "free", label: "Livre" },
        { value: "waiting", label: "Aguardando cliente" },
        { value: "eating", label: "Em atendimento" },
        { value: "reserved", label: "Agendada" },
        { value: "inactive", label: "Inativa" }
      ]
    : tableStatusOptions;
  const copy = isBarbershop
    ? {
        title: "Cadeiras",
        description: "Cadastre cadeiras, vincule barbeiros e acompanhe quem esta livre, aguardando ou atendendo.",
        openButton: "Abrir tela do atendente",
        defaultButton: "Criar 4 cadeiras",
        defaultEmptyButton: "Criar 4 cadeiras padrao",
        noneTitle: "Nenhuma cadeira cadastrada.",
        noneDescription: "Crie as cadeiras manualmente ou gere uma grade inicial com 4 cadeiras.",
        editTitle: "Editar cadeira",
        addTitle: "Adicionar cadeira",
        editorHelp: "Use status para controlar livre, aguardando cliente, em atendimento ou agendada.",
        numberLabel: "Numero da cadeira",
        nameLabel: "Nome da cadeira",
        capacityLabel: "Vagas",
        locationLabel: "Barbeiro vinculado",
        notesLabel: "Observacao",
        numberPlaceholder: "Ex.: 01",
        namePlaceholder: "Ex.: Cadeira principal",
        locationPlaceholder: "Ex.: Bruno, Lucas...",
        notesPlaceholder: "Ex.: cadeira proxima ao lavatorio, barbeiro folga segunda...",
        free: "Livre",
        waiting: "Aguardando",
        eating: "Em atendimento",
        reserved: "Agendada",
        inactive: "Inativa",
        cardFallback: "Sem observacao.",
        quickEating: "Atendendo",
        inUseBadge: "Atendimento aberto"
      }
    : {
        title: "Mesas",
        description: "Cadastre mesas, acompanhe status do salao e abra comandas pelo garcom.",
        openButton: "Abrir tela do garcom",
        defaultButton: "Criar 12 mesas",
        defaultEmptyButton: "Criar 12 mesas padrao",
        noneTitle: "Nenhuma mesa cadastrada.",
        noneDescription: "Crie as mesas manualmente ou gere uma grade inicial com 12 mesas.",
        editTitle: "Editar mesa",
        addTitle: "Adicionar mesa",
        editorHelp: "Use status para controlar livre, aguardando, comendo ou reserva.",
        numberLabel: "Numero",
        nameLabel: "Nome",
        capacityLabel: "Lugares",
        locationLabel: "Local",
        notesLabel: "Observacao",
        numberPlaceholder: "Ex.: 01",
        namePlaceholder: "Ex.: Mesa varanda",
        locationPlaceholder: "Salao, varanda...",
        notesPlaceholder: "Ex.: perto da entrada, juntar com mesa 04...",
        free: "Livre",
        waiting: "Aguardando",
        eating: "Comendo",
        reserved: "Reservada",
        inactive: "Inativa",
        cardFallback: "Sem pedido aberto.",
        quickEating: "Comendo",
        inUseBadge: "Pedido aberto"
      };
  const emptyForm = {
    number: "",
    name: "",
    capacity: isBarbershop ? "1" : "4",
    location: "",
    status: "free",
    active: "true",
    notes: ""
  };
  const [tables, setTables] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTables() {
    setError("");
    try {
      const loaded = await api(session, `/api/resources/restaurantTables?companyId=${companyId}`);
      setTables(
        [...loaded].sort((a, b) =>
          String(a.number || "").localeCompare(String(b.number || ""), "pt-BR", { numeric: true })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : isBarbershop ? "Erro ao carregar cadeiras" : "Erro ao carregar mesas");
    }
  }

  useEffect(() => {
    void loadTables();
  }, [session, companyId]);

  function resetForm() {
    setEditingTable(null);
    setForm(emptyForm);
  }

  function editTable(table: Record<string, unknown>) {
    setEditingTable(table);
    setForm({
      number: String(table.number || ""),
      name: String(table.name || ""),
      capacity: String(table.capacity || (isBarbershop ? "1" : "4")),
      location: String(table.location || ""),
      status: String(table.status || "free"),
      active: table.active === false ? "false" : "true",
      notes: String(table.notes || "")
    });
  }

  async function saveTable(event: React.FormEvent) {
    event.preventDefault();
    if (!form.number.trim()) {
      setError(isBarbershop ? "Informe o numero da cadeira." : "Informe o numero da mesa.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      companyId,
      number: form.number.trim(),
      name: form.name.trim() || undefined,
      capacity: Math.max(1, Number(form.capacity || 1)),
      location: form.location.trim() || undefined,
      status: form.active === "false" ? "inactive" : form.status,
      active: form.active === "true",
      notes: form.notes.trim() || undefined
    };

    try {
      if (editingTable) {
        await api(session, `/api/resources/restaurantTables/${editingTable.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await api(session, "/api/resources/restaurantTables", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : isBarbershop ? "Erro ao salvar cadeira" : "Erro ao salvar mesa");
    } finally {
      setSaving(false);
    }
  }

  async function removeTable(table: Record<string, unknown>) {
    if (!window.confirm(`Remover ${isBarbershop ? "a cadeira" : "a mesa"} ${String(table.number || "")}?`)) return;
    setError("");
    try {
      await api(session, `/api/resources/restaurantTables/${table.id}`, { method: "DELETE" });
      if (editingTable?.id === table.id) resetForm();
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : isBarbershop ? "Erro ao remover cadeira" : "Erro ao remover mesa");
    }
  }

  async function quickStatus(table: Record<string, unknown>, status: string) {
    setError("");
    try {
      await api(session, `/api/resources/restaurantTables/${table.id}`, {
        method: "PUT",
        body: JSON.stringify({
          number: table.number,
          name: table.name || undefined,
          capacity: Number(table.capacity || 4),
          location: table.location || undefined,
          notes: table.notes || undefined,
          active: status !== "inactive",
          status
        })
      });
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : isBarbershop ? "Erro ao atualizar cadeira" : "Erro ao atualizar mesa");
    }
  }

  async function createDefaultTables() {
    setSaving(true);
    setError("");
    try {
      const count = isBarbershop ? 4 : 12;
      for (let index = 1; index <= count; index += 1) {
        await api(session, "/api/resources/restaurantTables", {
          method: "POST",
          body: JSON.stringify({
            companyId,
            number: String(index),
            name: `${isBarbershop ? "Cadeira" : "Mesa"} ${index}`,
            capacity: isBarbershop ? 1 : 4,
            status: "free",
            active: true
          })
        });
      }
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : isBarbershop ? "Erro ao criar cadeiras padrao" : "Erro ao criar mesas padrao");
    } finally {
      setSaving(false);
    }
  }

  const tableOrders = orders.filter(order => order.orderType === "table" && !["completed", "canceled"].includes(String(order.status || "")));

  const tableStats = tables.reduce<{ free: number; waiting: number; eating: number; reserved: number; inactive: number }>(
    (acc, table) => {
      const order = orderForTable(table);
      const status = order ? "eating" : table.active === false ? "inactive" : String(table.status || "free");
      if (status === "waiting") acc.waiting += 1;
      else if (status === "eating") acc.eating += 1;
      else if (status === "reserved") acc.reserved += 1;
      else if (status === "inactive") acc.inactive += 1;
      else acc.free += 1;
      return acc;
    },
    { free: 0, waiting: 0, eating: 0, reserved: 0, inactive: 0 }
  );

  function orderForTable(table: Record<string, unknown>) {
    const number = String(table.number || "").toLowerCase();
    return tableOrders.find(item => {
      const notes = String(item.notes || "").toLowerCase();
      return notes.includes(`${isBarbershop ? "cadeira" : "mesa"}: ${number}`) || notes.includes(`mesa: ${number}`);
    });
  }

  function statusLabel(value: unknown) {
    return statusOptions.find(option => option.value === String(value || ""))?.label || copy.free;
  }

  function statusTone(value: unknown) {
    const status = String(value || "free");
    if (status === "waiting") return copy.waiting;
    if (status === "eating") return copy.eating;
    if (status === "reserved") return copy.reserved;
    if (status === "inactive") return copy.inactive;
    return copy.free;
  }

  return (
    <section className="restaurantPage">
      <header className="restaurantSectionHeader">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="tableHeaderActions">
          {tables.length === 0 && (
            <button type="button" className="secondaryAction" onClick={createDefaultTables} disabled={saving}>
              {saving ? "Criando..." : copy.defaultButton}
            </button>
          )}
          <button type="button" onClick={() => window.open(`/garcom/${companySlug}`, "_blank")}>{copy.openButton}</button>
        </div>
      </header>
      <div className="tableStats">
        <div className="tableStat is-free"><span>{copy.free}</span><strong>{tableStats.free}</strong></div>
        <div className="tableStat is-waiting"><span>{copy.waiting}</span><strong>{tableStats.waiting}</strong></div>
        <div className="tableStat is-eating"><span>{copy.eating}</span><strong>{tableStats.eating}</strong></div>
        <div className="tableStat is-reserved"><span>{copy.reserved}</span><strong>{tableStats.reserved}</strong></div>
        <div className="tableStat is-inactive"><span>{copy.inactive}</span><strong>{tableStats.inactive}</strong></div>
      </div>
      <form className="tableEditor" onSubmit={saveTable}>
        <div className="tableEditorHead">
          <div>
            <strong>{editingTable ? copy.editTitle : copy.addTitle}</strong>
            <span>{copy.editorHelp}</span>
          </div>
          {editingTable && <button type="button" className="secondaryAction" onClick={resetForm}>Cancelar edicao</button>}
        </div>
        <label>
          {copy.numberLabel}
          <input value={form.number} onChange={event => setForm({ ...form, number: event.target.value })} required placeholder={copy.numberPlaceholder} />
        </label>
        <label>
          {copy.nameLabel}
          <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={copy.namePlaceholder} />
        </label>
        <label>
          {copy.capacityLabel}
          <input type="number" min="1" value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })} />
        </label>
        <label>
          {copy.locationLabel}
          <input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} placeholder={copy.locationPlaceholder} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
            {statusOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Ativa
          <select value={form.active} onChange={event => setForm({ ...form, active: event.target.value })}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </label>
        <label className="tableNotesField">
          {copy.notesLabel}
          <textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder={copy.notesPlaceholder} />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="tableEditorActions">
          {editingTable && <button type="button" className="secondaryAction" onClick={resetForm}>Limpar edicao</button>}
          <button type="submit" disabled={saving}>{saving ? "Salvando..." : editingTable ? "Salvar alteracoes" : copy.addTitle}</button>
        </div>
      </form>
      {tables.length === 0 && (
        <div className="emptyState tableEmptyState">
          <strong>{copy.noneTitle}</strong>
          <span>{copy.noneDescription}</span>
          <button type="button" onClick={createDefaultTables} disabled={saving}>{saving ? "Criando..." : copy.defaultEmptyButton}</button>
        </div>
      )}
      <div className="tablesGrid">
        {tables.map(table => {
          const order = orderForTable(table);
          const status = order ? "eating" : table.active === false ? "inactive" : String(table.status || "free");
          return (
            <article className={`tableCard status-${status}`} key={String(table.id)}>
              <div className="tableCardTop">
                <div>
                  <strong>{String(table.name || `${isBarbershop ? "Cadeira" : "Mesa"} ${table.number}`)}</strong>
                  <span>
                    {isBarbershop
                      ? `Cadeira ${String(table.number || "-")}${table.location ? ` - ${String(table.location)}` : ""}`
                      : `Mesa ${String(table.number || "-")} - ${String(table.capacity || 1)} lugares`}
                  </span>
                </div>
                <b>{order ? copy.inUseBadge : statusTone(status)}</b>
              </div>
              <div className="tableMetaRow">
                {!isBarbershop && Boolean(table.location) && <span>{String(table.location)}</span>}
                <span>{statusLabel(status)}</span>
              </div>
              {order ? (
                <p>{String(order.customerName || (isBarbershop ? "Cliente" : "Cliente mesa"))} - {money(order.total)}</p>
              ) : (
                <p>{String(table.notes || copy.cardFallback)}</p>
              )}
              <div className="tableQuickActions">
                <button type="button" className="statusFreeAction" onClick={() => quickStatus(table, "free")}>{copy.free}</button>
                <button type="button" className="statusWaitingAction" onClick={() => quickStatus(table, "waiting")}>{copy.waiting}</button>
                <button type="button" className="statusEatingAction" onClick={() => quickStatus(table, "eating")}>{copy.quickEating}</button>
              </div>
              <div className="tableCardActions">
                <button type="button" className="secondaryAction" onClick={() => editTable(table)}>Editar</button>
                <button type="button" className="dangerAction" onClick={() => removeTable(table)}>Remover</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RestaurantTablesPage({ orders, companySlug }: { orders: Record<string, unknown>[]; companySlug: string }) {
  const tableOrders = orders.filter(order => order.orderType === "table");
  const tables = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const order = tableOrders.find(item => String(item.notes || "").toLowerCase().includes(`mesa: ${number}`));
    return { number, order };
  });

  return (
    <section className="restaurantPage">
      <header className="restaurantSectionHeader">
        <div>
          <h2>Mesas</h2>
          <p>Acompanhe consumo, espera e pedidos de salao.</p>
        </div>
        <button type="button" onClick={() => window.open(`/garcom/${companySlug}`, "_blank")}>Abrir tela do garcom</button>
      </header>
      <div className="tablesGrid">
        {tables.map(table => (
          <article className={table.order ? "tableCard busy" : "tableCard"} key={table.number}>
            <strong>Mesa {table.number}</strong>
            <span>{table.order ? "Comendo / pedido aberto" : "Livre"}</span>
            {table.order && <p>{String(table.order.customerName || "Cliente mesa")} â€¢ {money(table.order.total)}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function RestaurantFinancialPage({
  session,
  companyId,
  orders,
  paymentMethods,
  onOrdersChanged
}: {
  session: Session;
  companyId: string;
  orders: Record<string, unknown>[];
  paymentMethods: Record<string, unknown>[];
  onOrdersChanged: (orders: Record<string, unknown>[]) => void;
}) {
  const today = new Date().toLocaleDateString("pt-BR");
  const [error, setError] = useState("");
  const [editingOrder, setEditingOrder] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function refreshOrders() {
    const loadedOrders = await api(session, `/api/resources/orders?companyId=${companyId}`);
    onOrdersChanged(loadedOrders);
  }

  function openEditor(order: Record<string, unknown>) {
    setError("");
    setEditingOrder(order);
    setEditForm({
      customerName: String(order.customerName || ""),
      customerPhone: String(order.customerPhone || ""),
      orderType: String(order.orderType || "delivery"),
      status: String(order.status || "completed"),
      paymentMethod: String(order.paymentMethod || ""),
      subtotal: String(order.subtotal ?? order.total ?? "0"),
      deliveryFee: String(order.deliveryFee ?? "0"),
      discount: String(order.discount ?? "0"),
      total: String(order.total ?? "0"),
      notes: String(order.notes || "")
    });
  }

  function orderUpdatePayload(order: Record<string, unknown>, changes: Record<string, unknown>) {
    return {
      id: order.id,
      companyId,
      customerId: order.customerId || undefined,
      customerName: order.customerName || undefined,
      customerPhone: order.customerPhone || undefined,
      orderType: order.orderType || "delivery",
      status: order.status || "completed",
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      paymentMethod: order.paymentMethod || undefined,
      deliveryAddressId: order.deliveryAddressId || undefined,
      deliveryLatitude: order.deliveryLatitude || undefined,
      deliveryLongitude: order.deliveryLongitude || undefined,
      notes: order.notes || undefined,
      origin: order.origin || "painel",
      ticketzTicketId: order.ticketzTicketId || undefined,
      ...changes
    };
  }

  async function saveOrderEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingOrder) return;
    setSaving(true);
    setError("");
    try {
      await api(session, "/api/orders", {
        method: "POST",
        body: JSON.stringify(orderUpdatePayload(editingOrder, {
          customerName: editForm.customerName.trim(),
          customerPhone: editForm.customerPhone.trim(),
          orderType: editForm.orderType,
          status: editForm.status,
          paymentMethod: editForm.paymentMethod.trim() || undefined,
          subtotal: Number(editForm.subtotal || 0),
          deliveryFee: Number(editForm.deliveryFee || 0),
          discount: Number(editForm.discount || 0),
          total: Number(editForm.total || 0),
          notes: editForm.notes.trim() || undefined
        }))
      });
      setEditingOrder(null);
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar pedido no financeiro");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder(order: Record<string, unknown>) {
    if (!window.confirm("Marcar este pedido como cancelado? Ele ficara no financeiro, mas nao entra no faturamento.")) return;
    setError("");
    try {
      await api(session, "/api/orders", {
        method: "POST",
        body: JSON.stringify(orderUpdatePayload(order, { status: "canceled" }))
      });
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pedido no financeiro");
    }
  }

  const todayOrders = orders.filter(order => new Date(String(order.createdAt)).toLocaleDateString("pt-BR") === today);
  const closedOrders = todayOrders.filter(order => ["completed", "delivered", "canceled"].includes(String(order.status)));
  const paidOrders = closedOrders.filter(order => String(order.status) !== "canceled");
  const canceledOrders = closedOrders.filter(order => String(order.status) === "canceled");
  const total = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const canceledTotal = canceledOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const deliveryTotal = paidOrders.filter(order => order.orderType === "delivery").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const average = paidOrders.length ? total / paidOrders.length : 0;
  const filteredClosedOrders = closedOrders.filter(order => {
    const text = `${orderDisplayNumber(order)} ${order.customerName} ${order.customerPhone} ${order.paymentMethod} ${order.status}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const paymentSummary = paidOrders.reduce<Record<string, number>>((summary, order) => {
    const method = String(order.paymentMethod || "Nao informado");
    summary[method] = (summary[method] || 0) + Number(order.total || 0);
    return summary;
  }, {});

  return (
    <section className="restaurantPage">
      <header className="restaurantSectionHeader">
        <div>
          <h2>Financeiro</h2>
          <p>Fechamento do dia, pedidos finalizados e cancelamentos.</p>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      <div className="financeGrid">
        <article><span>Faturamento hoje</span><strong>{money(total)}</strong></article>
        <article><span>Pedidos pagos</span><strong>{paidOrders.length}</strong></article>
        <article><span>Ticket medio</span><strong>{money(average)}</strong></article>
        <article><span>Delivery pago</span><strong>{money(deliveryTotal)}</strong></article>
        <article><span>Cancelados</span><strong>{canceledOrders.length}</strong></article>
        <article><span>Valor cancelado</span><strong>{money(canceledTotal)}</strong></article>
      </div>
      <section className="financialOrdersPanel">
        <header>
          <div>
            <h3>Pedidos do financeiro</h3>
            <p>Entram aqui pedidos finalizados, entregues ou cancelados de hoje. Cancelados nao somam no faturamento.</p>
          </div>
          <label className="restaurantSearch compact">
            <Search />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pedido, cliente ou pagamento" />
          </label>
        </header>
        <div className="financialOrdersTable">
          {filteredClosedOrders.length === 0 ? (
            <div className="emptyColumn">
              <strong>Nenhum pedido fechado no financeiro.</strong>
              <p>Finalize ou cancele pedidos para aparecerem aqui.</p>
            </div>
          ) : (
            filteredClosedOrders.map(order => {
              const canceled = String(order.status) === "canceled";
              return (
                <article className={canceled ? "financialOrderRow canceled" : "financialOrderRow"} key={String(order.id)}>
                  <div>
                    <strong>{orderDisplayNumber(order)} - {String(order.customerName || "Cliente")}</strong>
                    <span>{orderTypeLabel(order.orderType)} - {orderStatusLabel(order.status)}</span>
                  </div>
                  <div>
                    <span>Pagamento</span>
                    <strong>{String(order.paymentMethod || "Nao informado")}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(order.total)}</strong>
                  </div>
                  <div className="financialOrderActions">
                    <button type="button" onClick={() => openEditor(order)}>Editar</button>
                    {!canceled && <button type="button" className="dangerAction" onClick={() => cancelOrder(order)}>Cancelar</button>}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      <section className="paymentPanel">
        <h3>Formas de pagamento</h3>
        {paymentMethods.length === 0 ? (
          <p>Nenhuma forma de pagamento cadastrada ainda.</p>
        ) : (
          paymentMethods.map(method => (
            <div className="paymentRow" key={String(method.id)}>
              <span>{String(method.name || method.type || method.id)}</span>
              <strong>{String(method.active ?? "-")}</strong>
            </div>
          ))
        )}
      </section>
      <section className="paymentPanel">
        <h3>Recebido por forma de pagamento</h3>
        {Object.keys(paymentSummary).length === 0 ? (
          <p>Nenhum pagamento contabilizado hoje.</p>
        ) : (
          Object.entries(paymentSummary).map(([method, value]) => (
            <div className="paymentRow" key={method}>
              <span>{method}</span>
              <strong>{money(value)}</strong>
            </div>
          ))
        )}
      </section>
      {editingOrder && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setEditingOrder(null)}>
          <form className="orderEditModal" onSubmit={saveOrderEdit} onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>Pedido {orderDisplayNumber(editingOrder)}</span>
                <strong>Editar financeiro</strong>
              </div>
              <button type="button" className="iconTextButton" onClick={() => setEditingOrder(null)}>Fechar</button>
            </header>
            <div className="orderEditGrid">
              <label>
                Cliente
                <input value={editForm.customerName || ""} onChange={event => setEditForm({ ...editForm, customerName: event.target.value })} />
              </label>
              <label>
                Telefone
                <input value={editForm.customerPhone || ""} onChange={event => setEditForm({ ...editForm, customerPhone: event.target.value })} />
              </label>
              <label>
                Tipo
                <select value={editForm.orderType || "delivery"} onChange={event => setEditForm({ ...editForm, orderType: event.target.value })}>
                  <option value="delivery">Delivery</option>
                  <option value="pickup">Retirada</option>
                  <option value="table">Mesa</option>
                </select>
              </label>
              <label>
                Status financeiro
                <select value={editForm.status || "completed"} onChange={event => setEditForm({ ...editForm, status: event.target.value })}>
                  <option value="completed">Finalizado</option>
                  <option value="delivered">Entregue</option>
                  <option value="canceled">Cancelado</option>
                  <option value="out_for_delivery">Em rota</option>
                  <option value="ready">Pronto</option>
                </select>
              </label>
              <label>
                Pagamento
                <select value={editForm.paymentMethod || ""} onChange={event => setEditForm({ ...editForm, paymentMethod: event.target.value })}>
                  <option value="">Nao informado</option>
                  {paymentMethods.map(method => (
                    <option value={String(method.name || method.type || "")} key={String(method.id)}>
                      {String(method.name || method.type || "Pagamento")}
                    </option>
                  ))}
                  {editForm.paymentMethod && !paymentMethods.some(method => String(method.name || method.type || "") === editForm.paymentMethod) && (
                    <option value={editForm.paymentMethod}>{editForm.paymentMethod}</option>
                  )}
                </select>
              </label>
              <label>
                Subtotal
                <input type="number" step="0.01" value={editForm.subtotal || "0"} onChange={event => setEditForm({ ...editForm, subtotal: event.target.value })} />
              </label>
              <label>
                Taxa entrega
                <input type="number" step="0.01" value={editForm.deliveryFee || "0"} onChange={event => setEditForm({ ...editForm, deliveryFee: event.target.value })} />
              </label>
              <label>
                Desconto
                <input type="number" step="0.01" value={editForm.discount || "0"} onChange={event => setEditForm({ ...editForm, discount: event.target.value })} />
              </label>
              <label>
                Total
                <input type="number" step="0.01" value={editForm.total || "0"} onChange={event => setEditForm({ ...editForm, total: event.target.value })} />
              </label>
              <label className="orderEditNotes">
                Observacao
                <textarea value={editForm.notes || ""} onChange={event => setEditForm({ ...editForm, notes: event.target.value })} />
              </label>
            </div>
            <footer>
              <button type="button" className="dangerAction" onClick={() => editingOrder && cancelOrder(editingOrder)}>Marcar cancelado</button>
              <button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar financeiro"}</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function PlatformBillingPage({
  session,
  companyId,
  companies,
  onCompanyChange,
  showAllInvoices = false
}: {
  session: Session;
  companyId: string;
  companies: Record<string, unknown>[];
  onCompanyChange?: (companyId: string) => void;
  showAllInvoices?: boolean;
}) {
  const isSuperAdmin = session.user.role === "super_admin";
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [planForm, setPlanForm] = useState<Record<string, string>>({
    name: "",
    price: "",
    billingCycle: "monthly",
    description: "",
    maxUsers: "",
    maxWhatsapp: ""
  });
  const [subscriptionForm, setSubscriptionForm] = useState<Record<string, string>>({
    planId: "",
    status: "active",
    nextDueDate: "",
    paymentMethodPreference: "pix",
    notes: ""
  });
  const [invoiceForm, setInvoiceForm] = useState<Record<string, string>>({
    detail: "",
    value: "",
    dueDate: dateInput(new Date()),
    paymentMethod: "pix"
  });

  async function loadBilling() {
    setError("");
    try {
      const [loadedPlans, loadedSubscription, loadedInvoices] = await Promise.all([
        api(session, "/api/billing/plans"),
        api(session, `/api/billing/my-subscription?companyId=${companyId}`).catch(() => null),
        api(session, `/api/billing/my-invoices?companyId=${companyId}`)
      ]);
      setPlans(loadedPlans);
      setSubscription(loadedSubscription);
      setInvoices(loadedInvoices);
      if (loadedSubscription) {
        setSubscriptionForm({
          planId: String(loadedSubscription.planId || ""),
          status: String(loadedSubscription.status || "active"),
          nextDueDate: dateInput(loadedSubscription.nextDueDate),
          paymentMethodPreference: String(loadedSubscription.paymentMethodPreference || "pix"),
          notes: String(loadedSubscription.notes || "")
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cobrancas");
    }
  }

  useEffect(() => {
    void loadBilling();
  }, [session.token, companyId]);

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    setSaving("plan");
    setError("");
    try {
      await api(session, "/api/billing/plans", {
        method: "POST",
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description,
          price: Number(planForm.price || 0),
          billingCycle: planForm.billingCycle,
          maxUsers: planForm.maxUsers ? Number(planForm.maxUsers) : null,
          maxWhatsapp: planForm.maxWhatsapp ? Number(planForm.maxWhatsapp) : null,
          active: true
        })
      });
      setPlanForm({ name: "", price: "", billingCycle: "monthly", description: "", maxUsers: "", maxWhatsapp: "" });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar plano");
    } finally {
      setSaving("");
    }
  }

  async function saveSubscription(event: React.FormEvent) {
    event.preventDefault();
    setSaving("subscription");
    setError("");
    try {
      await api(session, "/api/billing/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          planId: subscriptionForm.planId || null,
          status: subscriptionForm.status,
          nextDueDate: subscriptionForm.nextDueDate || null,
          paymentMethodPreference: subscriptionForm.paymentMethodPreference || null,
          notes: subscriptionForm.notes
        })
      });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar assinatura");
    } finally {
      setSaving("");
    }
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    setSaving("invoice");
    setError("");
    try {
      await api(session, "/api/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          detail: invoiceForm.detail,
          value: Number(invoiceForm.value || 0),
          dueDate: invoiceForm.dueDate,
          paymentMethod: invoiceForm.paymentMethod || null
        })
      });
      setInvoiceForm({ detail: "", value: "", dueDate: dateInput(new Date()), paymentMethod: "pix" });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar fatura");
    } finally {
      setSaving("");
    }
  }

  async function invoiceAction(invoice: Record<string, unknown>, action: "pix" | "paid" | "boleto" | "cancel" | "refresh") {
    if (action === "cancel" && !window.confirm("Cancelar este boleto tambem na Efi? Esta acao nao deve ser usada em boleto ja pago.")) return;
    setSaving(String(invoice.id));
    setError("");
    const path =
      action === "paid"
        ? `/api/billing/invoices/${invoice.id}/mark-paid`
        : action === "refresh"
          ? `/api/billing/invoices/${invoice.id}/refresh-boleto`
        : action === "cancel"
          ? `/api/billing/invoices/${invoice.id}/cancel-boleto`
        : action === "boleto"
          ? isSuperAdmin
            ? `/api/billing/invoices/${invoice.id}/generate-boleto`
            : `/api/billing/my-invoices/${invoice.id}/pay-boleto`
          : isSuperAdmin
            ? `/api/billing/invoices/${invoice.id}/generate-pix`
            : `/api/billing/my-invoices/${invoice.id}/pay-pix`;
    try {
      const updatedInvoice = await api(session, path, { method: "POST", body: JSON.stringify({}) });
      if (updatedInvoice?.id) {
        setInvoices(current => current.map(item => String(item.id) === String(updatedInvoice.id) ? updatedInvoice : item));
      }
      await loadBilling();
      if (["boleto", "pix", "refresh"].includes(action)) {
        await new Promise(resolve => window.setTimeout(resolve, 700));
        await loadBilling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar fatura");
    } finally {
      setSaving("");
    }
  }

  async function releaseCompany() {
    if (!window.confirm("Liberar o acesso desta empresa mesmo com cobranca em aberto?")) return;
    setSaving("release");
    setError("");
    try {
      await api(session, `/api/billing/subscriptions/${companyId}/release`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao liberar empresa");
    } finally {
      setSaving("");
    }
  }

  const openInvoices = invoices.filter(invoice => !["paid", "canceled"].includes(String(invoice.status)));
  const paidInvoices = invoices.filter(invoice => String(invoice.status) === "paid");
  const visibleInvoices = isSuperAdmin && showAllInvoices
    ? invoices
    : invoices.filter(invoice => ["open", "pending", "overdue"].includes(String(invoice.status)));
  const openTotal = openInvoices.reduce((sum, invoice) => sum + Number(invoice.value || 0), 0);
  const paidTotal = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.value || 0), 0);
  const currentPlan = subscription?.plan as Record<string, unknown> | undefined;

  return (
    <section className="restaurantPage billingPage">
      <header className="restaurantSectionHeader">
        <div>
          <h2>Cobrancas da plataforma</h2>
          <p>Planos, assinatura e faturas do SaaS. O financeiro diario da loja continua separado.</p>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {isSuperAdmin && ["past_due", "suspended", "canceled"].includes(String(subscription?.status || "")) && (
        <section className="downloadPanel">
          <div>
            <strong>Empresa bloqueada por cobranca</strong>
            <span>Use a liberacao manual quando houver acordo, comprovante ou excecao de suporte.</span>
          </div>
          <button type="button" onClick={releaseCompany} disabled={saving === "release"}>
            {saving === "release" ? "Liberando..." : "Liberar acesso"}
          </button>
        </section>
      )}
      <div className="financeGrid">
        <article><span>Plano atual</span><strong>{String(currentPlan?.name || "Sem plano")}</strong></article>
        <article><span>Status</span><strong>{String(subscription?.status || "sem assinatura")}</strong></article>
        <article><span>Em aberto</span><strong>{money(openTotal)}</strong></article>
        <article><span>Pago</span><strong>{money(paidTotal)}</strong></article>
      </div>

      {isSuperAdmin && (
        <section className="billingAdminGrid">
          <form className="paymentPanel billingForm" onSubmit={createPlan}>
            <h3>Novo plano</h3>
            <label>Nome<input value={planForm.name} onChange={event => setPlanForm({ ...planForm, name: event.target.value })} /></label>
            <label>Valor<input type="number" step="0.01" value={planForm.price} onChange={event => setPlanForm({ ...planForm, price: event.target.value })} /></label>
            <label>Ciclo
              <select value={planForm.billingCycle} onChange={event => setPlanForm({ ...planForm, billingCycle: event.target.value })}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </select>
            </label>
            <label>Usuarios<input type="number" value={planForm.maxUsers} onChange={event => setPlanForm({ ...planForm, maxUsers: event.target.value })} /></label>
            <label>WhatsApps<input type="number" value={planForm.maxWhatsapp} onChange={event => setPlanForm({ ...planForm, maxWhatsapp: event.target.value })} /></label>
            <label className="wideField">Descricao<textarea value={planForm.description} onChange={event => setPlanForm({ ...planForm, description: event.target.value })} /></label>
            <button type="submit" disabled={saving === "plan"}>{saving === "plan" ? "Salvando..." : "Criar plano"}</button>
          </form>

          <form className="paymentPanel billingForm" onSubmit={saveSubscription}>
            <h3>Assinatura da empresa</h3>
            <label>Empresa
              <select value={companyId} onChange={event => onCompanyChange?.(event.target.value)} disabled={!onCompanyChange}>
                {companies.map(company => <option key={String(company.id)} value={String(company.id)}>{String(company.name)}</option>)}
              </select>
            </label>
            <label>Plano
              <select value={subscriptionForm.planId} onChange={event => setSubscriptionForm({ ...subscriptionForm, planId: event.target.value })}>
                <option value="">Sem plano</option>
                {plans.map(plan => <option key={String(plan.id)} value={String(plan.id)}>{String(plan.name)} - {money(plan.price)}</option>)}
              </select>
            </label>
            <label>Status
              <select value={subscriptionForm.status} onChange={event => setSubscriptionForm({ ...subscriptionForm, status: event.target.value })}>
                <option value="trialing">Teste</option>
                <option value="active">Ativa</option>
                <option value="past_due">Em atraso</option>
                <option value="suspended">Suspensa</option>
                <option value="canceled">Cancelada</option>
              </select>
            </label>
            <label>Proximo vencimento<input type="date" value={subscriptionForm.nextDueDate} onChange={event => setSubscriptionForm({ ...subscriptionForm, nextDueDate: event.target.value })} /></label>
            <label>Pagamento
              <select value={subscriptionForm.paymentMethodPreference} onChange={event => setSubscriptionForm({ ...subscriptionForm, paymentMethodPreference: event.target.value })}>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="wideField">Notas<textarea value={subscriptionForm.notes} onChange={event => setSubscriptionForm({ ...subscriptionForm, notes: event.target.value })} /></label>
            <button type="submit" disabled={saving === "subscription"}>{saving === "subscription" ? "Salvando..." : "Salvar assinatura"}</button>
          </form>

          <form className="paymentPanel billingForm" onSubmit={createInvoice}>
            <h3>Nova fatura</h3>
            <label>Descricao<input value={invoiceForm.detail} onChange={event => setInvoiceForm({ ...invoiceForm, detail: event.target.value })} placeholder="Assinatura mensal" /></label>
            <label>Valor<input type="number" step="0.01" value={invoiceForm.value} onChange={event => setInvoiceForm({ ...invoiceForm, value: event.target.value })} /></label>
            <label>Vencimento<input type="date" value={invoiceForm.dueDate} onChange={event => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} /></label>
            <label>Metodo
              <select value={invoiceForm.paymentMethod} onChange={event => setInvoiceForm({ ...invoiceForm, paymentMethod: event.target.value })}>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <button type="submit" disabled={saving === "invoice"}>{saving === "invoice" ? "Criando..." : "Criar fatura"}</button>
          </form>
        </section>
      )}

      <section className="paymentPanel billingInvoices">
        <h3>{isSuperAdmin ? "Faturas" : "Cobranca em aberto"}</h3>
        {visibleInvoices.length === 0 ? (
          <p>{isSuperAdmin ? "Nenhuma fatura cadastrada para esta empresa." : "Nao ha cobranca em aberto no momento."}</p>
        ) : (
          visibleInvoices.map(invoice => {
            const paymentUrl = String(invoice.paymentUrl || "");
            const boletoPdfUrl = String(invoice.boletoPdfUrl || "");
            const invoiceStatus = String(invoice.status);
            const canGeneratePayment = !["paid", "canceled", "expired", "failed"].includes(invoiceStatus);
            const hasActiveBoleto =
              canGeneratePayment &&
              String(invoice.paymentMethod || "") === "boleto" &&
              Boolean(invoice.providerChargeId);
            const canGeneratePix = canGeneratePayment && !hasActiveBoleto;
            const canCancelBoleto =
              isSuperAdmin &&
              ["open", "pending", "overdue"].includes(invoiceStatus) &&
              hasActiveBoleto;
            return (
            <article className="billingInvoiceRow" key={String(invoice.id)}>
              <div className="billingInvoiceSummary">
                <strong>{String(invoice.detail || "Fatura")}</strong>
                <span>Vencimento {new Date(String(invoice.dueDate)).toLocaleDateString("pt-BR")} - {String(invoice.status)}</span>
              </div>
              <div className="billingInvoiceValue">
                <span>Valor</span>
                <strong>{money(invoice.value)}</strong>
              </div>
              {Boolean(invoice.pixCopyPaste) && (
                <label className="pixCopyField pixCopy">
                  Pix copia e cola
                  <textarea readOnly value={String(invoice.pixCopyPaste)} />
                </label>
              )}
              {Boolean(invoice.boletoBarcode) && (
                <label className="pixCopyField boletoCopy">
                  Codigo do boleto
                  <textarea readOnly value={String(invoice.boletoBarcode)} />
                </label>
              )}
              {Boolean(paymentUrl || boletoPdfUrl) && (
                <div className="billingInvoiceLinks">
                  {Boolean(paymentUrl) && <a href={paymentUrl} target="_blank" rel="noreferrer">Abrir cobranca</a>}
                  {Boolean(boletoPdfUrl) && <a href={boletoPdfUrl} target="_blank" rel="noreferrer">PDF boleto</a>}
                </div>
              )}
              {Boolean(invoice.pixQrCodeImage) ? (
                <img className="pixQrImage" src={String(invoice.pixQrCodeImage)} alt="QR Code Pix" />
              ) : (
                <div className="pixQrPlaceholder" />
              )}
              <div className="financialOrderActions">
                {canGeneratePix && <button type="button" onClick={() => invoiceAction(invoice, "pix")} disabled={saving === String(invoice.id)}>Gerar Pix</button>}
                {canGeneratePayment && !hasActiveBoleto && <button type="button" onClick={() => invoiceAction(invoice, "boleto")} disabled={saving === String(invoice.id)}>Gerar boleto</button>}
                {isSuperAdmin && hasActiveBoleto && <button type="button" onClick={() => invoiceAction(invoice, "refresh")} disabled={saving === String(invoice.id)}>Atualizar boleto</button>}
                {canCancelBoleto && <button type="button" className="dangerAction" onClick={() => invoiceAction(invoice, "cancel")} disabled={saving === String(invoice.id)}>Cancelar boleto</button>}
                {isSuperAdmin && canGeneratePayment && <button type="button" onClick={() => invoiceAction(invoice, "paid")} disabled={saving === String(invoice.id)}>Marcar pago</button>}
              </div>
            </article>
          );
        })
        )}
      </section>
    </section>
  );
}

function BillingGatewayConfigPanel({ session }: { session: Session }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    environment: "homologation",
    clientId: "",
    clientSecret: "",
    pixKey: "",
    certPassphrase: "",
    certDataUrl: ""
  });

  async function loadConfig() {
    setError("");
    try {
      const data = await api(session, "/api/billing/config");
      setConfig(data);
      setForm(current => ({ ...current, environment: String(data.env || "homologation") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configuracao Efí");
    }
  }

  useEffect(() => {
    void loadConfig();
  }, [session.token]);

  async function runCycle() {
    setRunning(true);
    setResult("");
    setError("");
    try {
      const data = await api(session, "/api/billing/run-cycle", { method: "POST", body: JSON.stringify({}) });
      setResult(`Faturas criadas: ${data.createdInvoices || 0}. Marcadas em atraso: ${data.markedOverdue || 0}. Empresas bloqueadas: ${data.blockedCompanies || 0}.`);
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao rodar ciclo de cobranca");
    } finally {
      setRunning(false);
    }
  }

  async function saveConfig(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setResult("");
    setError("");
    try {
      const response = await api(session, "/api/billing/config", {
        method: "PUT",
        body: JSON.stringify({ ...form, active: true })
      });
      setConfig(response.config);
      setForm(current => ({ ...current, clientSecret: "", certPassphrase: "", certDataUrl: "" }));
      setResult("Configuracao Efi salva com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuracao Efi");
    } finally {
      setSaving(false);
    }
  }

  async function selectCert(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm(current => ({ ...current, certDataUrl: dataUrl }));
    } catch {
      setError("Erro ao ler certificado.");
    }
  }

  const env = String(config?.env || "homologation");
  const activeConfig = (config?.[env] || {}) as Record<string, unknown>;

  return (
    <section className="restaurantPage billingPage">
      <header className="restaurantSectionHeader">
        <div>
          <h2>Config Efí e automacao</h2>
          <p>Configure aqui a API Efi usada para Pix da plataforma. Segredos salvos nao sao exibidos novamente.</p>
        </div>
        <button type="button" onClick={runCycle} disabled={running}>{running ? "Rodando..." : "Rodar cobranca agora"}</button>
      </header>
      {error && <div className="error">{error}</div>}
      {result && <div className="success">{result}</div>}
      <div className="financeGrid">
        <article><span>Ambiente Efí</span><strong>{env === "production" ? "Producao" : "Homologacao"}</strong></article>
        <article><span>Automacao</span><strong>{config?.automationEnabled === false ? "Desligada" : "Ligada"}</strong></article>
        <article><span>Gerar antes</span><strong>{String(config?.generateDaysAhead ?? 0)} dias</strong></article>
        <article><span>Carencia</span><strong>{String(config?.graceDays ?? 3)} dias</strong></article>
      </div>
      <section className="billingAdminGrid">
        <form className="paymentPanel billingForm" onSubmit={saveConfig}>
          <h3>Salvar configuracao Efi</h3>
          <label>Ambiente
            <select value={form.environment} onChange={event => setForm({ ...form, environment: event.target.value })}>
              <option value="homologation">Homologacao</option>
              <option value="production">Producao</option>
            </select>
          </label>
          <label>Client ID
            <input value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value })} />
          </label>
          <label>Client Secret
            <input type="password" value={form.clientSecret} onChange={event => setForm({ ...form, clientSecret: event.target.value })} placeholder="Preencha para alterar" />
          </label>
          <label>Chave Pix
            <input value={form.pixKey} onChange={event => setForm({ ...form, pixKey: event.target.value })} />
          </label>
          <label>Senha do certificado
            <input type="password" value={form.certPassphrase} onChange={event => setForm({ ...form, certPassphrase: event.target.value })} placeholder="Opcional" />
          </label>
          <label>Certificado .p12
            <input type="file" accept=".p12,.pem,application/x-pkcs12" onChange={event => void selectCert(event.target.files?.[0])} />
          </label>
          <button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar Efi"}</button>
        </form>
        <article className="paymentPanel">
          <h3>Ambiente ativo</h3>
          <div className="paymentRow"><span>Client ID</span><strong>{activeConfig.clientIdConfigured ? "OK" : "Falta"}</strong></div>
          <div className="paymentRow"><span>Client Secret</span><strong>{activeConfig.clientSecretConfigured ? "OK" : "Falta"}</strong></div>
          <div className="paymentRow"><span>Chave Pix</span><strong>{activeConfig.pixKeyConfigured ? "OK" : "Falta"}</strong></div>
          <div className="paymentRow"><span>Certificado</span><strong>{activeConfig.certExists ? "OK" : "Nao encontrado"}</strong></div>
        </article>
        <article className="paymentPanel">
          <h3>Caminho do certificado</h3>
          <code>{String(activeConfig.certPath || "Configure EFI_CERT_PATH_* no .env")}</code>
        </article>
        <article className="paymentPanel">
          <h3>Como funciona</h3>
          <p>Defina plano, assinatura e vencimento. O sistema cria a fatura no vencimento, reconhece Pix pelo webhook Efí e bloqueia a empresa quando houver fatura vencida apos a carencia.</p>
        </article>
      </section>
    </section>
  );
}

const masterDefaultOrderMessages = {
  orderAcceptedMessageTemplate: [
    "Perfeito, {primeiro_nome}! Pedido {pedido} aceito pela {empresa}.",
    "",
    "{itens}",
    "",
    "Total: {total}",
    "Pagamento: {pagamento}",
    "{destino}",
    "",
    "{proximo_passo}"
  ].join("\n"),
  orderOutForDeliveryMessageTemplate: "Boa noticia! O pedido {pedido} saiu para entrega e esta a caminho.",
  orderReadyMessageTemplate: "Tudo certo! O pedido {pedido} esta pronto."
};

const masterDefaultBotMessages = {
  greetingMessage: "Ola! Como posso ajudar?",
  outOfHoursMessage: "No momento estamos fechados. Assim que abrirmos, seguimos seu atendimento.",
  humanHandoffMessage: "Vou chamar um atendente humano para continuar com voce."
};

const masterCompanyGroups = [
  {
    title: "Identidade da empresa",
    fields: ["name", "slug", "segment", "logoUrl", "document", "phone", "whatsapp", "email", "address", "city", "state", "zipCode", "active"]
  },
  {
    title: "Operacao",
    fields: ["plan", "botEnabled", "acceptOrders", "allowDelivery", "allowPickup", "deliveryFeeDefault", "minimumOrderValue", "preparationTimeMinutes", "autoAcceptOrders"]
  },
  {
    title: "Cobranca",
    fields: ["billingName", "billingDocument", "billingEmail", "billingPhone", "billingStreet", "billingNumber", "billingNeighborhood", "billingComplement", "billingCity", "billingState", "billingZipCode"]
  },
  {
    title: "Integracoes",
    fields: ["ticketzBaseUrl", "ticketzCompanyId", "ticketzWhatsappId", "ticketzQueueId", "ticketzApiToken", "n8nWebhookUrl", "webhookSecret"]
  }
];

const masterAutomationFields = [
  "greetingMessage",
  "outOfHoursMessage",
  "humanHandoffMessage",
  "orderAcceptedMessageTemplate",
  "orderOutForDeliveryMessageTemplate",
  "orderReadyMessageTemplate"
];

const masterAdminFields = ["adminName", "adminEmail", "adminPassword", "adminPhone"];

const masterLabels: Record<string, string> = {
  name: "Nome da empresa",
  slug: "Slug publico",
  segment: "Segmento",
  logoUrl: "Logo da empresa",
  document: "CPF/CNPJ",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  address: "Endereco",
  city: "Cidade",
  state: "UF",
  zipCode: "CEP",
  active: "Empresa ativa",
  plan: "Plano interno",
  botEnabled: "IA/bot ativo",
  acceptOrders: "Loja aberta para pedidos",
  allowDelivery: "Permite entrega",
  allowPickup: "Permite retirada",
  deliveryFeeDefault: "Taxa de entrega padrao",
  minimumOrderValue: "Pedido minimo",
  preparationTimeMinutes: "Tempo medio de preparo",
  autoAcceptOrders: "Aceitar pedidos automaticamente",
  billingName: "Nome/Razao social",
  billingDocument: "CPF/CNPJ do pagador",
  billingEmail: "E-mail de cobranca",
  billingPhone: "Telefone de cobranca",
  billingStreet: "Rua",
  billingNumber: "Numero",
  billingNeighborhood: "Bairro",
  billingComplement: "Complemento",
  billingCity: "Cidade",
  billingState: "UF",
  billingZipCode: "CEP",
  ticketzBaseUrl: "URL Ticketz",
  ticketzCompanyId: "Empresa Ticketz",
  ticketzWhatsappId: "WhatsApp Ticketz",
  ticketzQueueId: "Fila Ticketz",
  ticketzApiToken: "Token Ticketz",
  n8nWebhookUrl: "Webhook n8n",
  webhookSecret: "Segredo do webhook",
  greetingMessage: "Mensagem de boas-vindas",
  outOfHoursMessage: "Mensagem de loja fechada",
  humanHandoffMessage: "Mensagem ao chamar humano",
  orderAcceptedMessageTemplate: "Pedido aceito",
  orderOutForDeliveryMessageTemplate: "Saiu para entrega",
  orderReadyMessageTemplate: "Pedido pronto",
  adminName: "Nome do admin",
  adminEmail: "E-mail do admin",
  adminPassword: "Senha inicial",
  adminPhone: "Telefone do admin"
};

const masterCompanyFields = masterCompanyGroups.flatMap(group => group.fields);
const masterSettingsFields = ["acceptOrders", "allowDelivery", "allowPickup", "deliveryFeeDefault", "minimumOrderValue", "preparationTimeMinutes", "autoAcceptOrders", "orderAcceptedMessageTemplate", "orderOutForDeliveryMessageTemplate", "orderReadyMessageTemplate"];
const masterBotSettingsFields = ["greetingMessage", "outOfHoursMessage", "humanHandoffMessage"];
const masterBooleanFormFields = new Set(["active", "botEnabled", "acceptOrders", "allowDelivery", "allowPickup", "autoAcceptOrders"]);
const masterNumberFormFields = new Set(["deliveryFeeDefault", "minimumOrderValue", "preparationTimeMinutes"]);
const masterTextareaFields = new Set(["address", "n8nWebhookUrl", "webhookSecret", "orderAcceptedMessageTemplate", "orderOutForDeliveryMessageTemplate", "orderReadyMessageTemplate", "greetingMessage", "outOfHoursMessage", "humanHandoffMessage"]);
const masterSecretFields = new Set(["ticketzApiToken", "webhookSecret", "adminPassword"]);

function formBool(value: unknown, fallback = true) {
  return value === undefined || value === null ? String(fallback) : String(value !== false);
}

function masterCompanyInitialForm(company?: Record<string, unknown> | null) {
  const settings = company?.settings as Record<string, unknown> | undefined;
  const botSettings = company?.botSettings as Record<string, unknown> | undefined;
  return {
    name: String(company?.name || ""),
    slug: String(company?.slug || ""),
    segment: String(company?.segment || "restaurant"),
    logoUrl: String(company?.logoUrl || ""),
    document: String(company?.document || ""),
    phone: String(company?.phone || ""),
    whatsapp: String(company?.whatsapp || ""),
    email: String(company?.email || ""),
    address: String(company?.address || ""),
    city: String(company?.city || ""),
    state: String(company?.state || ""),
    zipCode: String(company?.zipCode || ""),
    active: formBool(company?.active, true),
    plan: String(company?.plan || "starter"),
    botEnabled: formBool(company?.botEnabled, true),
    acceptOrders: formBool(settings?.acceptOrders, true),
    allowDelivery: formBool(settings?.allowDelivery, true),
    allowPickup: formBool(settings?.allowPickup, true),
    deliveryFeeDefault: String(settings?.deliveryFeeDefault ?? "0"),
    minimumOrderValue: String(settings?.minimumOrderValue ?? "0"),
    preparationTimeMinutes: String(settings?.preparationTimeMinutes ?? "30"),
    autoAcceptOrders: formBool(settings?.autoAcceptOrders, false),
    billingName: String(company?.billingName || ""),
    billingDocument: String(company?.billingDocument || ""),
    billingEmail: String(company?.billingEmail || ""),
    billingPhone: String(company?.billingPhone || ""),
    billingStreet: String(company?.billingStreet || ""),
    billingNumber: String(company?.billingNumber || ""),
    billingNeighborhood: String(company?.billingNeighborhood || ""),
    billingComplement: String(company?.billingComplement || ""),
    billingCity: String(company?.billingCity || ""),
    billingState: String(company?.billingState || ""),
    billingZipCode: String(company?.billingZipCode || ""),
    ticketzBaseUrl: String(company?.ticketzBaseUrl || ""),
    ticketzCompanyId: String(company?.ticketzCompanyId || ""),
    ticketzWhatsappId: String(company?.ticketzWhatsappId || ""),
    ticketzQueueId: String(company?.ticketzQueueId || ""),
    ticketzApiToken: "",
    n8nWebhookUrl: String(company?.n8nWebhookUrl || ""),
    webhookSecret: String(company?.webhookSecret || ""),
    greetingMessage: String(botSettings?.greetingMessage || masterDefaultBotMessages.greetingMessage),
    outOfHoursMessage: String(botSettings?.outOfHoursMessage || masterDefaultBotMessages.outOfHoursMessage),
    humanHandoffMessage: String(botSettings?.humanHandoffMessage || masterDefaultBotMessages.humanHandoffMessage),
    orderAcceptedMessageTemplate: String(settings?.orderAcceptedMessageTemplate || masterDefaultOrderMessages.orderAcceptedMessageTemplate),
    orderOutForDeliveryMessageTemplate: String(settings?.orderOutForDeliveryMessageTemplate || masterDefaultOrderMessages.orderOutForDeliveryMessageTemplate),
    orderReadyMessageTemplate: String(settings?.orderReadyMessageTemplate || masterDefaultOrderMessages.orderReadyMessageTemplate),
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: ""
  };
}

function buildMasterCompanyPayload(form: Record<string, string>, includeAdmin: boolean) {
  const payload: Record<string, unknown> = {};
  const settings: Record<string, unknown> = {};
  const botSettings: Record<string, unknown> = {};

  for (const field of masterCompanyFields) {
    if (masterSettingsFields.includes(field)) continue;
    const value = form[field];
    if (value === "") continue;
    payload[field] = masterBooleanFormFields.has(field) ? value === "true" : value;
  }

  for (const field of masterSettingsFields) {
    const value = form[field];
    if (value === "") continue;
    settings[field] = masterBooleanFormFields.has(field) ? value === "true" : masterNumberFormFields.has(field) ? Number(value) : value;
  }

  for (const field of masterBotSettingsFields) {
    const value = form[field];
    if (value === "") continue;
    botSettings[field] = value;
  }

  payload.settings = settings;
  payload.botSettings = botSettings;

  if (includeAdmin && form.adminEmail.trim()) {
    payload.adminUser = {
      name: form.adminName.trim() || form.name.trim(),
      email: form.adminEmail.trim(),
      password: form.adminPassword.trim(),
      phone: form.adminPhone.trim() || undefined
    };
  }

  return payload;
}

function MasterCompanyEditor({
  session,
  company,
  onSaved,
  onCancel
}: {
  session: Session;
  company: Record<string, unknown> | null;
  onSaved: (company: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => masterCompanyInitialForm(company));
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const editing = Boolean(company?.id);

  useEffect(() => {
    setForm(masterCompanyInitialForm(company));
    setPendingLogo(null);
    setError("");
    setSuccess("");
  }, [company?.id]);

  function updateField(field: string, value: string) {
    setForm(current => ({
      ...current,
      [field]: value,
      ...(field === "name" && !editing && !current.slug
        ? { slug: value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) }
        : {})
    }));
  }

  async function uploadLogo(companyId: string, file: File) {
    const dataUrl = await fileToDataUrl(file);
    const result = await api(session, "/api/uploads/images", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        fileName: file.name,
        contentType: file.type,
        dataUrl
      })
    });
    return String(result.url || "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      let saved = await api(session, editing ? `/api/companies/${company?.id}/setup` : "/api/companies", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(buildMasterCompanyPayload(form, !editing))
      });

      if (pendingLogo) {
        const logoUrl = await uploadLogo(String(saved.id), pendingLogo);
        saved = await api(session, `/api/companies/${saved.id}/setup`, {
          method: "PUT",
          body: JSON.stringify({ logoUrl })
        });
      }

      onSaved(saved);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  }

  async function provisionIntegrations() {
    if (!company?.id) return;
    setError("");
    setSuccess("");
    setProvisioning(true);
    try {
      const result = await api(session, `/api/companies/${company.id}/provision-integrations`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (result.company) onSaved(result.company);
      const n8nStatus = result.n8n?.created ? "n8n criado" : `n8n pendente: ${result.n8n?.reason || result.n8n?.error || "verifique a API key"}`;
      setSuccess(`Ticketz provisionado. ${n8nStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao provisionar integracoes");
    } finally {
      setProvisioning(false);
    }
  }

  function renderField(field: string) {
    const value = form[field] || "";
    const label = masterLabels[field] || field;
    const className = masterTextareaFields.has(field) || field === "logoUrl" ? "wideField" : undefined;

    if (field === "active" || field === "botEnabled" || masterBooleanFormFields.has(field)) {
      return (
        <label key={field} className={className}>
          {label}
          <select value={value} onChange={event => updateField(field, event.target.value)}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        </label>
      );
    }

    if (field === "segment") {
      return (
        <label key={field}>
          {label}
          <select value={value || "restaurant"} onChange={event => updateField(field, event.target.value)}>
            <option value="restaurant">Restaurante</option>
            <option value="barbershop">Barbearia</option>
            <option value="generic">Generico</option>
          </select>
        </label>
      );
    }

    if (field === "logoUrl") {
      return (
        <label key={field} className="wideField logoField">
          {label}
          <input value={value} onChange={event => updateField(field, event.target.value)} placeholder="URL da logo ou envie um arquivo" />
          <span className="logoUploadInline">
            <Upload />
            <input type="file" accept="image/*" onChange={event => setPendingLogo(event.target.files?.[0] || null)} />
            {pendingLogo ? pendingLogo.name : "Enviar logo"}
          </span>
        </label>
      );
    }

    if (masterTextareaFields.has(field)) {
      return (
        <label key={field} className={className}>
          {label}
          <textarea value={value} onChange={event => updateField(field, event.target.value)} />
        </label>
      );
    }

    return (
      <label key={field} className={className}>
        {label}
        <input
          type={masterSecretFields.has(field) ? "password" : masterNumberFormFields.has(field) ? "number" : "text"}
          step={masterNumberFormFields.has(field) ? "0.01" : undefined}
          value={value}
          onChange={event => updateField(field, event.target.value)}
        />
      </label>
    );
  }

  return (
    <form className="editor masterCompanyEditor" onSubmit={submit}>
      <header className="masterCompanyEditorHeader">
        <div>
          <h2>{editing ? "Editar empresa" : "Nova empresa"}</h2>
          <p>Cadastre dados, logo, integracoes, mensagens automaticas e o admin inicial da empresa.</p>
        </div>
        <button type="button" className="ghostButton" onClick={onCancel}>Cancelar</button>
      </header>

      <div className="companyPreview wideField">
        <CompanyMark company={{ ...company, name: form.name, logoUrl: form.logoUrl }} />
        <div>
          <strong>{form.name || "Nova empresa"}</strong>
          <span>{form.slug || "slug-publico"}</span>
        </div>
      </div>

      {masterCompanyGroups.map(group => (
        <fieldset className="settingsGroup" key={group.title}>
          <legend>{group.title}</legend>
          {group.fields.map(renderField)}
        </fieldset>
      ))}

      <fieldset className="settingsGroup automationGroup">
        <legend>Mensagens automaticas</legend>
        {masterAutomationFields.map(renderField)}
      </fieldset>

      {!editing && (
        <fieldset className="settingsGroup">
          <legend>Usuario admin da empresa</legend>
          {masterAdminFields.map(renderField)}
        </fieldset>
      )}

      {error && <div className="error wideField">{error}</div>}
      {success && <div className="successNote wideField">{success}</div>}
      <div className="formActions wideField">
        <button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar empresa" : "Criar empresa"}</button>
        {editing && (
          <button type="button" className="ghostButton" onClick={provisionIntegrations} disabled={provisioning}>
            {provisioning ? "Provisionando..." : "Provisionar Ticketz/n8n"}
          </button>
        )}
        <button type="button" className="ghostButton" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function MasterPanel({
  session,
  companies,
  selectedCompanyId,
  onCompanyChange,
  onConnectCompany,
  onCompanySaved,
  onLogout
}: {
  session: Session;
  companies: Record<string, unknown>[];
  selectedCompanyId: string | null;
  onCompanyChange: (companyId: string) => void;
  onConnectCompany: (companyId: string) => void;
  onCompanySaved: (company: Record<string, unknown>) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<MasterTab>(() => adminLocation().masterTab || "companies");
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [editingCompany, setEditingCompany] = useState<Record<string, unknown> | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const selectedCompany = companies.find(company => String(company.id) === selectedCompanyId) || companies[0];
  const safeCompanyId = selectedCompany ? String(selectedCompany.id) : null;

  function selectTab(nextTab: MasterTab) {
    setTab(nextTab);
    updateAdminLocation({ adminMode: "master", masterTab: nextTab, view: null });
  }

  useEffect(() => {
    updateAdminLocation({ adminMode: "master", masterTab: tab, company: safeCompanyId, view: null });
  }, [tab, safeCompanyId]);

  useEffect(() => {
    if (session.user.role !== "super_admin") return;
    Promise.all([
      api(session, "/api/billing/plans").catch(() => []),
      api(session, "/api/billing/subscriptions").catch(() => []),
      api(session, "/api/billing/invoices").catch(() => [])
    ]).then(([loadedPlans, loadedSubscriptions, loadedInvoices]) => {
      setPlans(loadedPlans);
      setSubscriptions(loadedSubscriptions);
      setInvoices(loadedInvoices);
    });
  }, [session.token]);

  const openInvoices = invoices.filter(invoice => !["paid", "canceled"].includes(String(invoice.status)));
  const openTotal = openInvoices.reduce((sum, invoice) => sum + Number(invoice.value || 0), 0);
  const activeSubscriptions = subscriptions.filter(subscription => String(subscription.status) === "active").length;

  return (
    <main className="masterShell">
      <aside className="masterSidebar">
        <div className="masterBrand">
          <img src="/vib-favicon.png" alt="" aria-hidden="true" />
          <div>
            <strong>VIB</strong>
            <span>Plataforma master</span>
          </div>
        </div>
        <nav>
          <button type="button" className={tab === "companies" ? "active" : ""} onClick={() => selectTab("companies")}>
            <Building2 /> Empresas
          </button>
          <button type="button" className={tab === "billing" ? "active" : ""} onClick={() => selectTab("billing")}>
            <FileText /> Cobrancas
          </button>
          <button type="button" className={tab === "config" ? "active" : ""} onClick={() => selectTab("config")}>
            <Settings /> Config Efí
          </button>
        </nav>
        <button type="button" className="masterLogout" onClick={onLogout}><LogOut /> Sair</button>
      </aside>
      <section className="masterMain">
        <header className="masterTopbar">
          <div>
            <span>Master</span>
            <h1>{tab === "companies" ? "Empresas" : tab === "billing" ? "Cobrancas da plataforma" : "Config Efí"}</h1>
          </div>
          <label>
            Empresa em contexto
            <select value={safeCompanyId || ""} onChange={event => onCompanyChange(event.target.value)}>
              {companies.map(company => (
                <option key={String(company.id)} value={String(company.id)}>{String(company.name)}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="financeGrid masterMetrics">
          <article><span>Empresas</span><strong>{companies.length}</strong></article>
          <article><span>Planos</span><strong>{plans.length}</strong></article>
          <article><span>Assinaturas ativas</span><strong>{activeSubscriptions}</strong></article>
          <article><span>Em aberto</span><strong>{money(openTotal)}</strong></article>
        </div>

        {tab === "companies" && (
          <section className="masterCompanies">
            <div className="masterSectionHeader">
              <div>
                <h2>Empresas clientes</h2>
                <p>Crie empresas, configure identidade, cobranca, integracoes, mensagens automaticas e entre como suporte quando precisar.</p>
              </div>
              <button
                type="button"
                className="primaryInlineButton"
                onClick={() => {
                  setCreatingCompany(true);
                  setEditingCompany(null);
                }}
              >
                <Plus /> Nova empresa
              </button>
            </div>

            {(creatingCompany || editingCompany) && (
              <MasterCompanyEditor
                session={session}
                company={editingCompany}
                onSaved={company => {
                  onCompanySaved(company);
                  onCompanyChange(String(company.id));
                }}
                onCancel={() => {
                  setCreatingCompany(false);
                  setEditingCompany(null);
                }}
              />
            )}

            <div className="masterCompanyGrid">
              {companies.map(company => {
                const companySubscription = subscriptions.find(subscription => String(subscription.companyId) === String(company.id));
                const companyPlan = (companySubscription?.plan as Record<string, unknown> | undefined)?.name;
                const companyOpenTotal = openInvoices
                  .filter(invoice => String(invoice.companyId) === String(company.id))
                  .reduce((sum, invoice) => sum + Number(invoice.value || 0), 0);
                return (
                  <article className="masterCompanyCard" key={String(company.id)}>
                    <div className="masterCompanyTitle">
                      <CompanyMark company={company} />
                      <div>
                        <strong>{String(company.name)}</strong>
                        <span>{String(company.email || company.phone || "sem contato")}</span>
                      </div>
                    </div>
                    <dl>
                      <div><dt>Plano</dt><dd>{String(companyPlan || company.plan || "sem plano")}</dd></div>
                      <div><dt>Status</dt><dd>{company.active === false ? "Inativa" : "Ativa"}</dd></div>
                      <div><dt>Aberto</dt><dd>{money(companyOpenTotal)}</dd></div>
                    </dl>
                    <footer>
                      <button type="button" onClick={() => {
                        setCreatingCompany(false);
                        setEditingCompany(company);
                      }}>Editar</button>
                      <button type="button" onClick={() => {
                        onCompanyChange(String(company.id));
                        selectTab("billing");
                      }}>Cobrar</button>
                      <button type="button" onClick={() => onConnectCompany(String(company.id))}>Conectar como suporte</button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "billing" && safeCompanyId && (
          <PlatformBillingPage
            session={session}
            companyId={safeCompanyId}
            companies={companies}
            onCompanyChange={onCompanyChange}
            showAllInvoices
          />
        )}
        {tab === "config" && <BillingGatewayConfigPanel session={session} />}
      </section>
    </main>
  );
}

function ticketzUrlForCompany(company: Record<string, unknown>) {
  return String(company.ticketzBaseUrl || TICKETZ_URL).trim().replace(/\/$/, "");
}

function contactNameCandidate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (["cliente whatsapp", "cliente", "sem nome"].includes(text.toLowerCase())) return "";

  const letters = text.replace(/[^A-Za-z\u00C0-\u00FF]/g, "");
  if (letters.length >= 2) return text;
  if (text.replace(/\D/g, "").length >= 8) return "";
  return text;
}

function displayContactName(value: unknown, fallback = "Cliente WhatsApp") {
  return contactNameCandidate(value) || fallback;
}

function firstContactName(...values: unknown[]) {
  for (const value of values) {
    const name = contactNameCandidate(value);
    if (name) return name;
  }
  return "Cliente WhatsApp";
}

function ticketCustomer(ticket: Record<string, unknown>) {
  const customer = ticket.customer as Record<string, unknown> | undefined;
  const metadata = ticket.metadata as Record<string, unknown> | undefined;
  const contact = metadata?.contact as Record<string, unknown> | undefined;
  return {
    name: firstContactName(
      customer?.name,
      contact?.pushName,
      contact?.pushname,
      contact?.profileName,
      contact?.notify,
      contact?.verifiedName,
      contact?.name,
      ticket.ticketzContactId
    ),
    phone: String(customer?.whatsapp || customer?.phone || contact?.number || contact?.phone || ""),
    avatarUrl: String(customer?.profilePicUrl || contact?.profilePicUrl || contact?.avatarUrl || "")
  };
}

function ticketInitials(ticket: Record<string, unknown>) {
  return ticketCustomer(ticket).name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "WA";
}

function TicketAvatar({ ticket, large = false }: { ticket: Record<string, unknown>; large?: boolean }) {
  const customer = ticketCustomer(ticket);
  return (
    <span className={`ticketAvatar${large ? " large" : ""}`}>
      {ticketInitials(ticket)}
      {customer.avatarUrl && (
        <img
          src={customer.avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={event => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

function chatTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function messageTypeFromMime(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "document";
  return "document";
}

function messageMedia(message: Record<string, unknown>) {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const media = metadata?.media as Record<string, unknown> | undefined;
  const rawMessage = metadata?.message as Record<string, unknown> | undefined;
  const url = String(media?.url || media?.mediaUrl || rawMessage?.mediaUrl || rawMessage?.media_url || "");
  if (!url) return null;

  const mimeType = String(media?.mimeType || rawMessage?.mimeType || rawMessage?.mimetype || "");
  const fileName = String(media?.fileName || rawMessage?.fileName || rawMessage?.filename || url.split("/").pop() || "arquivo");
  const type = String(message.messageType || rawMessage?.type || messageTypeFromMime(mimeType));
  return { url, mimeType, fileName, type };
}

function ChatMessageBubble({ message }: { message: Record<string, unknown> }) {
  const media = messageMedia(message);
  const content = String(message.content || "");
  return (
    <article className={`bubble ${String(message.direction)}`} key={String(message.id)}>
      {media?.type === "image" && <img className="chatMediaImage" src={media.url} alt={media.fileName} loading="lazy" />}
      {media?.type === "audio" && <audio className="chatMediaAudio" src={media.url} controls />}
      {media && media.type !== "image" && media.type !== "audio" && (
        <a className="chatMediaFile" href={media.url} target="_blank" rel="noreferrer">
          {media.fileName}
        </a>
      )}
      {content && <p>{content}</p>}
      <span>{chatTime(message.createdAt)}</span>
    </article>
  );
}

function ticketzResultContact(result: Record<string, unknown>) {
  const contact = result.contact as Record<string, unknown> | undefined;
  return {
    name: firstContactName(
      contact?.pushName,
      contact?.pushname,
      contact?.profileName,
      contact?.notify,
      contact?.verifiedName,
      contact?.name
    ),
    phone: String(contact?.number || contact?.phone || ""),
    avatarUrl: String(contact?.profilePicUrl || "")
  };
}

function RestaurantWhatsappPage({
  session,
  company,
  companyId
}: {
  session: Session;
  company: Record<string, unknown>;
  companyId: string;
}) {
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [connections, setConnections] = useState<Record<string, unknown>[]>([]);
  const [ticketzResults, setTicketzResults] = useState<Record<string, unknown>[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchingTicketz, setSearchingTicketz] = useState(false);
  const [syncingTicketzId, setSyncingTicketzId] = useState("");
  const [sending, setSending] = useState(false);
  const [connectionSaving, setConnectionSaving] = useState("");
  const [closingTicket, setClosingTicket] = useState(false);
  const [error, setError] = useState("");
  const [openingAdvanced, setOpeningAdvanced] = useState(false);
  const [success, setSuccess] = useState("");
  const [assistCollapsed, setAssistCollapsed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const quickEmojis = ["😀", "😂", "😍", "👍", "🙏", "❤️", "✅", "🎉", "🍕", "🍔", "📍", "🚚"];

  function openFilePicker(accept: string) {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  }

  async function toggleAudioRecording() {
    const activeRecorder = recorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador nao permite gravar audio. Voce ainda pode anexar um arquivo de audio.");
      return;
    }

    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
        .find(type => MediaRecorder.isTypeSupported(type));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          setAttachedFile(new File([blob], `audio-${Date.now()}.${extension}`, { type: mimeType }));
        }
        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingAudio(false);
      };
      recorder.onerror = () => {
        setError("Nao foi possivel concluir a gravacao do audio.");
      };
      recorder.start();
      setRecordingAudio(true);
      setEmojiOpen(false);
    } catch {
      setError("Permita o acesso ao microfone para gravar audio nesta conversa.");
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      recorderRef.current = null;
      setRecordingAudio(false);
    }
  }

  async function openAdvancedTicketz() {
    setError("");
    const advancedWindow = window.open("about:blank", "_blank");
    setOpeningAdvanced(true);
    try {
      const data = await api(session, "/api/ticketz/sso-url", {
        method: "POST",
        body: JSON.stringify({ companyId })
      });
      const url = String(data.url || "");
      if (!url) throw new Error("Nao foi possivel gerar o acesso avancado.");
      if (!advancedWindow) throw new Error("O navegador bloqueou a nova janela. Permita pop-ups para abrir o painel avancado.");
      advancedWindow.opener = null;
      advancedWindow.location.replace(url);
    } catch (err) {
      advancedWindow?.close();
      setError(err instanceof Error ? err.message : "Nao foi possivel abrir o Vib Atendimento logado.");
    } finally {
      setOpeningAdvanced(false);
    }
  }

  async function loadTickets(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoadingTickets(true);
    try {
      const data = await api(session, `/api/chat/tickets?companyId=${companyId}&status=active`);
      setTickets(data);
      setSelectedTicketId(current =>
        current && data.some((ticket: Record<string, unknown>) => String(ticket.id) === current)
          ? current
          : data.length
            ? String(data[0].id)
            : ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversas.");
    } finally {
      setLoadingTickets(false);
    }
  }

  async function loadConnections(options: { silent?: boolean } = {}) {
    try {
      const data = await api(session, `/api/resources/whatsappConnections?companyId=${companyId}`);
      setConnections(data);
    } catch (err) {
      if (!options.silent) {
        setError(err instanceof Error ? err.message : "Erro ao carregar conexao WhatsApp.");
      }
    }
  }

  async function loadMessages(ticketId = selectedTicketId, options: { silent?: boolean } = {}) {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    if (!options.silent) setLoadingMessages(true);
    try {
      const data = await api(session, `/api/chat/tickets/${ticketId}/messages`);
      setMessages(data);
      await loadTickets({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function searchTicketz(status = "all") {
    setSearchingTicketz(true);
    setError("");
    setSuccess("");
    try {
      const params = new URLSearchParams({
        companyId,
        q: search.trim(),
        status
      });
      const data = await api(session, `/api/chat/ticketz/search?${params.toString()}`);
      setTicketzResults(data);
      setSuccess(data.length ? `${data.length} conversa(s) encontrada(s) no Ticketz.` : "Nenhuma conversa encontrada no Ticketz.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar no Ticketz.");
    } finally {
      setSearchingTicketz(false);
    }
  }

  async function syncTicketzTicket(result: Record<string, unknown>) {
    const ticketzTicketId = String(result.id || "");
    if (!ticketzTicketId) return;
    setSyncingTicketzId(ticketzTicketId);
    setError("");
    setSuccess("");
    try {
      const ticket = await api(session, "/api/chat/ticketz/sync", {
        method: "POST",
        body: JSON.stringify({ companyId, ticketzTicketId })
      });
      await loadTickets({ silent: true });
      setSelectedTicketId(String(ticket.id));
      setTicketzResults([]);
      setSuccess("Conversa sincronizada e aberta no Vib.");
      await loadMessages(String(ticket.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar conversa.");
    } finally {
      setSyncingTicketzId("");
    }
  }

  useEffect(() => {
    setTickets([]);
    setMessages([]);
    setSelectedTicketId("");
    void loadTickets();
    void loadConnections();
    const interval = window.setInterval(() => void loadTickets({ silent: true }), 7000);
    const connectionInterval = window.setInterval(() => void loadConnections({ silent: true }), 10000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(connectionInterval);
    };
  }, [session.token, companyId]);

  useEffect(() => {
    if (!selectedTicketId) return;
    void loadMessages(selectedTicketId);
    const interval = window.setInterval(() => void loadMessages(selectedTicketId, { silent: true }), 5000);
    return () => window.clearInterval(interval);
  }, [selectedTicketId, session.token]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedTicketId || (!content && !attachedFile)) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      let upload: Record<string, unknown> | null = null;
      if (attachedFile) {
        const dataUrl = await fileToDataUrl(attachedFile);
        upload = await api(session, "/api/uploads/chat-files", {
          method: "POST",
          body: JSON.stringify({
            companyId,
            fileName: attachedFile.name,
            contentType: attachedFile.type || "application/octet-stream",
            dataUrl
          })
        });
      }

      const sent = await api(session, "/api/chat/send-message", {
        method: "POST",
        body: JSON.stringify({
          ticketId: selectedTicketId,
          content,
          mediaUrl: upload?.url,
          fileName: upload?.originalFileName || attachedFile?.name,
          mimeType: upload?.contentType || attachedFile?.type,
          messageType: upload ? messageTypeFromMime(String(upload.contentType || attachedFile?.type || "")) : "text"
        })
      });
      setDraft("");
      setAttachedFile(null);
      setEmojiOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const nextTicketId = String((sent.ticket as Record<string, unknown> | undefined)?.id || selectedTicketId);
      if (nextTicketId !== selectedTicketId) {
        setSelectedTicketId(nextTicketId);
      }
      setSuccess(
        nextTicketId !== selectedTicketId
          ? "Mensagem enviada no atendimento aberto correto."
          : upload
          ? "Arquivo enviado pelo WhatsApp."
          : "Mensagem enviada pelo WhatsApp."
      );
      await loadTickets({ silent: true });
      await loadMessages(nextTicketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function toggleHandoff(enabled: boolean) {
    if (!selectedTicketId) return;
    setError("");
    setSuccess("");
    try {
      await api(session, `/api/chat/tickets/${selectedTicketId}/handoff`, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      setSuccess(enabled ? "Atendimento humano assumido." : "IA reativada para esta conversa.");
      await loadTickets({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar atendimento.");
    }
  }

  async function toggleBot(enabled: boolean) {
    if (!selectedTicketId) return;
    setError("");
    setSuccess("");
    try {
      await api(session, `/api/chat/tickets/${selectedTicketId}/bot`, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      setSuccess(enabled ? "IA ligada para esta conversa." : "IA pausada para esta conversa.");
      await loadTickets({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar IA.");
    }
  }

  async function closeSelectedTicket() {
    if (!selectedTicketId || !selectedTicket) return;
    const customerName = selectedCustomer?.name || "este atendimento";
    if (!window.confirm(`Fechar atendimento de ${customerName}?`)) return;

    setClosingTicket(true);
    setError("");
    setSuccess("");
    try {
      await api(session, `/api/chat/tickets/${selectedTicketId}/close`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const nextTickets = tickets.filter(ticket => String(ticket.id) !== selectedTicketId);
      setTickets(nextTickets);
      setMessages([]);
      setSelectedTicketId(nextTickets[0] ? String(nextTickets[0].id) : "");
      setSuccess("Atendimento fechado. Ele saiu da lista principal e fica disponivel no historico.");
      await loadTickets({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar atendimento.");
    } finally {
      setClosingTicket(false);
    }
  }

  async function connectionAction(connection: Record<string, unknown>, action: "start" | "refresh" | "connected" | "disconnect" | "migrate-native") {
    const id = String(connection.id || "");
    if (!id) return;
    setConnectionSaving(action);
    setError("");
    setSuccess("");
    try {
      await api(session, `/api/whatsapp-connections/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadConnections();
      setSuccess(action === "disconnect" ? "WhatsApp desconectado." : "Conexao WhatsApp atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar conexao WhatsApp.");
    } finally {
      setConnectionSaving("");
    }
  }

  const filteredTickets = tickets.filter(ticket => {
    const customer = ticketCustomer(ticket);
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${customer.name} ${customer.phone} ${ticket.lastMessage || ""}`.toLowerCase().includes(query);
  });
  const selectedTicket = tickets.find(ticket => String(ticket.id) === selectedTicketId) || null;
  const selectedCustomer = selectedTicket ? ticketCustomer(selectedTicket) : null;
  const activeConnection =
    (connections.find(connection => connection.isDefault) || connections[0] || selectedTicket?.whatsappConnection) as Record<string, unknown> | undefined;
  const nativeConnection = String(activeConnection?.provider || "").toLowerCase() === "native";
  const activeConnectionStatus = String(activeConnection?.status || "DISCONNECTED");
  const activeConnectionQr = String(activeConnection?.qrcode || "");
  const qrImageUrl = activeConnectionQr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(activeConnectionQr)}`
    : "";
  const selectedHumanTakeover = Boolean(selectedTicket?.humanTakeover);

  return (
    <section className={`whatsappDesk${assistCollapsed ? " assistCollapsed" : ""}`}>
      <aside className="chatList">
        <header>
          <strong>Conversas</strong>
          <button type="button" onClick={() => loadTickets()}>{loadingTickets ? "..." : "Atualizar"}</button>
        </header>
        <label className="chatSearch">
          <Search />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, telefone ou mensagem" />
        </label>
        <div className="chatFilters">
          <span>{tickets.length} tickets</span>
          <span>{tickets.reduce((sum, ticket) => sum + Number(ticket.unreadMessages || 0), 0)} novas</span>
        </div>
        <div className="ticketzSearchActions">
          <button type="button" onClick={() => searchTicketz("all")} disabled={searchingTicketz}>
            {searchingTicketz ? "Buscando..." : nativeConnection ? "Buscar conversas" : "Buscar Ticketz"}
          </button>
          <button type="button" onClick={() => searchTicketz("closed")} disabled={searchingTicketz}>
            Historico
          </button>
        </div>
        {ticketzResults.length > 0 && (
          <div className="ticketzSearchResults">
            <strong>{nativeConnection ? "Conversas encontradas" : "Resultados Ticketz"}</strong>
            {ticketzResults.map(result => {
              const contact = ticketzResultContact(result);
              const pseudoTicket = {
                customer: {
                  name: contact.name,
                  phone: contact.phone,
                  profilePicUrl: contact.avatarUrl
                }
              };
              return (
                <button type="button" key={String(result.id)} onClick={() => syncTicketzTicket(result)}>
                  <TicketAvatar ticket={pseudoTicket} />
                  <div>
                    <span>{contact.name}</span>
                    <small>{String(result.lastMessage || contact.phone || result.status || "")}</small>
                  </div>
                  <em>{syncingTicketzId === String(result.id) ? "..." : String(result.status || "")}</em>
                </button>
              );
            })}
          </div>
        )}
        <div className="ticketList">
          {filteredTickets.length === 0 ? (
            <div className="emptyTickets">Nenhuma conversa sincronizada ainda.</div>
          ) : (
            filteredTickets.map(ticket => {
              const customer = ticketCustomer(ticket);
              return (
                <button
                  type="button"
                  key={String(ticket.id)}
                  className={String(ticket.id) === selectedTicketId ? "active" : ""}
                  onClick={() => setSelectedTicketId(String(ticket.id))}
                >
                  <TicketAvatar ticket={ticket} />
                  <div>
                    <strong>{customer.name}</strong>
                    <small>{String(ticket.lastMessage || customer.phone || "Sem mensagens")}</small>
                  </div>
                  {Number(ticket.unreadMessages || 0) > 0 && <b>{Number(ticket.unreadMessages || 0)}</b>}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="chatPane">
        <header>
          <div className="chatContactHeader">
            {selectedTicket && <TicketAvatar ticket={selectedTicket} large />}
            <div>
              <strong>{selectedCustomer?.name || "Selecione uma conversa"}</strong>
              <span>{selectedCustomer?.phone || "Atendimento WhatsApp da empresa"}</span>
            </div>
          </div>
          <button type="button" onClick={() => selectedTicketId && loadMessages(selectedTicketId)}>
            {loadingMessages ? "Carregando..." : "Sincronizar"}
          </button>
        </header>
        <div className="messageArea">
          {!selectedTicket ? (
            <div className="emptyMessages">Escolha uma conversa para atender.</div>
          ) : messages.length === 0 ? (
            <div className="emptyMessages">Nenhuma mensagem espelhada nesta conversa.</div>
          ) : (
            messages.map(message => <ChatMessageBubble message={message} key={String(message.id)} />)
          )}
        </div>
        {error && <div className="error">{error}</div>}
        {success && <div className="successNote">{success}</div>}
        <form className="chatComposer" onSubmit={sendMessage}>
          <div className="chatComposerTools">
            <button
              type="button"
              className="attachButton"
              disabled={!selectedTicket || sending || recordingAudio}
              onClick={() => openFilePicker("image/*")}
              title="Enviar foto"
              aria-label="Enviar foto"
            >
              <ImagePlus />
            </button>
            <button
              type="button"
              className="attachButton"
              disabled={!selectedTicket || sending || recordingAudio}
              onClick={() => openFilePicker("image/*,audio/*,video/mp4,application/pdf,text/plain,.doc,.docx,.xls,.xlsx")}
              title="Anexar arquivo"
              aria-label="Anexar arquivo"
            >
              <Paperclip />
            </button>
            <button
              type="button"
              className="attachButton"
              disabled={!selectedTicket || sending || recordingAudio}
              onClick={() => setEmojiOpen(current => !current)}
              title="Escolher emoji"
              aria-label="Escolher emoji"
              aria-expanded={emojiOpen}
            >
              <Smile />
            </button>
            <button
              type="button"
              className={`attachButton audioRecordButton${recordingAudio ? " recording" : ""}`}
              disabled={!selectedTicket || sending}
              onClick={toggleAudioRecording}
              title={recordingAudio ? "Parar gravacao" : "Gravar audio"}
              aria-label={recordingAudio ? "Parar gravacao" : "Gravar audio"}
            >
              {recordingAudio ? <Square /> : <Mic />}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="chatFileInput"
            accept="image/*,audio/*,video/mp4,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
            disabled={!selectedTicket || sending}
            onChange={event => setAttachedFile(event.target.files?.[0] || null)}
          />
          <input
            value={draft}
            disabled={!selectedTicket || sending}
            onChange={event => setDraft(event.target.value)}
            placeholder={attachedFile ? "Legenda opcional" : selectedTicket ? "Digite uma mensagem" : "Selecione uma conversa"}
          />
          <button type="submit" disabled={!selectedTicket || sending || (!draft.trim() && !attachedFile)}>
            {sending ? "Enviando..." : "Enviar"}
          </button>
          {emojiOpen && (
            <div className="emojiPicker" role="group" aria-label="Emojis rapidos">
              {quickEmojis.map(emoji => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => {
                    setDraft(current => `${current}${emoji}`);
                    setEmojiOpen(false);
                  }}
                  aria-label={`Inserir ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {recordingAudio && <div className="recordingNote">Gravando audio... toque no quadrado para finalizar.</div>}
          {attachedFile && (
            <div className="attachmentPreview">
              <span>{attachedFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remover
              </button>
            </div>
          )}
        </form>
      </main>

      <aside className={`orderAssist${assistCollapsed ? " collapsed" : ""}`}>
        <header>
          {!assistCollapsed && (
            <div>
              <strong>Automacao</strong>
              <span>{String(company.name || "Empresa")}</span>
            </div>
          )}
          {!assistCollapsed && !nativeConnection && (
            <button type="button" className="advancedTicketzLink" onClick={openAdvancedTicketz} disabled={openingAdvanced}>
              <ExternalLink />
              {openingAdvanced ? "Abrindo..." : "Avancado"}
            </button>
          )}
          <button
            type="button"
            className="assistCollapseButton"
            onClick={() => setAssistCollapsed(current => !current)}
            title={assistCollapsed ? "Abrir configuracoes" : "Recolher configuracoes"}
            aria-label={assistCollapsed ? "Abrir configuracoes" : "Recolher configuracoes"}
          >
            {assistCollapsed ? <ChevronLeft /> : <ChevronRight />}
          </button>
        </header>
        {!assistCollapsed && <div className="assistStatusGrid">
          <article>
            <span>WhatsApp</span>
            <strong>{activeConnectionStatus}</strong>
          </article>
          <article>
            <span>Fila</span>
            <strong>{String(selectedTicket?.queueId || company.ticketzQueueId || "-")}</strong>
          </article>
          <article>
            <span>IA</span>
            <strong>{selectedHumanTakeover ? "Humano" : selectedTicket?.botEnabled === false ? "Pausada" : "Ligada"}</strong>
          </article>
          <article>
            <span>n8n</span>
            <strong>{company.n8nWebhookUrl ? "Configurado" : "Pendente"}</strong>
          </article>
        </div>}
        {!assistCollapsed && <div className="connectionBox">
          <div>
            <strong>{String(activeConnection?.name || company.name || "WhatsApp")}</strong>
            <span>{activeConnection ? nativeConnection ? "Conexao nativa do SaaS" : "Conexao legada pelo Ticketz" : "Nenhuma conexao cadastrada"}</span>
          </div>
          {qrImageUrl && (
            <img className="connectionQr" src={qrImageUrl} alt="QR Code para conectar WhatsApp" />
          )}
          {activeConnection && (
            <div className="connectionActions">
              <button type="button" disabled={Boolean(connectionSaving)} onClick={() => connectionAction(activeConnection, "start")}>
                {connectionSaving === "start" ? "Abrindo..." : "Conectar"}
              </button>
              <button type="button" disabled={Boolean(connectionSaving)} onClick={() => connectionAction(activeConnection, "connected")}>
                {connectionSaving === "connected" ? "Checando..." : "Checar"}
              </button>
              <button type="button" disabled={Boolean(connectionSaving)} onClick={() => connectionAction(activeConnection, "refresh")}>
                {connectionSaving === "refresh" ? "Atualizando..." : "Novo QR"}
              </button>
              <button type="button" className="dangerAction" disabled={Boolean(connectionSaving)} onClick={() => connectionAction(activeConnection, "disconnect")}>
                {connectionSaving === "disconnect" ? "Saindo..." : "Desconectar"}
              </button>
              {!nativeConnection && (
                <button type="button" disabled={Boolean(connectionSaving)} onClick={() => connectionAction(activeConnection, "migrate-native")}>
                  Migrar para SaaS
                </button>
              )}
            </div>
          )}
          {!activeConnection && (
            <small>Crie ou reprovisione a integracao da empresa para liberar o QR nesta tela.</small>
          )}
        </div>}
        {!assistCollapsed && <div className="assistActions">
          <button type="button" disabled={!selectedTicket || selectedHumanTakeover} onClick={() => toggleHandoff(true)}>
            Assumir humano
          </button>
          <button type="button" disabled={!selectedTicket || !selectedHumanTakeover} onClick={() => toggleHandoff(false)}>
            Devolver para IA
          </button>
          <button type="button" disabled={!selectedTicket} onClick={() => toggleBot(false)}>
            Pausar IA
          </button>
          <button type="button" disabled={!selectedTicket} onClick={() => toggleBot(true)}>
            Ligar IA
          </button>
          <button type="button" className="dangerAction" disabled={!selectedTicket || closingTicket} onClick={closeSelectedTicket}>
            {closingTicket ? "Fechando..." : "Fechar atendimento"}
          </button>
        </div>}
        {!assistCollapsed && <div className="assistHint">
          {nativeConnection
            ? "Esta conexao roda no proprio SaaS. Conversas, midias, atendimento humano e automacoes ficam neste painel."
            : "Conexao legada pelo Ticketz. Migre pelo botao acima quando estiver pronto para ler um novo QR Code."}
        </div>}
      </aside>
    </section>
  );
}

const companySettingsFieldGroups = [
  {
    title: "Dados da empresa",
    fields: ["name", "slug", "logoUrl", "segment", "document", "phone", "whatsapp", "email", "address", "city", "state", "zipCode", "active"]
  },
  {
    title: "Cobranca da plataforma",
    fields: [
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
      "billingZipCode"
    ]
  },
  {
    title: "Integracoes",
    fields: ["ticketzBaseUrl", "ticketzCompanyId", "ticketzWhatsappId", "ticketzQueueId", "ticketzApiToken", "n8nWebhookUrl", "webhookSecret"]
  }
];

const companySettingsFields = companySettingsFieldGroups.flatMap(group => group.fields);
const companyOperationalSettingsFields = ["acceptOrders", "allowDelivery", "allowPickup", "deliveryFeeDefault", "minimumOrderValue", "preparationTimeMinutes", "autoAcceptOrders", "requireHumanConfirmationBeforeFinish"];
const barbershopOperationalSettingsFields = ["acceptOrders", "allowPickup", "minimumOrderValue", "preparationTimeMinutes", "autoAcceptOrders", "requireHumanConfirmationBeforeFinish"];

const companySettingsLabels: Record<string, string> = {
  name: "Nome",
  slug: "Slug",
  logoUrl: "Logo",
  segment: "Segmento",
  document: "CPF/CNPJ",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  address: "Endereco",
  city: "Cidade",
  state: "UF",
  zipCode: "CEP",
  active: "Empresa ativa",
  acceptOrders: "Loja aberta para pedidos",
  allowDelivery: "Permite entrega",
  allowPickup: "Permite retirada",
  deliveryFeeDefault: "Taxa de entrega padrao",
  minimumOrderValue: "Pedido minimo",
  preparationTimeMinutes: "Tempo medio de preparo",
  autoAcceptOrders: "Aceitar pedidos automaticamente",
  requireHumanConfirmationBeforeFinish: "Exigir confirmacao humana ao finalizar",
  billingName: "Nome/Razao social",
  billingDocument: "CPF/CNPJ do pagador",
  billingEmail: "E-mail de cobranca",
  billingPhone: "Telefone de cobranca",
  billingStreet: "Rua",
  billingNumber: "Numero",
  billingNeighborhood: "Bairro",
  billingComplement: "Complemento",
  billingCity: "Cidade",
  billingState: "UF",
  billingZipCode: "CEP",
  ticketzBaseUrl: "URL Ticketz",
  ticketzCompanyId: "Empresa Ticketz",
  ticketzWhatsappId: "WhatsApp Ticketz",
  ticketzQueueId: "Fila Ticketz",
  ticketzApiToken: "Token Ticketz",
  n8nWebhookUrl: "Webhook n8n",
  webhookSecret: "Segredo do webhook",
  greetingMessage: "Mensagem de boas-vindas",
  outOfHoursMessage: "Mensagem de loja fechada",
  humanHandoffMessage: "Mensagem ao chamar humano",
  orderAcceptedMessageTemplate: "Resumo do pedido aceito",
  orderOutForDeliveryMessageTemplate: "Aviso de entrega liberada",
  orderReadyMessageTemplate: "Aviso de pedido pronto"
};

const barbershopSettingsLabels: Record<string, string> = {
  ...companySettingsLabels,
  acceptOrders: "Atendimento aberto",
  allowPickup: "Permitir atendimento/venda local",
  minimumOrderValue: "Valor minimo",
  preparationTimeMinutes: "Tempo medio do atendimento",
  autoAcceptOrders: "Iniciar atendimento automatico",
  requireHumanConfirmationBeforeFinish: "Exigir confirmacao humana para finalizar",
  outOfHoursMessage: "Mensagem de barbearia fechada",
  orderAcceptedMessageTemplate: "Resumo do atendimento aceito",
  orderOutForDeliveryMessageTemplate: "Aviso de atendimento finalizado",
  orderReadyMessageTemplate: "Aviso de cliente pronto/finalizado"
};

const companySettingsWideFields = new Set(["logoUrl", "address", "billingStreet", "n8nWebhookUrl", "webhookSecret", "ticketzBaseUrl", "ticketzApiToken"]);
const companySettingsBooleanFields = new Set(["active", "acceptOrders", "allowDelivery", "allowPickup", "autoAcceptOrders", "requireHumanConfirmationBeforeFinish"]);
const companySettingsNumberFields = new Set(["deliveryFeeDefault", "minimumOrderValue", "preparationTimeMinutes"]);

const defaultOrderMessageTemplates = masterDefaultOrderMessages;
const defaultBotMessageTemplates = masterDefaultBotMessages;
const orderMessageTemplateFields = ["orderAcceptedMessageTemplate", "orderOutForDeliveryMessageTemplate", "orderReadyMessageTemplate"];
const botMessageTemplateFields = ["greetingMessage", "outOfHoursMessage", "humanHandoffMessage"];

function CompanySettingsPage({
  session,
  company,
  companyId,
  onSaved
}: {
  session: Session;
  company: Record<string, unknown>;
  companyId: string;
  onSaved: (company: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>(defaultOrderMessageTemplates);
  const [savingMessages, setSavingMessages] = useState(false);
  const [modules, setModules] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const currentSegment = form.segment || String(company.segment || "generic");
  const isBarbershop = currentSegment === "barbershop";
  const operationalFields = isBarbershop ? barbershopOperationalSettingsFields : companyOperationalSettingsFields;
  const settingsLabels = isBarbershop ? barbershopSettingsLabels : companySettingsLabels;

  useEffect(() => {
    const settings = company.settings as Record<string, unknown> | undefined;
    const botSettings = company.botSettings as Record<string, unknown> | undefined;
    setForm(
      {
        ...Object.fromEntries(
          companySettingsFields.map(field => [field, company[field] == null ? "" : String(company[field])])
        ),
        acceptOrders: formBool(settings?.acceptOrders, true),
        allowDelivery: formBool(settings?.allowDelivery, true),
        allowPickup: formBool(settings?.allowPickup, true),
        deliveryFeeDefault: String(settings?.deliveryFeeDefault ?? "0"),
        minimumOrderValue: String(settings?.minimumOrderValue ?? "0"),
        preparationTimeMinutes: String(settings?.preparationTimeMinutes ?? "30"),
        autoAcceptOrders: formBool(settings?.autoAcceptOrders, false),
        requireHumanConfirmationBeforeFinish: formBool(settings?.requireHumanConfirmationBeforeFinish, true),
        ticketzApiToken: ""
      }
    );
    setMessageTemplates({
      orderAcceptedMessageTemplate: String(settings?.orderAcceptedMessageTemplate || defaultOrderMessageTemplates.orderAcceptedMessageTemplate),
      orderOutForDeliveryMessageTemplate: String(settings?.orderOutForDeliveryMessageTemplate || defaultOrderMessageTemplates.orderOutForDeliveryMessageTemplate),
      orderReadyMessageTemplate: String(settings?.orderReadyMessageTemplate || defaultOrderMessageTemplates.orderReadyMessageTemplate),
      greetingMessage: String(botSettings?.greetingMessage || defaultBotMessageTemplates.greetingMessage),
      outOfHoursMessage: String(botSettings?.outOfHoursMessage || defaultBotMessageTemplates.outOfHoursMessage),
      humanHandoffMessage: String(botSettings?.humanHandoffMessage || defaultBotMessageTemplates.humanHandoffMessage)
    });
  }, [companyId, company]);

  async function loadModules() {
    setModules(await api(session, `/api/resources/companyModules?companyId=${companyId}`));
  }

  useEffect(() => {
    loadModules().catch(() => setModules([]));
  }, [session, companyId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {};
      for (const field of companySettingsFields) {
        const value = form[field];
        if (value === "") continue;
        payload[field] = field === "active" ? value === "true" : value;
      }
      const settings: Record<string, unknown> = {};
      for (const field of operationalFields) {
        const value = form[field];
        if (value === "") continue;
        settings[field] = companySettingsBooleanFields.has(field)
          ? value === "true"
          : companySettingsNumberFields.has(field)
            ? Number(value)
            : value;
      }
      if (isBarbershop) {
        settings.allowDelivery = false;
        settings.deliveryFeeDefault = 0;
      }
      const updated = await api(session, `/api/companies/${companyId}/setup`, {
        method: "PUT",
        body: JSON.stringify({ ...payload, settings })
      });
      onSaved(updated);
      setSuccess("Configuracoes da empresa atualizadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuracoes");
    }
  }

  async function submitMessageTemplates(event: React.FormEvent) {
    event.preventDefault();
    setSavingMessages(true);
    setError("");
    setSuccess("");
    try {
      const settings = Object.fromEntries(
        orderMessageTemplateFields.map(field => [field, messageTemplates[field] || ""])
      );
      const botSettings = Object.fromEntries(
        botMessageTemplateFields.map(field => [field, messageTemplates[field] || ""])
      );
      const updated = await api(session, `/api/companies/${companyId}/setup`, {
        method: "PUT",
        body: JSON.stringify({ settings, botSettings })
      });
      onSaved(updated);
      setSuccess("Mensagens automaticas atualizadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar mensagens automaticas");
    } finally {
      setSavingMessages(false);
    }
  }

  async function toggleModule(item: Record<string, unknown>) {
    setError("");
    setSuccess("");
    try {
      await api(session, `/api/resources/companyModules/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !Boolean(item.active) })
      });
      await loadModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar modulo");
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError("");
    setSuccess("");
    setUploadingLogo(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api(session, "/api/uploads/images", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          fileName: file.name,
          contentType: file.type,
          dataUrl
        })
      });
      setForm(current => ({ ...current, logoUrl: String(result.url || "") }));
      setSuccess("Logo enviada. Clique em salvar configuracoes para aplicar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  function renderSettingsField(field: string) {
    return (
      <label key={field} className={companySettingsWideFields.has(field) ? "wideField" : undefined}>
        {settingsLabels[field] || field}
        {companySettingsBooleanFields.has(field) ? (
          <select value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })}>
            {field === "active" && <option value="">Auto</option>}
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        ) : field === "segment" ? (
          <select value={form[field] || "generic"} onChange={event => setForm({ ...form, [field]: event.target.value })}>
            <option value="restaurant">Restaurante</option>
            <option value="barbershop">Barbearia</option>
            <option value="generic">Generico</option>
          </select>
        ) : field === "logoUrl" ? (
          <span className="stackedInput">
            <input value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })} />
            <span className="logoUploadInline">
              <Upload />
              <input type="file" accept="image/*" onChange={event => void uploadLogo(event.target.files?.[0])} />
              {uploadingLogo ? "Enviando..." : "Enviar arquivo da logo"}
            </span>
          </span>
        ) : companySettingsNumberFields.has(field) ? (
          <input type="number" step="0.01" value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })} />
        ) : companySettingsWideFields.has(field) ? (
          <textarea value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })} />
        ) : (
          <input value={form[field] || ""} onChange={event => setForm({ ...form, [field]: event.target.value })} />
        )}
      </label>
    );
  }

  return (
    <section className="workspace companySettingsPage">
      <header className="pageHeader">
        <div>
          <h2>Configuracoes</h2>
          <p>Dados visuais, contatos, integracoes e modulos da empresa selecionada.</p>
        </div>
      </header>

      <form className="editor companySettingsEditor" onSubmit={submit}>
        <div className="companyPreview">
          <CompanyMark company={{ ...company, logoUrl: form.logoUrl }} />
          <div>
            <strong>{form.name || String(company.name || "Empresa")}</strong>
            <span>{form.slug || String(company.slug || "-")}</span>
          </div>
        </div>

        {companySettingsFieldGroups.map(group => (
          <fieldset className="settingsGroup" key={group.title}>
            <legend>{group.title}</legend>
            {group.fields.map(renderSettingsField)}
          </fieldset>
        ))}

        <fieldset className="settingsGroup">
          <legend>{isBarbershop ? "Operacao e atendimento" : "Operacao e pedidos"}</legend>
          {operationalFields.map(renderSettingsField)}
        </fieldset>

        {error && <div className="error">{error}</div>}
        {success && <div className="successNote">{success}</div>}
        <button type="submit">Salvar configuracoes</button>
      </form>

      <form className="editor messageTemplatesEditor" onSubmit={submitMessageTemplates}>
        <header className="messageTemplatesHeader">
          <div>
            <h2>Mensagens automaticas</h2>
            <p>Edite respostas do atendimento e avisos enviados quando o pedido muda de etapa.</p>
          </div>
        </header>
        <fieldset className="settingsGroup templateSettingsGroup">
          <legend>Atendimento</legend>
          {botMessageTemplateFields.map(field => (
            <label className="templateTextarea" key={field}>
              {settingsLabels[field] || field}
              <textarea
                value={messageTemplates[field] || ""}
                onChange={event => setMessageTemplates({ ...messageTemplates, [field]: event.target.value })}
              />
            </label>
          ))}
        </fieldset>
        <fieldset className="settingsGroup templateSettingsGroup">
          <legend>Pedidos</legend>
          {orderMessageTemplateFields.map(field => (
            <label className="templateTextarea" key={field}>
              {settingsLabels[field] || field}
              <textarea
                value={messageTemplates[field] || ""}
                onChange={event => setMessageTemplates({ ...messageTemplates, [field]: event.target.value })}
              />
            </label>
          ))}
        </fieldset>
        <div className="templateVariables">
          <strong>Variaveis disponiveis</strong>
          <span>{`{primeiro_nome}`}</span>
          <span>{`{cliente}`}</span>
          <span>{`{empresa}`}</span>
          <span>{`{pedido}`}</span>
          <span>{`{itens}`}</span>
          <span>{`{total}`}</span>
          <span>{`{pagamento}`}</span>
          <span>{`{tipo}`}</span>
          <span>{`{endereco}`}</span>
          <span>{`{destino}`}</span>
          <span>{`{proximo_passo}`}</span>
          <span>{`{tempo_entrega}`}</span>
        </div>
        <button type="submit" disabled={savingMessages}>{savingMessages ? "Salvando..." : "Salvar mensagens"}</button>
      </form>

      <section className="settingsModules">
        <header className="restaurantSectionHeader">
          <div>
            <h2>Modulos</h2>
            <p>Ative ou desative areas do sistema para esta empresa.</p>
          </div>
        </header>
        <div className="moduleGrid">
          {modules.map(module => (
            <article className={module.active ? "moduleCard active" : "moduleCard"} key={String(module.id)}>
              <div>
                <strong>{String(module.name || module.moduleKey)}</strong>
                <span>{String(module.description || module.moduleKey || "")}</span>
              </div>
              <button type="button" onClick={() => toggleModule(module)}>
                {module.active ? "Ativo" : "Inativo"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function RestaurantAdminPanel({
  session,
  companies,
  selectedCompany,
  selectedCompanyId,
  activeModules,
  onCompanyChange,
  onCompanySaved,
  onBackToMaster,
  onLogout
}: {
  session: Session;
  companies: Record<string, unknown>[];
  selectedCompany: Record<string, unknown>;
  selectedCompanyId: string;
  activeModules: Record<string, boolean>;
  onCompanyChange: (companyId: string) => void;
  onCompanySaved: (company: Record<string, unknown>) => void;
  onBackToMaster?: () => void;
  onLogout: () => void;
}) {
  const [view, setView] = useState<RestaurantViewKey>(() => adminLocation().view || "dashboard");
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, unknown>[]>([]);
  const [changingOrderAcceptance, setChangingOrderAcceptance] = useState(false);
  const [orderAcceptanceError, setOrderAcceptanceError] = useState("");
  const isBarbershop = isBarbershopCompany(selectedCompany);
  const navItems = isBarbershop ? barbershopNav : restaurantNav;
  const selectedCompanySettings = selectedCompany.settings as Record<string, unknown> | undefined;
  const acceptOrders = selectedCompanySettings?.acceptOrders !== false;
  const companySlugValue = companySlug(selectedCompany);

  function selectView(nextView: RestaurantViewKey) {
    setView(nextView);
    updateAdminLocation({
      adminMode: session.user.role === "super_admin" ? "company" : "user",
      company: selectedCompanyId,
      view: nextView,
      masterTab: null
    });
  }

  useEffect(() => {
    updateAdminLocation({
      adminMode: session.user.role === "super_admin" ? "company" : "user",
      company: selectedCompanyId,
      view,
      masterTab: null
    });
  }, [selectedCompanyId, session.user.role, view]);

  useEffect(() => {
    Promise.all([
      api(session, `/api/resources/orders?companyId=${selectedCompanyId}`),
      api(session, `/api/resources/paymentMethods?companyId=${selectedCompanyId}`)
    ])
      .then(([loadedOrders, loadedPayments]) => {
        setOrders(loadedOrders);
        setPaymentMethods(loadedPayments);
      })
      .catch(() => {
        setOrders([]);
        setPaymentMethods([]);
      });
  }, [session, selectedCompanyId]);

  const visibleRestaurantNav = navItems.filter(item => {
    const moduleKey = restaurantModules[item.key];
    return !moduleKey || activeModules[moduleKey] !== false;
  });
  const currentNav = navItems.find(item => item.key === view);
  const pendingOrders = orders.filter(order => ["draft", "waiting_confirmation"].includes(String(order.status))).length;
  const productionOrders = orders.filter(order => ["confirmed", "preparing"].includes(String(order.status))).length;
  const readyOrders = orders.filter(order =>
    isBarbershop
      ? ["ready", "completed", "delivered", "canceled"].includes(String(order.status))
      : ["ready", "out_for_delivery"].includes(String(order.status))
  ).length;
  const statsLabels = isBarbershop
    ? ["Aguardando", "Em atendimento", "Finalizados"]
    : ["Em analise", "Em producao", "Prontos/rota"];

  useEffect(() => {
    if (!visibleRestaurantNav.some(item => item.key === view)) {
      setView("settings");
    }
  }, [view, visibleRestaurantNav]);

  async function toggleOrderAcceptance() {
    setChangingOrderAcceptance(true);
    setOrderAcceptanceError("");
    try {
      const updated = await api(session, `/api/companies/${selectedCompanyId}/order-acceptance`, {
        method: "PUT",
        body: JSON.stringify({ acceptOrders: !acceptOrders })
      });
      onCompanySaved(updated);
    } catch (err) {
      setOrderAcceptanceError(err instanceof Error ? err.message : "Erro ao alterar status da loja");
    } finally {
      setChangingOrderAcceptance(false);
    }
  }

  function renderPage() {
    if (view === "dashboard") {
      return isBarbershop
        ? <BarbershopDashboard session={session} companyId={selectedCompanyId} />
        : <Dashboard session={session} companyId={selectedCompanyId} />;
    }
    if (view === "whatsapp") {
      return <RestaurantWhatsappPage session={session} company={selectedCompany} companyId={selectedCompanyId} />;
    }
    if (view === "orders") {
      return (
        <RestaurantOrdersBoard
          session={session}
          companyId={selectedCompanyId}
          companySlug={companySlugValue}
          onOrdersChanged={setOrders}
          variant={isBarbershop ? "barbershop" : "restaurant"}
        />
      );
    }
    if (view === "tables") {
      return (
        <RestaurantTablesManagementPage
          session={session}
          companyId={selectedCompanyId}
          orders={orders}
          companySlug={companySlugValue}
          variant={isBarbershop ? "barbershop" : "restaurant"}
        />
      );
    }
    if (view === "financial") {
      if (isBarbershop) return <BarbershopFinancialPage session={session} companyId={selectedCompanyId} />;
      return (
        <RestaurantFinancialPage
          session={session}
          companyId={selectedCompanyId}
          orders={orders}
          paymentMethods={paymentMethods}
          onOrdersChanged={setOrders}
        />
      );
    }
    if (view === "billing") {
      return <PlatformBillingPage session={session} companyId={selectedCompanyId} companies={companies} />;
    }
    if (view === "deliveries") return <DeliveryPersonsPage session={session} companyId={selectedCompanyId} />;
    if (view === "appointments") {
      return isBarbershop
        ? <BarbershopAppointmentsPage session={session} companyId={selectedCompanyId} />
        : <ResourceView config={getResourceConfig("appointments")} session={session} companyId={selectedCompanyId} />;
    }
    if (view === "payments") return <ResourceView config={getResourceConfig("paymentMethods")} session={session} companyId={selectedCompanyId} />;
    if (view === "printers") return <ResourceView config={getResourceConfig("printers")} session={session} companyId={selectedCompanyId} />;
    if (view === "users") return <ResourceView config={getResourceConfig("users")} session={session} companyId={selectedCompanyId} />;
    if (view === "customers") return <ResourceView config={getResourceConfig("customers")} session={session} companyId={selectedCompanyId} />;
    if (view === "menu") return <MenuManagementPage session={session} companyId={selectedCompanyId} companySlug={companySlugValue} variant={isBarbershop ? "barbershop" : "restaurant"} />;
    if (view === "settings") {
      return <CompanySettingsPage session={session} company={selectedCompany} companyId={selectedCompanyId} onSaved={onCompanySaved} />;
    }
    return isBarbershop
      ? <BarbershopDashboard session={session} companyId={selectedCompanyId} />
      : <Dashboard session={session} companyId={selectedCompanyId} />;
  }

  return (
    <main className="restaurantShell">
      <aside className="restaurantRail">
        <div className="railAvatar">{companyInitials(selectedCompany)}</div>
        <Smartphone />
        <Percent />
        <Gift />
        <Smile />
      </aside>
      <aside className="restaurantSidebar">
        <div className="restaurantBrand">
          <CompanyMark company={selectedCompany} />
          <div>
            <strong>{String(selectedCompany.name)}</strong>
            <span>{String(session.user.name)}</span>
          </div>
        </div>
        <div className="cashBox">
          <Banknote />
          <strong>{isBarbershop ? "Atendimento" : "Loja"}</strong>
          <span className={acceptOrders ? "open" : "closed"}>{acceptOrders ? "Aberta" : "Fechada"}</span>
          <button type="button" onClick={toggleOrderAcceptance} disabled={changingOrderAcceptance}>
            {changingOrderAcceptance ? "..." : acceptOrders ? "Fechar" : "Abrir"}
          </button>
        </div>
        {orderAcceptanceError && <p className="sideError">{orderAcceptanceError}</p>}
        <label className="sideSearch">
          <Search />
          <input placeholder="Procurando por algo?" />
        </label>
        <nav>
          {visibleRestaurantNav.map((item, index) => {
            const previous = visibleRestaurantNav[index - 1];
            const showGroup = !previous || previous.group !== item.group;
            return (
              <React.Fragment key={item.key}>
                {showGroup && <span className="navGroup">{item.group}</span>}
                <button type="button" className={view === item.key ? "active" : ""} onClick={() => selectView(item.key)}>
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="restaurantAccount">
          <CompanyMark company={selectedCompany} />
          <div>
            <strong>{String(selectedCompany.name || "Empresa")}</strong>
            <span>{acceptOrders ? "ABERTO" : "FECHADO"}</span>
          </div>
        </div>
      </aside>
      <section className={`restaurantMain${view === "whatsapp" ? " whatsappWorkspaceActive" : ""}`}>
        <header className="restaurantTopbar">
          <div className="restaurantCompanyPicker">
            <Store />
            <select value={selectedCompanyId} onChange={event => onCompanyChange(event.target.value)}>
              {companies.map(company => (
                <option key={String(company.id)} value={String(company.id)}>
                  {String(company.name)}
                </option>
              ))}
            </select>
          </div>
          <a href={`/cardapio/${companySlugValue}`} target="_blank">{isBarbershop ? "Agendamento online" : "Ver cardapio"}</a>
          <a href={`/garcom/${companySlugValue}`} target="_blank">{isBarbershop ? "Tela atendente" : "Tela garcom"}</a>
          {session.user.role === "super_admin" && onBackToMaster && (
            <button type="button" className="secondaryAction" onClick={onBackToMaster}>Painel master</button>
          )}
          <button
            type="button"
            className={`statusPill ${acceptOrders ? "open" : "closed"}`}
            onClick={toggleOrderAcceptance}
            disabled={changingOrderAcceptance}
          >
            {acceptOrders ? "Aberto" : "Fechado"}
          </button>
          <button type="button" className="iconButton" title="Sair" onClick={onLogout}><LogOut /></button>
        </header>
        <div className="restaurantHero">
          <div>
            <span>{currentNav?.group || "Operacao"}</span>
            <h1>{currentNav?.label || "Painel"}</h1>
            <p>Painel gerenciavel da {String(selectedCompany.name)}.</p>
          </div>
          <div className="restaurantStats">
            <article><span>{statsLabels[0]}</span><strong>{pendingOrders}</strong></article>
            <article><span>{statsLabels[1]}</span><strong>{productionOrders}</strong></article>
            <article><span>{statsLabels[2]}</span><strong>{readyOrders}</strong></article>
          </div>
        </div>
        {renderPage()}
      </section>
    </main>
  );
}

function BillingLockedScreen({
  session,
  company,
  companyId,
  onLogout
}: {
  session: Session;
  company: Record<string, unknown>;
  companyId: string;
  onLogout: () => void;
}) {
  return (
    <main className="billingLockedShell">
      <header className="billingLockedHeader">
        <div>
          <span className="mark">Vib</span>
          <h1>Sistema bloqueado</h1>
          <p>A assinatura da {String(company.name || "empresa")} possui cobranca pendente. Regularize por Pix ou boleto, ou fale com o suporte Correacloud.</p>
        </div>
        <button type="button" className="iconButton" title="Sair" onClick={onLogout}><LogOut /></button>
      </header>
      <PlatformBillingPage session={session} companyId={companyId} companies={[company]} />
    </main>
  );
}

function AdminApp() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("vib-session");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem("vib-session");
      return null;
    }
  });
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [companyLoadError, setCompanyLoadError] = useState("");
  const [masterMode, setMasterMode] = useState(() => session?.user.role === "super_admin" && adminLocation().mode !== "company");
  const [subscriptionGate, setSubscriptionGate] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!session) return;
    if (session.user.role === "super_admin") setMasterMode(adminLocation().mode !== "company");
    setCompanyLoadError("");
    api(session, "/api/resources/companies")
      .then(data => {
        setCompanies(data);
        if (!data.length) {
          setSelectedCompanyId(null);
          setCompanyLoadError("Nenhuma empresa cadastrada para este usuario.");
          return;
        }
        const savedCompanyId = localStorage.getItem("vib-selected-company-id");
        const locationCompanyId = adminLocation().companyId;
        const companyExists = (id: string | null) => id && data.some((company: Record<string, unknown>) => String(company.id) === id);
        const nextCompanyId =
          (companyExists(locationCompanyId) && locationCompanyId) ||
          (companyExists(savedCompanyId) && savedCompanyId) ||
          (companyExists(session.user.companyId) && session.user.companyId) ||
          String(data[0]?.id || "");
        setSelectedCompanyId(nextCompanyId);
      })
      .catch(() => {
        localStorage.removeItem("vib-session");
        setSession(null);
        setCompanies([]);
        setSelectedCompanyId(null);
      });
  }, [session]);

  useEffect(() => {
    if (!session || !selectedCompanyId) return;
    api(session, `/api/resources/companyModules?companyId=${selectedCompanyId}`)
      .then(data => {
        const moduleState = Object.fromEntries(
          data.map((module: Record<string, unknown>) => [String(module.moduleKey), Boolean(module.active)])
        );
        setActiveModules(moduleState);
      })
      .catch(() => setActiveModules({}));
  }, [session, selectedCompanyId]);

  useEffect(() => {
    if (!session || !selectedCompanyId || session.user.role === "super_admin") {
      setSubscriptionGate(null);
      return;
    }
    api(session, `/api/billing/my-subscription?companyId=${selectedCompanyId}`)
      .then(data => setSubscriptionGate(data))
      .catch(() => setSubscriptionGate(null));
  }, [session, selectedCompanyId]);
  const selectedCompany = useMemo(
    () => companies.find(company => String(company.id) === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  if (!session) return <Login onLogin={nextSession => {
    setMasterMode(nextSession.user.role === "super_admin");
    setSession(nextSession);
  }} />;

  if (session.user.role === "super_admin" && masterMode) {
    return (
      <MasterPanel
        session={session}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={companyId => {
          localStorage.setItem("vib-selected-company-id", companyId);
          updateAdminLocation({ company: companyId });
          setSelectedCompanyId(companyId);
        }}
        onConnectCompany={companyId => {
          localStorage.setItem("vib-selected-company-id", companyId);
          updateAdminLocation({ adminMode: "company", company: companyId, view: "dashboard", masterTab: null });
          setSelectedCompanyId(companyId);
          setMasterMode(false);
        }}
        onCompanySaved={updatedCompany => {
          setCompanies(current => {
            const exists = current.some(company => String(company.id) === String(updatedCompany.id));
            return exists
              ? current.map(company => (String(company.id) === String(updatedCompany.id) ? updatedCompany : company))
              : [updatedCompany, ...current];
          });
        }}
        onLogout={() => {
          localStorage.removeItem("vib-session");
          setSession(null);
          setMasterMode(false);
        }}
      />
    );
  }

  const subscriptionStatus = String(subscriptionGate?.status || "");
  const billingLocked =
    session.user.role !== "super_admin" &&
    Boolean(subscriptionGate) &&
    ["past_due", "suspended", "canceled"].includes(subscriptionStatus);

  if (selectedCompany && selectedCompanyId && billingLocked) {
    return (
      <BillingLockedScreen
        session={session}
        company={selectedCompany}
        companyId={selectedCompanyId}
        onLogout={() => {
          localStorage.removeItem("vib-session");
          setSession(null);
          setMasterMode(false);
        }}
      />
    );
  }

  if (selectedCompany && selectedCompanyId) {
    return (
      <RestaurantAdminPanel
        session={session}
        companies={companies}
        selectedCompany={selectedCompany}
        selectedCompanyId={selectedCompanyId}
        activeModules={activeModules}
        onCompanyChange={companyId => {
          localStorage.setItem("vib-selected-company-id", companyId);
          updateAdminLocation({ company: companyId });
          setSelectedCompanyId(companyId);
        }}
        onCompanySaved={updatedCompany => {
          setCompanies(current =>
            current.map(company => (String(company.id) === String(updatedCompany.id) ? updatedCompany : company))
          );
        }}
        onBackToMaster={session.user.role === "super_admin" ? () => {
          updateAdminLocation({ adminMode: "master", masterTab: "companies", view: null });
          setMasterMode(true);
        } : undefined}
        onLogout={() => {
          localStorage.removeItem("vib-session");
          setSession(null);
          setMasterMode(false);
        }}
      />
    );
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <span className="mark">Vib</span>
        <h1>{companyLoadError ? "Empresa indisponivel" : "Carregando empresa"}</h1>
        <p>{companyLoadError || "Preparando o painel padrao da empresa selecionada."}</p>
      </section>
    </main>
  );
}

function App() {
  const oauthParams = new URLSearchParams(window.location.search);
  if (oauthParams.get("code") && oauthParams.get("state")) {
    return <CustomerOAuthCallbackApp />;
  }

  const customerMatch = window.location.pathname.match(/^\/cliente(?:\/([^/]+))?/);
  if (customerMatch) {
    return <CustomerPortalApp slug={customerMatch[1] || "brum-cortes-barbearia"} />;
  }

  const waiterMatch = window.location.pathname.match(/^\/garcom(?:\/([^/]+))?/);
  if (waiterMatch) {
    return <WaiterOrderApp slug={waiterMatch[1] || "pizzaria-big-burguer"} />;
  }

  const publicMatch = window.location.pathname.match(/^\/cardapio(?:\/([^/]+))?/);
  if (publicMatch) {
    return <PublicMenuApp slug={publicMatch[1] || "pizzaria-big-burguer"} />;
  }

  return <AdminApp />;
}

createRoot(document.getElementById("root")!).render(<App />);
