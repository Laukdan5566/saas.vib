# Incidente 2026-06-19 - Pizzaria Big Burguer, WhatsApp/n8n/impressao

## Contexto

Teste real na Pizzaria Big Burguer na noite de 2026-06-19. Relato: com mais de 3 clientes ao mesmo tempo, o atendimento "travou".

Levantamento feito no servidor em 2026-06-19/2026-06-20, olhando Docker, Ticketz, n8n, SaaS e banco.

## Estado dos containers no momento da coleta

- `vib-saas-platform-backend-1`: ativo, sem restart, sem OOM.
- `vib-saas-platform-frontend-1`: ativo, sem restart, sem OOM.
- `ticketz-docker-acme-backend-1`: ativo, sem restart, sem OOM.
- `n8n-docker-n8n-1`: ativo, sem OOM, mas tinha sido reiniciado manualmente/por deploy cerca de 54 min antes da coleta.

Uso de memoria no momento estava normal:

- SaaS backend: cerca de 42 MiB.
- Ticketz backend: cerca de 232 MiB.
- n8n: cerca de 335 MiB.

## Achados principais

### 1. Tickets recentes entraram sem fila no Ticketz

Este foi o ponto mais importante.

Quando o atendimento funcionava com IA, as mensagens apareciam no Ticketz com `queueId=4`, que e a fila `Recepcao` da empresa 6.

Depois, no teste real, varios tickets passaram a aparecer com `queueId=NULL`:

- ticket 333: mensagens as 21:21-21:24, `queueId=NULL`;
- ticket 334: mensagem as 21:21, `queueId=NULL`;
- ticket 335: mensagens as 21:22-21:23, `queueId=NULL`;
- ticket 336: mensagens as 21:36, `queueId=NULL`;
- ticket 337: mensagens as 21:38-21:39, `queueId=NULL`;
- ticket 338: mensagem as 21:42, `queueId=NULL`;
- ticket 339: varias mensagens entre 21:42 e 21:50, `queueId=NULL`;
- ticket 340: mensagens as 21:42-21:43, `queueId=NULL`;
- ticket 341: mensagem as 21:43, `queueId=NULL`.

Evidencia forte:

- antes, as mensagens de 19:33-19:37 estavam com `queueId=4` e o n8n respondeu normalmente;
- depois, a partir de 21:21, as mensagens entraram sem fila e nao dispararam o workflow da recepcao.

Conclusao provavel: o "travamento" percebido como IA parada foi, na pratica, ticket entrando fora da fila `Recepcao`, entao o webhook do n8n nao era chamado.

### 2. Fila `Recepcao` existe e tem webhook n8n

No Ticketz:

- fila `Recepcao`, id `4`, companyId `6`;
- `n8nWebhookEnabled=true`;
- webhook configurado: `http://11.88.88.8:5678/webhook/vib/recepcao/pizzaria-big-burguer/6/ticketz`.

Mas a tabela `WhatsappQueues` tinha somente:

- `whatsappId=1`, `queueId=1`.

Nao havia vinculo da conexao da Pizzaria Big Burguer com a fila `Recepcao`.

Conexoes vistas:

- `id=8`, `Pizzaria Big Burguer`, `CONNECTED`, `companyId=6`, default;
- `id=9`, `big burguer teste`, `CONNECTED`, `companyId=6`, nao default.

Acerto necessario: garantir que toda conexao WhatsApp da empresa 6 tenha fila padrao `Recepcao` ou que tickets novos sejam enviados automaticamente para essa fila.

### 3. n8n nao recebeu execucoes depois de 21:13

No banco do n8n, as execucoes recentes do workflow `Vib - Pizzaria Big Burguer - Recepcao IA` estavam todas com `status=success`, mas a mais recente era:

- `2026-06-19 21:12:55-03`, status `success`.

Depois disso, os tickets do Ticketz continuaram existindo, mas sem `queueId=4`, entao o webhook nao foi acionado.

Tambem apareceu no log do n8n:

- `Task rejected by Runner with reason "Offer expired - not accepted within validity window"`;
- `Database connection timed out`, seguido de `Database connection recovered`;
- `Received request for unknown webhook: POST vib/recepcao/pizzaria-big-burguer/6/ticketz is not registered`.

Observacao: o erro de "unknown webhook" pode ocorrer quando o workflow estava inativo/reiniciando ou quando a rota nao estava registrada naquele instante. Nao foi a evidencia principal do travamento, mas deve ficar no radar.

### 4. Ticketz teve reconexoes e erros Baileys

Logs do Ticketz mostram instabilidade/reconexao em conexoes WhatsApp:

- `Stream Errored (restart required)`;
- `Connection Closed`;
- `Timed Out`;
- `unexpected error in init queries`;
- `Another session with the same jid/lid detected`;
- `ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client`.

Isso aconteceu principalmente em horarios proximos a reconectar/testar conexoes:

- por volta de 21:16;
- por volta de 21:20;
- por volta de 21:35.

Acerto necessario: revisar conexoes duplicadas e nao manter duas sessoes WhatsApp da mesma loja/numero ativas ao mesmo tempo.

### 5. Impressao tambem teve erro pontual

No SaaS, `print_jobs` tinha:

- 10 `printed`;
- 5 `failed`.

Erros recentes:

- `Nenhuma impressora Windows abriu. Tentativas: ['POSPrinterPOS80']. Ultimo erro: (1801, 'OpenPrinter', 'O nome da impressora ...')`.

Depois disso houve jobs impressos com sucesso as 22:23, 22:28 e 22:36.

Conclusao: a impressao nao estava totalmente parada, mas houve falha quando o nome da impressora local `POSPrinterPOS80` nao abriu no Windows. Verificar nome exato da impressora no PC da pizzaria e config do agente.

### 6. Notificacoes outbound do SaaS tiveram erro de permissao

Em `message_logs`, algumas mensagens outbound do SaaS ficaram com:

- `{"error":"Acesso nao permitido"}`.

Ocorreu em mensagens de aceite de pedido por volta de:

- 22:22;
- 22:28;
- 22:36.

Acerto necessario: revisar token/permissao da chamada do SaaS para Ticketz, principalmente envio de mensagens automaticas pos-aceite.

## Hipotese mais provavel do travamento

O gargalo principal do atendimento nao parece ter sido CPU/memoria nem queda do SaaS.

A falha principal parece ser fluxo/roteamento:

1. cliente entra pelo WhatsApp;
2. Ticketz cria ticket sem `queueId`;
3. sem `queueId=4`, o webhook n8n da fila `Recepcao` nao dispara;
4. a IA nao responde;
5. com varios clientes, isso parece "travamento" operacional.

Em paralelo, houve instabilidade Baileys/reconexao e possivel duplicidade de sessao, o que pode piorar o comportamento.

## Proximos acertos sugeridos

1. Vincular `Whatsapps.id=8` (`Pizzaria Big Burguer`) na fila `Recepcao` (`queueId=4`) em `WhatsappQueues`. Feito em 2026-06-19.
2. Verificar se a tela/admin do Ticketz tambem precisa marcar essa fila na conexao, para nao ficar so via banco. Parcialmente coberto pelo fallback em codigo.
3. Criar uma regra defensiva no Ticketz custom: se a empresa for a Pizzaria/empresa SaaS e o ticket novo vier sem fila, atribuir automaticamente a fila `Recepcao`. Feito em 2026-06-19 no fonte Ticketz.
4. Criar monitor simples:
   - tickets novos com `queueId=NULL`;
   - n8n sem execucoes nos ultimos X minutos;
   - Ticketz com `Stream Errored`, `Timed Out`, `Another session with the same jid/lid detected`.
5. Revisar limite do Ticketz:
   - `REDIS_OPT_LIMITER_MAX=1`;
   - `REDIS_OPT_LIMITER_DURATION=3000`.
   Esse limite e bem conservador e pode deixar envios/acoes mais lentos quando entram varios clientes juntos.
6. Revisar workflow n8n em producao:
   - garantir workflow ativo;
   - evitar nodes lentos bloqueando resposta;
   - se necessario, separar recepcao rapida e processamento pesado.
7. Ajustar impressora local:
   - conferir nome exato no Windows;
   - atualizar config do agente;
   - registrar log local do agente em arquivo.
8. Revisar permissao/token do SaaS para enviar mensagem no Ticketz quando pedido e aceito.

## Correcao aplicada em 2026-06-19

1. Banco Ticketz:
   - associada a conexao `Pizzaria Big Burguer` (`whatsappId=8`) a fila `Recepcao` (`queueId=4`);
   - associada tambem a conexao `big burguer teste` (`whatsappId=9`) a fila `Recepcao` (`queueId=4`).
2. Codigo Ticketz custom:
   - alterado `backend/src/services/TicketServices/FindOrCreateTicketService.ts`;
   - criado fallback `resolveFallbackQueueId`;
   - quando o ticket chega sem fila explicita, o servico tenta:
     - usar a fila explicita recebida;
     - usar a fila unica vinculada ao WhatsApp;
     - se ainda faltar fila, usar a primeira fila da empresa com `n8nWebhookEnabled=true` e `n8nWebhookUrl` preenchido;
   - se um ticket existente estiver sem fila e chegar nova mensagem, o servico atualiza `queueId` automaticamente.
3. Deploy:
   - rebuild da imagem `fp-ticketz-custom-local-backend:latest`;
   - recriado container `ticketz-docker-acme-backend-1`.
4. Validacao:
   - backend Ticketz subiu e reconectou sessoes;
   - `Pizzaria Big Burguer` e `big burguer teste` ficaram `CONNECTED`;
   - tickets novos da empresa 6 apareceram com `queueId=4`;
   - nao havia tickets `open` ou `pending` da empresa 6 com `queueId=NULL` apos a correcao;
   - smoke test de 5 chamadas paralelas ao webhook n8n retornou HTTP `200` nas 5 chamadas;
   - execucoes n8n `412` a `416` ficaram `success`, iniciadas praticamente no mesmo segundo.

## Comandos usados para diagnostico

Principais consultas usadas:

```bash
docker ps
docker stats --no-stream
docker inspect -f 'RestartCount={{.RestartCount}} StartedAt={{.State.StartedAt}} OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}' <container>
docker logs --since 8h <container>
```

Consultas SQL principais:

```sql
select id, name, status, "isDefault", "companyId", "updatedAt" from "Whatsapps" order by id;
select id, name, "companyId", "n8nWebhookEnabled", "n8nWebhookUrl" from "Queues" order by id;
select * from "WhatsappQueues" order by 1,2;
select "createdAt", "ticketId", "fromMe", "queueId", body from "Messages" order by "createdAt" desc limit 80;
select status, count(*) from print_jobs group by status order by status;
select created_at, status, type, attempts, error_message from print_jobs order by created_at desc limit 20;
select created_at, direction, content, n8n_error_message from message_logs order by created_at desc limit 40;
select * from execution_entity order by "startedAt" desc limit 10;
```
