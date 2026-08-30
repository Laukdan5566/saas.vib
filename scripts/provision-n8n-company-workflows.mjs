import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiUrl = process.env.SAAS_API_URL || "http://localhost:3101";
const n8nWebhookBaseUrl = (process.env.N8N_WEBHOOK_BASE_URL || "http://localhost:5678").replace(/\/$/, "");
const email = process.env.SAAS_ADMIN_EMAIL || "admin@example.com";
const password = process.env.SAAS_ADMIN_PASSWORD;
if (!password) throw new Error("Defina SAAS_ADMIN_PASSWORD antes de executar o provisionamento.");
const outDir = process.env.OUT_DIR || "docs/n8n-workflows";
const updateCompanies = process.env.UPDATE_COMPANIES === "true";

function slugify(value) {
  return String(value || "empresa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "empresa";
}

function workflowPath(company) {
  return `vib/${slugify(company.slug || company.name)}/${company.id}/ticketz`;
}

function webhookUrl(company) {
  return `${n8nWebhookBaseUrl}/webhook/${workflowPath(company)}`;
}

async function request(route, options = {}) {
  const response = await fetch(`${apiUrl}${route}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${route} -> ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function workflowForCompany(company) {
  const pathValue = workflowPath(company);
  const resolvedApiUrl = apiUrl.replace(/\/$/, "");
  return {
    name: `Vib - ${company.name} - Ticketz para IA`,
    active: true,
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: pathValue,
          responseMode: "lastNode",
          options: {}
        },
        id: "company-webhook",
        name: "Entrada Vib/Ticketz",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [220, 300],
        webhookId: `vib-${company.id}`
      },
      {
        parameters: {
          jsCode: `
const input = $input.first().json;
const company = {
  id: "${company.id}",
  name: ${JSON.stringify(company.name)},
  slug: ${JSON.stringify(company.slug)}
};

const event = {
  event: "ticketz.message.received",
  company,
  receivedAt: new Date().toISOString(),
  ticket: input.ticket,
  customer: input.customer,
  message: input.message,
  raw: input
};

let vib = { sent: false };
try {
  vib = await this.helpers.httpRequest({
    method: "POST",
    url: "${resolvedApiUrl}/api/n8n/events",
    headers: {
      "Content-Type": "application/json"
    },
    body: event,
    json: true
  });
} catch (error) {
  vib = { sent: false, error: error.message };
}

return [{ json: { ok: true, company, vib, event } }];
`
        },
        id: "company-router",
        name: "Preparar evento da empresa",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [520, 300]
      }
    ],
    connections: {
      "Entrada Vib/Ticketz": {
        main: [
          [
            {
              node: "Preparar evento da empresa",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    settings: {
      executionOrder: "v1"
    },
    staticData: {
      vibCompanyId: company.id,
      vibCompanySlug: company.slug
    },
    tags: []
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  const companies = await request("/api/resources/companies", { token: login.token });
  const summary = [];

  for (const company of companies) {
    const fileName = `${slugify(company.slug || company.name)}-${company.id}.json`;
    const filePath = path.join(outDir, fileName);
    const workflow = workflowForCompany(company);
    const n8nWebhookUrl = webhookUrl(company);
    await writeFile(filePath, `${JSON.stringify(workflow, null, 2)}\n`);

    if (updateCompanies) {
      await request(`/api/resources/companies/${company.id}`, {
        method: "PUT",
        token: login.token,
        body: JSON.stringify({ n8nWebhookUrl })
      });
    }

    summary.push({
      company: company.name,
      companyId: company.id,
      file: filePath,
      webhookUrl: n8nWebhookUrl,
      updatedCompany: updateCompanies
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
