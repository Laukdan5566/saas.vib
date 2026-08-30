# Integracao Efi para ferramenta central de cobranca

Documento focado somente na integracao com a Efi e no desenho recomendado para uma ferramenta central de cobranca. A ideia e que SaaS, Ticketz e outros sistemas chamem essa ferramenta, em vez de cada sistema integrar direto com a Efi.

Nao colocar neste arquivo: Client Secret, certificado real, senha do certificado, chave Pix real, codigo de barras real, link de boleto real, payload completo de producao ou dados pessoais sensiveis.

## Fontes oficiais

- API Cobrancas - Credenciais e Autorizacao: https://dev.efipay.com.br/docs/api-cobrancas/credenciais/
- API Cobrancas - Boleto: https://dev.efipay.com.br/docs/api-cobrancas/boleto/
- API Cobrancas - Notificacoes: https://dev.efipay.com.br/docs/api-cobrancas/notificacoes/
- API Pix - Credenciais, Certificado e Autorizacao: https://dev.efipay.com.br/docs/api-pix/credenciais/
- API Pix - Cobrancas imediatas: https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas/

## Bases da Efi

API Cobrancas:

- Producao: `https://cobrancas.api.efipay.com.br`
- Homologacao: `https://cobrancas-h.api.efipay.com.br`

API Pix:

- Producao: `https://pix.api.efipay.com.br`
- Homologacao: `https://pix-h.api.efipay.com.br`

## Credenciais

Guardar por ambiente:

- `environment`: `homologation` ou `production`
- `clientId`
- `clientSecret`, criptografado no banco
- `pixKey`, quando usar Pix
- `certPath`, quando usar API Pix com certificado
- `certPassphrase`, criptografado quando existir
- `active`

Regras:

- nunca salvar segredo em README, log ou payload de resposta;
- trocar credenciais deve ser acao de admin/master;
- manter homologacao e producao separadas;
- validar se a aplicacao Efi esta com a API correta habilitada antes de testar.

## Autenticacao API Cobrancas

Usada para boleto e recursos da API Cobrancas.

Endpoint:

```http
POST {COBRANCAS_BASE_URL}/v1/authorize
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/json
```

Body:

```json
{
  "grant_type": "client_credentials"
}
```

Resposta esperada:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "..."
}
```

Uso posterior:

```http
Authorization: Bearer {access_token}
```

## Autenticacao API Pix

Usada para Pix imediato.

Endpoint:

```http
POST {PIX_BASE_URL}/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/json
```

Body:

```json
{
  "grant_type": "client_credentials"
}
```

Observacao:

- a API Pix usa certificado da aplicacao. No Node, enviar o certificado no agente HTTPS, por exemplo `pfx` e `passphrase`.

## Gerar boleto

Endpoint Efi:

```http
POST {COBRANCAS_BASE_URL}/v1/charge/one-step
Authorization: Bearer {access_token}
Content-Type: application/json
```

Payload recomendado:

```json
{
  "items": [
    {
      "name": "Assinatura mensal",
      "value": 20000,
      "amount": 1
    }
  ],
  "metadata": {
    "custom_id": "invoice_internal_id",
    "notification_url": "https://billing.seudominio.com.br/api/webhooks/efi/charges"
  },
  "payment": {
    "banking_billet": {
      "expire_at": "2026-07-29",
      "customer": {
        "name": "Cliente Exemplo",
        "cpf": "00000000000",
        "email": "cliente@example.com",
        "phone_number": "27999999999",
        "address": {
          "street": "Rua Exemplo",
          "number": "123",
          "neighborhood": "Centro",
          "zipcode": "29000000",
          "city": "Vitoria",
          "state": "ES",
          "complement": "Sala 1"
        }
      },
      "configurations": {
        "days_to_write_off": 30
      },
      "message": "Assinatura da plataforma"
    }
  }
}
```

Para CNPJ, trocar `name` e `cpf` por:

```json
{
  "juridical_person": {
    "corporate_name": "Empresa Exemplo LTDA",
    "cnpj": "00000000000000"
  }
}
```

Dados obrigatorios antes de chamar a Efi:

- nome ou razao social;
- CPF com 11 digitos ou CNPJ com 14 digitos;
- e-mail;
- telefone com DDD;
- rua;
- numero;
- bairro;
- CEP com 8 digitos;
- cidade;
- UF com 2 letras.

Resposta importante para salvar:

```json
{
  "charge_id": 123456789,
  "status": "waiting",
  "barcode": "codigo_ou_linha_digitavel",
  "link": "https://...",
  "billet_link": "https://...",
  "pdf": {
    "charge": "https://..."
  },
  "pix": {
    "qrcode": "...",
    "qrcode_image": "..."
  }
}
```

Salvar na fatura:

- `provider = efi`
- `providerChargeId = charge_id`
- `paymentMethod = boleto`
- `status = pending`
- `paymentUrl = billet_link || link || pdf.charge`
- `boletoBarcode = barcode`
- `boletoPdfUrl = pdf.charge`
- `pixCopyPaste = pix.qrcode`, se vier Bolix
- `pixQrCodeImage = pix.qrcode_image`, se vier Bolix
- `providerPayload`, com retorno resumido e request interno sem secrets.

## Gerar Pix imediato

Endpoint Efi:

```http
POST {PIX_BASE_URL}/v2/cob
Authorization: Bearer {access_token}
Content-Type: application/json
```

Payload recomendado:

```json
{
  "calendario": {
    "expiracao": 86400
  },
  "valor": {
    "original": "200.00"
  },
  "chave": "sua-chave-pix",
  "solicitacaoPagador": "Assinatura mensal"
}
```

Resposta importante:

```json
{
  "txid": "...",
  "loc": {
    "id": 123
  }
}
```

Depois buscar QR Code:

```http
GET {PIX_BASE_URL}/v2/loc/{locId}/qrcode
Authorization: Bearer {access_token}
```

Salvar:

- `txId`
- `providerLocationId`
- `pixCopyPaste = qrcode`
- `pixQrCodeImage = imagemQrcode`
- `paymentUrl = linkVisualizacao`, se vier.

## Webhook de boleto/API Cobrancas

Endpoint publico da ferramenta:

```http
POST /api/webhooks/efi/charges
```

A Efi envia um token de notificacao. Aceitar estes nomes por compatibilidade:

```json
{
  "notification": "token"
}
```

Tambem aceitar:

- `token`
- `notification_token`

Fluxo:

1. Receber token.
2. Autenticar na API Cobrancas.
3. Consultar:

```http
GET {COBRANCAS_BASE_URL}/v1/notification/{token}
Authorization: Bearer {access_token}
```

4. Pegar o evento mais recente.
5. Localizar fatura por `custom_id` ou `identifiers.charge_id`.
6. Atualizar status interno.

Mapeamento sugerido:

- Efi `paid` ou `settled` -> fatura `paid`
- Efi `waiting`, `new` ou `link` -> fatura `pending`
- Efi `unpaid` -> fatura `overdue` se vencida, senao `pending`
- Efi `canceled` ou `cancelled` -> fatura `canceled`
- Efi `expired` -> fatura `expired`
- Efi `refunded`, `chargeback` ou `contested` -> fatura `failed`

Quando virar `paid`:

- preencher `paidAt`;
- atualizar assinatura/cliente para `active`, se estava bloqueado por atraso;
- disparar webhook interno para o sistema de origem.

## Webhook Pix

Endpoint publico da ferramenta:

```http
POST /api/webhooks/efi/pix
```

Payload esperado:

```json
{
  "pix": [
    {
      "txid": "...",
      "horario": "2026-07-17T10:00:00Z"
    }
  ]
}
```

Fluxo:

1. Para cada item em `pix`, localizar fatura por `txId`.
2. Marcar como `paid`.
3. Preencher `paidAt`.
4. Liberar assinatura/cliente se estava bloqueado.
5. Disparar webhook interno para o sistema de origem.

## Modelo de banco sugerido

Tabela `billing_provider_configs`:

- `id`
- `provider`: `efi`
- `environment`: `homologation` ou `production`
- `active`
- `client_id`
- `encrypted_client_secret`
- `pix_key`
- `cert_path`
- `encrypted_cert_passphrase`
- `metadata`
- `created_at`
- `updated_at`

Tabela `billing_accounts`:

- `id`
- `external_system`: `saas`, `ticketz`, `manual`, etc.
- `external_account_id`
- `name`
- `document`
- `email`
- `phone`
- `street`
- `number`
- `neighborhood`
- `complement`
- `city`
- `state`
- `zipcode`
- `status`
- `created_at`
- `updated_at`

Tabela `billing_invoices`:

- `id`
- `billing_account_id`
- `external_system`
- `external_invoice_id`
- `idempotency_key`
- `detail`
- `status`: `open`, `pending`, `paid`, `overdue`, `canceled`, `expired`, `failed`
- `value`
- `currency`
- `due_date`
- `payment_method`: `pix`, `boleto`, `manual`
- `provider`: `efi`, `manual`
- `provider_charge_id`
- `provider_location_id`
- `tx_id`
- `payment_url`
- `pix_copy_paste`
- `pix_qr_code_image`
- `boleto_barcode`
- `boleto_pdf_url`
- `provider_payload`
- `provider_error`
- `paid_at`
- `created_at`
- `updated_at`

Tabela `billing_events`:

- `id`
- `invoice_id`
- `provider`
- `event_type`
- `payload`
- `created_at`

## API sugerida da ferramenta central

Criar conta/pagador:

```http
POST /api/billing/accounts
```

```json
{
  "externalSystem": "ticketz",
  "externalAccountId": "company_123",
  "name": "Cliente Exemplo",
  "document": "00000000000",
  "email": "cliente@example.com",
  "phone": "27999999999",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "complement": "Sala 1",
    "city": "Vitoria",
    "state": "ES",
    "zipcode": "29000000"
  }
}
```

Criar fatura:

```http
POST /api/billing/invoices
Idempotency-Key: ticketz-company_123-2026-07
```

```json
{
  "billingAccountId": "uuid",
  "externalSystem": "ticketz",
  "externalInvoiceId": "ticketz_invoice_123",
  "detail": "Assinatura mensal",
  "value": 200.0,
  "currency": "BRL",
  "dueDate": "2026-07-29",
  "paymentMethod": "boleto"
}
```

Gerar Pix:

```http
POST /api/billing/invoices/{id}/pix
```

Gerar boleto:

```http
POST /api/billing/invoices/{id}/boleto
```

Consultar fatura:

```http
GET /api/billing/invoices/{id}
GET /api/billing/invoices?externalSystem=ticketz&externalInvoiceId=ticketz_invoice_123
```

Marcar pagamento manual:

```http
POST /api/billing/invoices/{id}/mark-paid
```

Webhook para sistemas consumidores:

```http
POST {consumerWebhookUrl}
```

```json
{
  "event": "invoice.paid",
  "invoiceId": "uuid",
  "externalSystem": "ticketz",
  "externalInvoiceId": "ticketz_invoice_123",
  "billingAccountId": "uuid",
  "status": "paid",
  "paidAt": "2026-07-17T10:00:00.000Z",
  "provider": "efi",
  "providerChargeId": "123456789"
}
```

## Regras importantes

- usar `idempotency_key` para nao duplicar fatura mensal;
- usar `custom_id` da Efi com o ID interno da fatura;
- sempre configurar `notification_url` ao gerar boleto;
- separar financeiro operacional do cliente e cobranca da plataforma;
- deixar a ferramenta de cobranca como dona do status de pagamento;
- sistemas consumidores devem reagir a `invoice.paid`, `invoice.overdue`, `invoice.canceled`;
- bloquear/desbloquear acesso deve ser decisao do sistema consumidor, com base no evento da ferramenta;
- guardar payloads da Efi para auditoria, mas sem secrets;
- logs devem esconder CPF/CNPJ completo, token, certificado e links sensiveis.

## Checklist de homologacao

1. Criar aplicacao Efi em homologacao.
2. Habilitar API Cobrancas/Emissoes.
3. Habilitar API Pix, se for usar Pix.
4. Cadastrar credenciais em ambiente de teste.
5. Cadastrar certificado Pix, se usar Pix.
6. Criar conta/pagador teste.
7. Criar fatura teste.
8. Gerar boleto.
9. Conferir se salvou `charge_id`, `barcode`, `payment_url` e `boleto_pdf_url`.
10. Gerar Pix.
11. Conferir se salvou `txId`, QR e copia-e-cola.
12. Testar `POST /api/webhooks/efi/charges` com corpo vazio para validar roteamento publico.
13. Testar pagamento/baixa no ambiente Efi.
14. Confirmar se a fatura virou `paid`.
15. Confirmar se o sistema consumidor recebeu `invoice.paid`.

## Checklist de producao

1. Trocar credenciais para producao.
2. Confirmar base URL de producao.
3. Confirmar webhook publico com HTTPS valido.
4. Confirmar escopos ativos na aplicacao Efi.
5. Fazer cobranca real de baixo valor.
6. Conferir baixa automatica.
7. Conferir logs sem secrets.
8. Conferir idempotencia de fatura mensal.
9. Conferir rotina de vencimento/atraso.
10. Conferir liberacao manual de suporte.
