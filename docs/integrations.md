# Integracoes

## Ticketz/Whaticket

O Ticketz fica como canal de atendimento WhatsApp. A plataforma pode receber eventos pelo endpoint:

```http
POST /api/webhooks/ticketz
```

Tambem existe o endpoint direto do modulo de chat:

```http
POST /api/chat/messages
```

Enviar o header:

```http
x-webhook-secret: seu-secret
```

Payload flexivel de exemplo:

```json
{
  "company_id": "id-da-empresa",
  "event": "message",
  "ticketz_ticket_id": "123",
  "ticketz_message_id": "msg-123",
  "ticketz_whatsapp_id": "whatsapp-1",
  "contact": {
    "name": "Maria",
    "phone": "11999999999"
  },
  "message": {
    "type": "text",
    "content": "Quero pedir um x-bacon"
  }
}
```

Quando a mensagem recebida for inbound, o ticket estiver com bot ativo e sem atendimento humano, a plataforma envia um POST para `company.n8n_webhook_url` com:

```json
{
  "event": "message.received",
  "company": {
    "id": "id-da-empresa",
    "name": "Restaurante Delivery Exemplo",
    "segment": "restaurant"
  },
  "ticket": {},
  "customer": {},
  "message": {
    "type": "text",
    "content": "Quero pedir um x-bacon"
  },
  "raw": {}
}
```

Se o evento for localizacao:

```json
{
  "company_id": "id-da-empresa",
  "ticketz_ticket_id": "123",
  "contact": {
    "name": "Maria",
    "phone": "11999999999"
  },
  "message": {
    "type": "location",
    "latitude": -23.55052,
    "longitude": -46.633308,
    "address": "Rua Exemplo, 123",
    "reference": "Portao azul"
  }
}
```

## n8n

Endpoints principais para fluxos n8n:

```http
GET /api/companies/:id/context
GET /api/companies/:id/ai-prompt
GET /api/companies/:id/menu
GET /api/companies/:id/services
POST /api/orders
POST /api/orders/:id/confirm
POST /api/deliveries
POST /api/deliveries/:id/assign
POST /api/deliveries/:id/status
POST /api/tickets/:id/handoff
POST /api/ticketz/send-message
POST /api/n8n/events
```

## Mensagem para motoboy

```text
Nova entrega atribuida para voce.

Pedido: #{order.id}
Cliente: {customer.name}
Telefone: {customer.phone}

Itens:
{order.items}

Valor total: R$ {order.total}
Pagamento: {order.payment_method}

Endereco:
{delivery.delivery_address}

Referencia:
{address.reference}

Mapa:
{google_maps_link}

Observacoes:
{order.notes}

Status: Aguardando retirada.
```
