# n8n + Ticketz para restaurantes

Documento vivo da integracao entre Ticketz, n8n e o SaaS para empresas do segmento restaurante.

## Objetivo

Usar o Ticketz como motor de WhatsApp, o n8n como automacao/IA e o SaaS como dono das regras de cardapio, pedidos, impressao, entregas e multi-tenant.

## Fluxo

```text
Cliente WhatsApp
  -> Ticketz
  -> Webhook do SaaS: POST /api/webhooks/ticketz
  -> SaaS identifica empresa, cliente, ticket e mensagem
  -> SaaS envia payload para company.n8nWebhookUrl
  -> n8n consulta contexto/cardapio no SaaS
  -> n8n cria pedido no SaaS quando o cliente confirmar
  -> pedido entra como waiting_confirmation
  -> painel aceita pedido e dispara impressao
```

## Template n8n

Template criado na pasta compartilhada do Nextcloud:

```text
C:\Users\Bruno\Nextcloud\Projetos\fluxo modelo\Ticketz Restaurante SaaS Template.json
```

Ele foi derivado do fluxo atual `Ticketz Smart Reception.json`, sem sobrescrever o original.

Ferramentas principais do template:

- `consultar_contexto_saas`: consulta configuracoes, formas de pagamento, horarios e contexto da empresa.
- `consultar_cardapio_saas`: consulta categorias, produtos, tamanhos, sabores/adicionais e precos.
- `criar_pedido_saas`: cria pedido confirmado pelo cliente no SaaS.
- `registrar_evento_saas`: registra eventos internos do atendimento.

Na recepcao da Big Burguer, a versao `attendant-checkout-v2.2` mantem rascunho por ticket/telefone no SaaS, via endpoints internos de drafts. A IA deve agir como atendente:

- guardar o rascunho entre mensagens;
- perguntar apenas o proximo dado faltante;
- evitar repetir cardapio quando o cliente ja informou item/tamanho/sabor;
- enviar resumo final e pedir confirmacao;
- criar o pedido no SaaS apenas depois da confirmacao clara;
- avisar que o pedido entrou no painel aguardando confirmacao da loja.

## Variaveis esperadas no n8n

Configurar no ambiente do n8n:

```text
SAAS_API_URL=http://backend:3101
SAAS_WEBHOOK_SECRET=<mesmo segredo configurado na empresa ou WEBHOOK_SECRET do backend>
```

Nao salvar tokens reais no repositorio.

## Endpoints internos do SaaS

Protegidos por `x-webhook-secret`.

```http
GET /api/integrations/restaurants/:companyId/context
GET /api/integrations/restaurants/:companyId/menu
POST /api/integrations/restaurants/:companyId/orders
```

O endpoint de pedido valida produtos ativos, adicionais/sabores e limite de escolhas no backend. Para pizzas com dois sabores, a regra do maior valor continua sendo calculada pelo SaaS.

Exemplo de item enviado pelo n8n:

```json
{
  "productId": "id-do-produto-tamanho",
  "quantity": 1,
  "addonIds": ["id-sabor-1", "id-sabor-2"],
  "notes": "sem cebola"
}
```

## Isolamento multi-tenant

A memoria do template usa chave com empresa e ticket:

```text
tenant_{{ company_id }}_ticket_{{ ticket_id }}
```

Isso evita mistura de conversas entre empresas diferentes.

## Proximos passos

1. Importar o template no n8n.
2. Configurar `SAAS_API_URL` e `SAAS_WEBHOOK_SECRET`.
3. Configurar `n8n_webhook_url` na empresa Big Burguer apontando para o webhook do template.
4. Testar mensagem recebida pelo Ticketz.
5. Validar criacao de pedido via WhatsApp entrando em `waiting_confirmation`.
6. Fechar envio real de resposta pelo Ticketz, caso o fluxo atual ainda nao devolva mensagens ao cliente.
