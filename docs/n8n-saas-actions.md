# Acoes SaaS para n8n

Endpoints internos para workflows n8n controlarem recursos da empresa no SaaS.

Autenticacao:

- enviar `x-webhook-secret` com o segredo configurado no SaaS/n8n;
- nao salvar o valor real do segredo neste arquivo.

Base publica:

```text
https://saas.correacloud.com.br/api
```

## Restaurante

Contexto da empresa:

```http
GET /integrations/restaurants/:companyId/context
```

Cardapio:

```http
GET /integrations/restaurants/:companyId/menu
```

Criar pedido aguardando confirmacao:

```http
POST /integrations/restaurants/:companyId/orders
```

Payload exemplo:

```json
{
  "ticketzTicketId": "123",
  "customer": {
    "name": "Daniel",
    "phone": "27999999999"
  },
  "orderType": "delivery",
  "items": [
    {
      "productId": "id-do-produto",
      "quantity": 1,
      "addonIds": ["id-do-sabor"],
      "notes": "Sem cebola"
    }
  ],
  "address": {
    "street": "Rua Exemplo",
    "number": "10",
    "neighborhood": "Centro",
    "reference": "Perto da praca"
  },
  "paymentMethod": "Pix",
  "notes": "Observacao geral"
}
```

Listar pedidos:

```http
GET /integrations/restaurants/:companyId/orders?status=waiting_confirmation&ticketzTicketId=123&limit=10
```

Detalhar pedido:

```http
GET /integrations/restaurants/:companyId/orders/:orderId
```

Confirmar pedido e gerar impressao:

```http
POST /integrations/restaurants/:companyId/orders/:orderId/confirm
```

Reimprimir pedido:

```http
POST /integrations/restaurants/:companyId/orders/:orderId/reprint
```

Atualizar status:

```http
POST /integrations/restaurants/:companyId/orders/:orderId/status
```

Payload:

```json
{
  "status": "preparing"
}
```

Registrar anotacao interna:

```http
POST /integrations/restaurants/:companyId/notes
```

Payload:

```json
{
  "entity": "ticket",
  "ticketzTicketId": "123",
  "note": "Cliente pediu reimpressao do pedido."
}
```

Carregar rascunho de atendimento:

```http
GET /integrations/restaurants/:companyId/drafts/:draftKey
```

Salvar ou limpar rascunho de atendimento:

```http
POST /integrations/restaurants/:companyId/drafts/:draftKey
```

Payload para salvar:

```json
{
  "draft": {
    "draft": {
      "stage": "collecting_payment",
      "items": []
    },
    "history": []
  }
}
```

Payload para limpar:

```json
{
  "clear": true
}
```

Listar impressoras:

```http
GET /integrations/restaurants/:companyId/printers
```

Listar jobs de impressao:

```http
GET /integrations/restaurants/:companyId/print-jobs?status=pending&orderId=id-do-pedido
```

## Workflow da Pizzaria

Arquivo:

```text
docs/n8n-workflows/vib-pizzaria-big-burguer-recepcao-ia.json
```

Workflow n8n:

```text
Vib - Pizzaria Big Burguer - Recepcao IA
```

Webhook:

```text
https://n8n.correacloud.com.br/webhook/vib/recepcao/pizzaria-big-burguer/6/ticketz
```

O workflow carrega contexto/cardapio no SaaS, chama a IA e executa acoes internas permitidas:

- `add_note`
- `create_order`
- `confirm_order`
- `reprint_order`
- `update_order_status`

Desde `attendant-checkout-v2.2`, o workflow mantem um rascunho por ticket/telefone no SaaS, em `company_modules.config`, para nao depender do `staticData` do n8n. A IA deve:

- coletar uma informacao por vez;
- evitar repetir cardapio quando o cliente ja informou item/tamanho/sabor;
- montar resumo final antes de criar pedido;
- usar `create_order` somente depois de confirmacao clara do cliente;
- deixar o pedido como `waiting_confirmation` para aparecer no painel da loja.

O retorno para o Ticketz continua no formato:

```json
{
  "output": [
    {
      "type": "message",
      "text": "mensagem para o cliente"
    }
  ]
}
```

Tambem e aceito retorno com midia, desde que o backend custom do Ticketz esteja com suporte a `type=media`:

```json
{
  "output": [
    {
      "type": "media",
      "mediaUrl": "https://saas.correacloud.com.br/cardapio-pizzaria-big-burguer.png",
      "mimetype": "image/png",
      "filename": "cardapio-pizzaria-big-burguer.png",
      "caption": "Segue nosso cardapio rapido."
    },
    {
      "type": "message",
      "text": "Me diga o tamanho da pizza e os sabores que voce quer."
    }
  ]
}
```
