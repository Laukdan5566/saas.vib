const fs = require("fs");
const { Client } = require("pg");

const workflowFile = process.argv[2] || "/tmp/K2GVMhLFIkh70Egi-nodes-current.json";
const workflowId = process.argv[3] || "K2GVMhLFIkh70Egi";
const workflow = JSON.parse(fs.readFileSync(workflowFile, "utf8"));
const nodes = Array.isArray(workflow) ? workflow : workflow.nodes;

if (!Array.isArray(nodes) || !nodes.length) {
  throw new Error("Workflow sem nodes validos.");
}

const client = new Client({
  host: process.env.DB_POSTGRESDB_HOST || "postgres",
  port: Number(process.env.DB_POSTGRESDB_PORT || 5432),
  database: process.env.DB_POSTGRESDB_DATABASE || "n8n",
  user: process.env.DB_POSTGRESDB_USER || "n8n",
  password: process.env.DB_POSTGRESDB_PASSWORD
});

(async () => {
  await client.connect();
  const result = await client.query(
    'UPDATE workflow_entity SET nodes = $1::jsonb, "updatedAt" = NOW() WHERE id = $2',
    [JSON.stringify(nodes), workflowId]
  );
  await client.end();

  if (result.rowCount !== 1) {
    throw new Error(`Workflow nao atualizado. rowCount=${result.rowCount}`);
  }

  console.log(`Workflow ${workflowId} atualizado com ${nodes.length} nodes.`);
})().catch(async error => {
  try {
    await client.end();
  } catch {}
  console.error(error);
  process.exit(1);
});
