# Workflows n8n por empresa

O Vib usa um workflow n8n separado para cada empresa. Cada workflow recebe eventos do chat/Ticketz daquela empresa e pode chamar IA, criar pedidos, transferir atendimento ou devolver respostas.

## Gerar workflows

```bash
SAAS_API_URL=http://11.88.88.8:3101 \
N8N_WEBHOOK_BASE_URL=http://11.88.88.8:5678 \
OUT_DIR=docs/n8n-workflows \
UPDATE_COMPANIES=true \
node scripts/provision-n8n-company-workflows.mjs
```

O script:

- busca as empresas no Vib;
- gera um JSON de workflow por empresa;
- grava `company.n8nWebhookUrl` com a URL do webhook n8n;
- deixa os arquivos prontos para importar no n8n.

## Importar no n8n

No servidor:

```bash
cd /home/chat/n8n-docker
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/vib-n8n-workflows --activeState=fromJson
```

## Fluxo inicial

```text
Vib/Ticketz
  -> n8n webhook da empresa
  -> prepara evento padronizado
  -> POST /api/n8n/events no Vib
```

Depois entrarao os passos de IA:

- consultar contexto/cardapio da empresa no Vib;
- chamar Groq/OpenAI;
- decidir resposta, pedido ou transferencia;
- enviar resposta pelo Ticketz.
