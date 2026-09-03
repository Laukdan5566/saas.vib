# Correacloud SaaS

## Cobranca vencida (03/09/2026)

- Expiracao do Pix nao extingue a divida. Preserve o valor principal e o vencimento original.
- Encargos confirmados: multa unica de 2% e juros simples de 1% ao mes, pro rata em 30 dias. O backend calcula em centavos e expoe principal, multa, juros e total separadamente.
- Datas de vencimento sao datas UTC de calendario; a contagem dos dias usa America/Sao_Paulo. Nao exibir uma data UTC como o dia anterior no navegador.
- Carencia de 7 dias afeta somente o bloqueio, nao o inicio do atraso.
- Renovacao do Pix consulta a Efi antes de revisar o mesmo txid, preservando a conciliacao. Pagamento ja concluido nao pode gerar nova cobranca.
- O painel oculta links Pix expirados/desatualizados e oferece Atualizar Pix. Nao apague faturas nem marque pago para corrigir QR expirado.
- Novos boletos incluem multa de 2% e juros mensais de 1%. Emissao retroativa exige reemissao acordada; para divida ja vencida sem boleto, usar Pix atualizado. O ciclo ainda cria faturas locais, nao boletos automaticamente.
- Teste: apos build do backend, executar `node tests/billing-amounts.cjs`.
- Referencias: https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas/ e https://dev.efipay.com.br/docs/api-cobrancas/boleto/.

Repositorio principal da plataforma multitenant. Esta arvore e a fonte oficial para build e deploy; alteracoes feitas diretamente no servidor devem ser trazidas para o Git antes de qualquer rebuild.

## Estado atual

- cobranca Efí (Pix e boleto) compilada dentro do backend, com painel master e visao isolada por empresa;
- WhatsApp nativo no SaaS com QR Code, sessao persistida no Postgres, texto, imagem, audio, video, documentos, tickets, atendimento humano e n8n;
- compatibilidade temporaria com conexoes antigas do Ticketz para migracao sem parada;
- instalacao completa por Docker Compose;
- nenhum `.env`, certificado, token, dump, upload ou volume deve ser versionado.

## Instalacao Docker

1. Copie `.env.example` para `.env` apenas no servidor.
2. Troque todos os valores marcados como `replace-with...` e configure as credenciais Efí localmente.
3. Coloque os certificados em `secrets/efi/...`; essa pasta e ignorada pelo Git.
4. Execute `docker compose build --pull`.
5. Execute `docker compose up -d`.
6. Confira `docker compose ps` e `curl http://localhost:3101/api/health`.

O seed exige `SEED_ADMIN_EMAIL` e uma `SEED_ADMIN_PASSWORD` de pelo menos 12 caracteres. Dados demonstrativos so sao criados quando `SEED_DEMO_DATA=true`.

## Migracao do WhatsApp

Empresas novas recebem conexao `native` automaticamente. Para uma conexao antiga:

1. abra a empresa no painel master;
2. entre em WhatsApp;
3. clique em `Migrar para SaaS`;
4. leia o novo QR Code no aparelho da empresa;
5. valide entrada, resposta, midia, n8n e atendimento humano antes de desligar o Ticketz antigo.

A migracao nao reutiliza a sessao criptografica do Ticketz. O novo QR e proposital e evita copiar credenciais de outro sistema.

## Regra de manutencao

Nunca crie caminhos Windows em comandos executados no Linux. Um nome como `backend\\src\\billing.service.ts` vira um unico arquivo na raiz e nao e compilado. Use sempre caminhos Linux (`backend/src/billing.service.ts`) e confira com:

```bash
find . -maxdepth 1 -type f -name '*\\*'
```

O resultado deve estar vazio. Nao edite `dist/`, nao aplique patch apenas dentro de container e nao faça rebuild usando uma copia diferente deste repositorio.

## Seguranca do repositorio

Antes de commit/push, execute:

```bash
node scripts/check-repository-safety.mjs
```

Credenciais ficam somente em `.env`, no painel criptografado ou em secret manager. Certificados Efí ficam no volume local `secrets/`.

---

# Historico do projeto

Projeto novo para uma plataforma SaaS multitenant integrada ao Ticketz/Whaticket e n8n, com foco inicial em restaurantes delivery e barbearias.

Este README deve ser mantido como documento vivo do projeto. Sempre que o Codex fizer uma mudanca relevante, atualizar:

- o que foi feito;
- onde foi feito;
- como rodar/testar;
- proximos passos;
- decisoes importantes.

Nao salvar senhas, tokens ou chaves reais neste arquivo.

## Status atual

Ambiente MVP criado, dockerizado e publicado no servidor.

Servidor:

- SaaS publico: `https://saas.correacloud.com.br`
- SaaS API publica: `https://saas.correacloud.com.br/api`
- Vib Chat publico: `https://vib.correacloud.com.br`
- Vib Chat backend publico: `https://vib.correacloud.com.br/backend`
- n8n publico: `https://n8n.correacloud.com.br`
- SaaS frontend interno: `http://11.88.88.8:8090`
- SaaS backend interno: `http://11.88.88.8:3101`
- n8n interno: `http://11.88.88.8:5678`

Pastas no servidor:

- SaaS: `/home/chat/vib-saas-platform`
- n8n: `/home/chat/n8n-docker`
- Vib Chat/Ticketz custom em producao: `/home/chat/ticketz-docker-acme`
- Fonte Vib Chat/Ticketz custom: `/home/chat/fp-ticketz-custom-local`

Login seed do SaaS:

- Email: `admin@example.com`
- senha inicial de desenvolvimento: `admin123`; nao usar em producao sem troca imediata.

Cardapio publico Big Burguer:

- URL: `https://saas.correacloud.com.br/cardapio/pizzaria-big-burguer`
- URL garcom/salao: `https://saas.correacloud.com.br/garcom/pizzaria-big-burguer`
- API publica: `GET /api/public/pizzaria-big-burguer/menu`
- Fluxo principal: `frontend/src/public-menu.tsx`

Decisao operacional:

- o cardapio/pedidos passam a rodar direto no servidor `/home/chat/vib-saas-platform`;
- o PC local do Bruno deixa de ser usado como servidor de producao para cardapio/pedidos;
- o PC local pode continuar sendo usado apenas para desenvolvimento/testes quando necessario.

Sincronizacao de fonte (verificado em 2026-08-08):

- a copia local no Nextcloud e a copia publicada no servidor nao estao completamente sincronizadas;
- o arquivo de producao `frontend/src/main.tsx` possui o modulo atual de atendimento WhatsApp e esta mais avancado que a copia local;
- nao copiar nem publicar o `main.tsx` local sobre o servidor ate reconciliar as fontes, para nao apagar alteracoes feitas por outro colaborador;
- antes de qualquer ajuste nesse modulo, usar a versao atual em `/home/chat/vib-saas-platform/frontend/src/main.tsx` como referencia e limitar o deploy aos arquivos efetivamente alterados;
- prioridade operacional: criar repositorio Git privado e definir um fluxo unico de branch/commit/deploy para eliminar essa divergencia.

Estado operacional verificado em 2026-08-07:

- pagina publica, API publica e `GET /api/health` responderam HTTP `200`;
- containers `postgres`, `backend` e `frontend` estavam em execucao; PostgreSQL com health-check saudavel;
- a Big Burguer estava com `acceptOrders=false`; esse estado e configuravel no painel e bloqueia novos pedidos publicos enquanto estiver ativo;
- nao existe repositorio Git nem na copia local nem na pasta de producao; os snapshots nao substituem controle de versao;
- o deploy atual e feito por SSH no usuario `chat`, envio dos arquivos alterados e rebuild com `docker compose up --build -d frontend`.

Backup e restauracao:

- snapshots de codigo ficam em `/home/chat/.codex-backups/`;
- eles incluem os arquivos do projeto, mas nao incluem os volumes Docker `postgres_data` e `backend_uploads`;
- portanto, nao sao backup completo de pedidos, clientes, banco de dados ou imagens enviadas;
- como snapshots antigos podem conter `.env`, eles devem ter permissao restrita e nao devem ser copiados ou compartilhados sem auditoria;
- antes de alteracoes relevantes, criar snapshot de codigo; para recuperacao real, manter tambem backup versionado do PostgreSQL e dos uploads;
- nao registrar senhas, chaves ou valores de `.env` neste README.

## Atualizacoes recentes

### 2026-08-15 - Acesso avancado ao Vib por SSO (publicado)

- corrigido o botao `Avancado` do painel WhatsApp: o token SSO agora e criado no instante do clique;
- antes, o link era criado ao abrir a tela e expirava apos dois minutos, causando `ERR_SAAS_SSO_INVALID` quando usado depois;
- a nova janela continua abrindo o painel completo do Vib/Ticketz ja autenticado para a empresa selecionada.

### 2026-08-08 - Suavidade visual do cardapio publico (publicado)

- adicionada transicao curta de entrada ao trocar entre as telas do cardapio, mantendo a navegacao imediata;
- botoes e cards agora respondem ao toque com retorno visual discreto, incluindo foco acessivel por teclado;
- a tela inicial de carregamento ganhou indicador animado; navegadores com preferencia por menos movimento nao recebem animacoes.

### 2026-08-08 - Acompanhamento de pedido pelo WhatsApp (publicado)

- corrigida a consulta publica usada pelo Ticketz ao receber mensagens como `quero acompanhar meu pedido`;
- ela agora reconhece o mesmo telefone salvo com ou sem o prefixo internacional `55`, evitando que pedidos recentes aparecam como inexistentes;
- nenhuma informacao de pedido foi alterada: a correcao atua somente na busca pelo telefone do proprio cliente.

### 2026-08-08 - Atalhos de categorias no cardapio Big Burguer (publicado)

- a tela inicial passou a mostrar, nesta ordem, os atalhos `Pizzas`, `Refrigerantes`, `Sucos` e `Adicionais`;
- refrigerantes, sucos e adicionais abrem paginas separadas, usando somente produtos ativos e disponiveis publicamente na respectiva categoria pelo painel do SaaS;
- foi criada na Big Burguer a categoria ativa `Adicionais`, destinada a itens como sache de maionese caseira; nenhum produto ou preco foi inventado;
- enquanto uma categoria nao tiver item ativo, seu atalho permanece visivel, mas desativado. Assim o painel continua sendo a fonte de verdade para liberar a venda.

### 2026-08-08 - Navegacao inferior de pedidos (publicado)

- removido o botao flutuante da sacola no cardapio publico;
- a navegacao inferior do cliente passa a seguir a ordem `Inicio`, `Pedido` e `Historico`;
- `Pedido` abre o checkout e exibe a quantidade de itens adicionados; fica inativo enquanto estiver vazio;
- o botao flutuante permanece apenas na tela de garcom/comanda, que tem fluxo operacional diferente.

### 2026-08-08 - Novo banner da tela inicial da Big Burguer (publicado)

- substituido o banner anterior da tela inicial pelo material visual criado para a Big Burguer;
- o banner preserva a proporcao em computador e celular como elemento visual da tela inicial;
- a arte fica restrita ao slug `pizzaria-big-burguer`, sem interferir nos cardapios de outras empresas.
- adicionado um segundo card promocional de entrega logo abaixo dos atalhos iniciais; a imagem permanece inteira em telas mobile e desktop.
- simplificado o cabecalho publico: removido fundo branco, prazo medio de entrega e compartilhamento; permanecem logo, nome e status `Aberta` ou `Fechada`, inclusive em mobile.

### 2026-08-08 - Persistencia do pedido no cardapio publico (publicado)

- a sacola do cliente e a ultima tela acessada passam a ser salvas no armazenamento local do navegador, separadas por empresa/cardapio;
- apos atualizar a pagina, o cliente retorna ao checkout, pedidos, pizzas ou bebidas onde estava, em vez de voltar obrigatoriamente para a tela inicial;
- o ultimo pedido criado tambem e mantido neste navegador para que a tela de acompanhamento continue disponivel apos o refresh;
- se a sacola estiver vazia, o checkout volta para a tela inicial para evitar uma tela de fechamento sem itens.

### 2026-08-08 - Confirmacao ao copiar chave Pix (publicado)

- o botao `Copiar chave Pix` agora muda para `Chave copiada!` e mostra uma confirmacao visual por alguns segundos;
- se o navegador bloquear a area de transferencia, o cliente recebe a orientacao para copiar a chave manualmente.

### 2026-08-07 - Ajuste visual do atendimento WhatsApp no SaaS (publicado)

- anexos de imagem no atendimento agora usam visualizacao limitada e proporcional, sem ocupar todo o painel da conversa;
- anexos de audio, arquivos e o seletor de arquivo receberam layout adequado no compositor;
- painel lateral de automacao, status da conexao e acoes de atendimento foi organizado para evitar botoes e textos comprimidos.

### 2026-08-07 - Clareza de itens e precificacao no cardapio publico (publicado)

- ao adicionar uma bebida, o respectivo card recebe estado visual de selecao e a mensagem `Adicionado ao pedido`;
- a caixa de observacoes fica na etapa de escolha dos sabores, antes da escolha do tamanho;
- ao selecionar um tamanho, abre um resumo compacto na mesma pagina com o total real da pizza, considerando os sabores escolhidos, e a acao para adicionar ao pedido;
- foi removido o texto `A partir de` desse fluxo para evitar que o cliente interprete um valor inicial como o preco final da pizza.
- o titulo exibido na aba do navegador e no compartilhamento agora usa o formato `Cardápio | Nome da empresa`.
- reduzido o espaco entre as observacoes e o botao para seguir aos tamanhos no fluxo de pizza.

### 2026-08-07 - Fluxo manual de pagamento Pix no cardapio publico (publicado)

- ao selecionar `Pix` e avancar no checkout, o cliente ve a chave Pix configurada para a empresa, com botao para copiar;
- exibida a orientacao: `Envie o comprovante do Pix no nosso WhatsApp para confirmar seu pedido.`;
- adicionado botao para voltar e escolher outro metodo antes de criar o pedido;
- pagamento na entrega oferece cartao, dinheiro ou Pix na maquina;
- ao avancar com Pix, a tela rola suavemente ate o cartao de pagamento em vez de voltar para o inicio do checkout;
- a chave vem da instrucao da forma de pagamento Pix ativa no painel, sem ser gravada no frontend;
- enquanto a chave nao for cadastrada no painel, o envio por Pix fica bloqueado e o cliente pode escolher outro metodo.

### 2026-08-07 - Revisao tecnica e operacional (sem alteracoes de codigo)

Confirmado:

- aplicacao publicada e saudavel nas verificacoes HTTP e Docker;
- arquitetura atual: React/Vite no frontend, NestJS/Prisma no backend e PostgreSQL em Docker;
- o menu publico recalcula produto, adicionais e preco no backend antes de criar pedidos, reduzindo risco de manipulacao de valores pelo navegador.

Pontos prioritarios identificados:

- criar repositorio Git privado e definir fluxo de branch, commit, revisao e deploy;
- implantar backup diario do PostgreSQL e do volume de uploads, com teste de restauracao;
- proteger os arquivos de backup, excluindo `.env`/segredos e usando permissoes restritas;
- remover senhas padrao, exigir `JWT_SECRET` configurado e endurecer CORS/validacao das APIs;
- proteger a consulta publica de pedidos com token ou OTP, em vez de depender apenas do telefone;
- criar testes automatizados para pedido, pizza, permissoes, impressao e integracoes;
- separar arquivos grandes do frontend e do backend por dominio antes de expandir modulos como promocoes/combos.

### 2026-08-06 - Fluxo de pizza: sabores antes do tamanho (publicado)

- alterado o cardapio publico para escolher primeiro de 1 a 2 sabores e, em seguida, o tamanho da pizza;
- os sabores sao associados ao tamanho selecionado pelo nome, preservando os IDs e precos corretos daquele tamanho;
- criado snapshot pre-publicacao em `/home/chat/.codex-backups/vib-saas-platform-20260806-193440.tar.gz`;
- build e publicacao do frontend concluidos; pagina e API publica responderam HTTP `200`.

### 2026-08-06 - Snapshot de codigo do projeto no servidor

- criado backup versionado em `/home/chat/.codex-backups/vib-saas-platform-20260806-174958.tar.gz`;
- checksum SHA-256: `d6abd575c483a03da05aab3bbdfed4eb065d924f3196ab4604406a7d76fe0f73`;
- inclui codigo, configuracoes, Prisma e documentacao;
- exclui dependencias compiladas (`node_modules`/`dist`) e certificados protegidos em `secrets/efi`.
- nao inclui os volumes Docker de PostgreSQL nem de uploads; nao e backup completo dos dados operacionais.

### 2026-08-06 - Removidos retornos para a tela antiga do cardapio (publicada)

- revisados os retornos das paginas de pizzas, sabores, checkout e pedidos;
- todos voltam agora para a nova tela inicial principal;
- removido o caminho de retorno para a tela antiga na experiencia do cliente;
- validado no site publico com pagina/API HTTP `200`.

### 2026-08-06 - Tela inicial com categorias de pizzas e refrigerantes (publicada)

- mantida a tela inicial como entrada principal do cliente;
- removido o destaque da tela antiga de cardapio na entrada;
- adicionados atalhos lado a lado para `Pizzas` e `Refrigerantes`;
- aplicados icones de pizza e refrigerante nos atalhos;
- cada atalho direciona diretamente para sua pagina de categoria;
- validado no site publico com pagina/API HTTP `200`.

### 2026-08-06 - Paginas separadas de pizzas e bebidas (publicada)

- `Pizzas` e `Bebidas` agora abrem paginas proprias no cardapio publico;
- cada pagina possui cabecalho com voltar, produtos filtrados e preserva o fluxo de adicionar ao pedido;
- publicado via rebuild do frontend e validado com pagina/API HTTP `200`.

### 2026-08-06 - Tela inicial mobile do cardapio (publicada)

O que foi feito:

- adicionada uma tela inicial do cardapio publico com chamada principal, botao para abrir o cardapio e acompanhamento de pedidos;
- mantida a barra inferior do cliente somente com `Inicio` e `Pedidos`, conforme decisao visual;
- mantida a navegacao existente de categorias e o fluxo de checkout;
- adicionados atalhos visuais de categorias na tela inicial;
- preservados os componentes de portal/login do cliente recuperados do backup `customer-availability-20260720181758`.

Validacao:

- TypeScript sem erros;
- build de producao local concluido com sucesso.
- publicado no servidor `/home/chat/vib-saas-platform` via rebuild do frontend;
- validado site publico com HTTP `200`, API publica com HTTP `200` e bundle contendo `publicHomeHero`, `menuQuickNav` e `CustomerPortal`.

Proximos passos:

- modelar no backend/painel o cadastro de promocoes e combos, com preco, validade, produtos e ativacao.

### 2026-08-01 - Atalhos de categorias no cardapio publico (publicado; evoluido em 2026-08-06)

Objetivo:

- facilitar a navegacao do cliente pelo cardapio online, com atalhos visiveis para `Pizzas`, `Bebidas` e `Adicionais`.

O que foi feito localmente:

- adicionado grupo de botoes de navegacao no cardapio publico e na tela de garcom;
- cada botao faz rolagem suave para a categoria correspondente;
- os atalhos reconhecem categorias de bebidas e adicionais por nome;
- quando uma categoria nao existir no cardapio ativo, o respectivo botao aparece desativado para evitar rolagem para uma secao inexistente;
- aplicado ajuste responsivo para os atalhos funcionarem em celular.

Validacao local:

- frontend compilado com sucesso em build de producao;
- API publica da Big Burguer respondeu `200` e retornou as categorias `Pizzas`, `Refrigerantes` e `Sucos`;
- nao ha categoria `Adicionais` ativa no cardapio atual, portanto esse atalho ficara desativado ate a categoria ser criada no painel.

Publicacao:

- publicado posteriormente; o acesso SSH foi configurado por chave e a navegacao publica evoluiu para paginas separadas de pizzas e bebidas em 2026-08-06.

### 2026-07-08 - Melhorias visuais na tela de mesas

Objetivo:

- deixar a aba `Mesas` mais clara e facil de operar durante o atendimento de salao.

O que foi feito:

- adicionada faixa de resumo por status: livre, aguardando, comendo, reservada e inativa;
- melhorado o formulario de cadastro/edicao de mesas com visual de painel e acoes mais claras;
- ajustados os cards das mesas com cores por status, selo de situacao, local/capacidade e botoes de acao mais legiveis;
- melhorado o responsivo para celular, mantendo botoes grandes e cards organizados.

### 2026-07-08 - Mesas editaveis no painel da pizzaria

Objetivo:

- transformar a aba `Mesas` em uma tela gerenciavel, em vez de uma grade fixa sem edicao.

O que foi feito:

- criada tabela `restaurant_tables` no Prisma para cadastrar mesas por empresa/tenant;
- adicionado recurso `restaurantTables` ao backend generico de recursos;
- criada tela nova de mesas com formulario para adicionar/editar numero, nome, capacidade, local, status, ativo/inativo e observacoes;
- adicionadas acoes rapidas nos cards para marcar mesa como `Livre`, `Aguardando` ou `Comendo`;
- mantida a integracao visual com pedidos de mesa abertos, destacando mesa com pedido em andamento;
- adicionado botao para criar 12 mesas padrao quando a empresa ainda nao tiver mesas cadastradas.

### 2026-07-04 - Textos dos tamanhos de pizza no cardapio publico

Objetivo:

- deixar a selecao de tamanho de pizza mais clara para o cliente no cardapio publico.

O que foi feito:

- ajustado `frontend/src/public-menu.tsx` para exibir os tamanhos como `Media - 8 Fatias`, `Grande - 10 Fatias`, `Gigante - 12 Fatias` e `Maracanã - 20 Fatias`;
- removido do cardapio publico o texto sobre prevalecer maior valor;
- substituida a descricao dos cards por `Pizza com até 2 sabores. Escolha o tamanho e em seguida escolha o sabor`;
- mantida a regra interna de preco por maior sabor, sem alterar produtos, precos ou IDs do banco.

Complemento:

- ajustado o espacamento da area de observacoes na selecao de sabores para o botao de adicionar nao ficar sobre o campo de texto.
- atualizado o topo do cardapio publico com `Tempo médio de entrega: 30 a 70 Minutos.`;
- removido o bloco/botao de `Os mais pedidos` e incluida mensagem curta de boas-vindas, tradicao de mais de 20 anos e promocoes de quinta-feira.
- ajustado o resumo enviado pelo WhatsApp ao cliente para remover a linha de status/`aguardando aceite` e exibir somente resumo do pedido com tempo medio de entrega/preparo.
- corrigida a exibicao mobile das imagens dos itens do cardapio publico; as imagens deixam de ser escondidas no celular e passam a aparecer ao lado do texto.
- atualizado o viewport do frontend para bloquear zoom manual e manter a pagina em escala fixa no celular.
- corrigido o botao `Acompanhar pelo WhatsApp` para aparecer em pedidos em andamento, inclusive quando o pedido ja foi aceito automaticamente.
- ressincronizado o token da API do Ticketz entre a conexao WhatsApp `Pizzaria Big Burguer` e o SaaS; antes a API retornava `401 Acesso nao permitido`, impedindo envio de resumo/avisos.

### 2026-06-23 - Notificacoes WhatsApp no aceite e na rota

Objetivo:

- quando um pedido for aceito no painel da loja, avisar o cliente pelo WhatsApp;
- quando o pedido sair para entrega/rota, avisar o cliente pelo WhatsApp;
- manter a conversa dentro do Ticketz/WhatsApp padrao da Big Burguer, inclusive para pedidos vindos do cardapio publico.

O que foi feito:

- ajustado `backend/src/app.service.ts` no SaaS para enviar `queueId` ao Ticketz quando a notificacao precisar ser feita por telefone (`message_to_number`);
- mantido o envio direto pelo `ticketId` quando o pedido ja veio de uma conversa do Ticketz;
- aceite de pedido continua chamando `notifyCustomerOrderAccepted`;
- mudanca de status para `out_for_delivery` continua chamando `notifyCustomerOrderStatusChanged`;
- ajustado o Ticketz em `backend/src/controllers/IntegrationController.ts` para aceitar `queueId`/`queue_id` no `message_to_number` e salvar a mensagem na conversa/fila correta;
- ajustado o Ticketz em `backend/src/helpers/SendMessage.ts` para nao converter `saveOnTicket: true` em fila `1`; quando for numero, usa a fila enviada pelo SaaS;
- aplicado patch runtime no container `ticketz-docker-acme-backend-1`, porque o build da imagem do Ticketz travou quando o disco estava em 99%;
- mantido o codigo-fonte do Ticketz ja alterado em `/home/chat/fp-ticketz-custom-local` para o proximo rebuild oficial da imagem;
- liberado espaco Docker removendo cache/imagens dangling;
- rebuildado e recriado o backend SaaS `vib-saas-platform-backend`;
- validado health check em `/api/health`.

Observacao operacional:

- se alguem recriar o container do Ticketz usando a imagem antiga antes de rebuildar a imagem nova, o patch runtime pode se perder;
- o codigo-fonte ja esta ajustado, entao o caminho definitivo e rebuildar o Ticketz quando houver janela segura.

### 2026-06-25 - Correcao do envio de avisos WhatsApp pelo Ticketz

Problema:

- ao aceitar pedido ou liberar para rota, o cliente nao recebia a mensagem no WhatsApp;
- o SaaS tentava chamar `/backend/integrations/webhook` do Ticketz, mas o Ticketz retornava `401 Acesso nao permitido`;
- o token salvo no SaaS nao batia com nenhum token de conexao WhatsApp do Ticketz;
- as conexoes WhatsApp da empresa 6 no Ticketz estavam com `token` vazio.

O que foi feito:

- gerado token novo para a conexao WhatsApp conectada/default da empresa 6 no Ticketz (`big burguer teste`, id 9);
- sincronizado o mesmo token no cadastro da Big Burguer no SaaS;
- atualizado o SaaS para usar `ticketzWhatsappId = 9`, `ticketzCompanyId = 6` e `ticketzQueueId = 4`;
- ajustada a ordem dos telefones candidatos no SaaS: se o pedido vier como `5527998832209`, ele tenta primeiro `27998832209`;
- rebuildado e recriado o backend SaaS;
- health check validado em `/api/health`.

Validacao:

- chamada direta ao Ticketz com `message_to_number`, numero `27998832209` e `queueId = 4` retornou `HTTP 200`;
- o Ticketz retornou `messageId`, confirmando que o formato com DDD sem `55` funciona;
- nao havia pedido pendente do numero `27998832209` no momento da validacao, entao nao foi criado pedido artificial para evitar impressao desnecessaria.

### 2026-06-25 - Resposta automatica da recepcao Big Burguer

Objetivo:

- usar a conversa aberta do Bruno no Ticketz como referencia para deixar a resposta automatica mais natural;
- manter o direcionamento para o cardapio online, mas com texto mais curto e menos duro;
- evitar repetir taxa/preparo no primeiro contato.

O que foi feito:

- ajustado o workflow ativo do n8n `Vib - Pizzaria Big Burguer - Recepcao IA` (`K2GVMhLFIkh70Egi`);
- a resposta padrao agora cumprimenta pelo primeiro nome e envia o link do cardapio com `name` e `phone` preenchidos;
- texto novo explica em poucas linhas que o cliente escolhe pizzas, sabores, bebidas, entrega/retirada e pagamento pelo cardapio;
- respostas de status, loja fechada, midia e atendimento humano tambem foram encurtadas;
- workflow exportado novamente em `docs/n8n-workflows/vib-pizzaria-big-burguer-recepcao-ia.json`;
- n8n reiniciado para recarregar o webhook ativo.

Validacao:

- chamada simulada para `/webhook/vib/recepcao/pizzaria-big-burguer/6/ticketz` retornou `HTTP 200`;
- resposta validada para Bruno:
  `Oi, Bruno! Para fazer seu pedido, acesse nosso cardapio: ...`;
- nao foi enviada mensagem real para o WhatsApp nessa validacao.

### 2026-06-23 - Taxa de entrega Big Burguer

Problema:

- a taxa de entrega voltou a sair zerada em alguns pedidos;
- o cadastro da Big Burguer estava com `deliveryFeeDefault` salvo como `0`;
- a rota de integracao aceitava `deliveryFee: 0` e tambem podia aceitar `total` pronto vindo do fluxo, deixando a entrega fora da conta.

O que foi feito:

- ajustado `backend/src/public-menu.controller.ts` para usar taxa de entrega padrao de R$ 4,00 quando o pedido for delivery e a taxa vier vazia ou zerada;
- ajustado `backend/src/integrations.controller.ts` com a mesma regra para pedidos vindos do n8n/Ticketz;
- a integracao passou a recalcular o total no backend como `subtotal + deliveryFee - discount`, em vez de confiar no `total` enviado pelo fluxo;
- corrigido no banco o `deliveryFeeDefault` da Big Burguer para `4`;
- rebuildado e recriado o backend SaaS;
- validado `/api/public/pizzaria-big-burguer/menu`, retornando `deliveryFeeDefault: 4`;
- criado pedido teste com `deliveryFee: 0`; o backend gravou `deliveryFee: 4` e `total: 12` para um item de R$ 8,00;
- pedido teste removido logo apos a validacao para nao afetar painel/financeiro.

### 2026-06-23 - Editor de cardapio refletindo no cardapio online

Objetivo:

- permitir editar o cardapio da empresa pelo painel interno;
- permitir tirar categorias, itens e sabores do ar sem mexer no banco manualmente;
- fazer a alteracao refletir imediatamente no cardapio publico e na criacao de pedidos.

O que foi feito:

- a tela `Cardapio` dentro do painel da empresa virou uma tela propria de gerenciamento;
- adicionadas abas para `Categorias`, `Itens`, `Grupos de sabores` e `Sabores e adicionais`;
- liberadas acoes de editar, ativar/desativar, disponibilizar/indisponibilizar e remover registros;
- campos de relacao como categoria, produto e grupo passaram a aparecer como seletor com nome, em vez de exigir ID manual;
- melhorados os detalhes exibidos na tabela de cardapio para mostrar preco, ordem, status e disponibilidade;
- o cardapio publico ja filtra somente categorias ativas, produtos ativos/disponiveis e sabores ativos, entao as mudancas feitas no painel passam a surtir efeito direto.

Validacao:

- produto `Acerola` foi marcado temporariamente como indisponivel via API do painel;
- a API publica `/api/public/pizzaria-big-burguer/menu` deixou de retornar o item;
- o item foi restaurado para `active: true` e `available: true`;
- a API publica voltou a retornar o item.

### 2026-06-22 - WhatsApp direcionando para cardapio publico

Decisao operacional:

- parar de tentar fechar pedido completo pelo WhatsApp/IA;
- usar o WhatsApp como recepcao simples, status e atendimento humano;
- usar o cardapio publico como fluxo oficial de pedido, com checkout validando nome, WhatsApp, entrega/retirada, endereco e pagamento;
- manter notificacoes operacionais do SaaS: pedido aceito, saiu para entrega, rota/motoboy e impressao.

O que foi feito:

- simplificado o workflow ativo n8n `Vib - Pizzaria Big Burguer - Recepcao IA`;
- o workflow nao chama mais OpenAI para montar pedido por conversa;
- mensagens de pedido/cardapio agora respondem com link publico:
  `https://saas.correacloud.com.br/cardapio/pizzaria-big-burguer`;
- o link enviado pelo WhatsApp inclui `name` e `phone` quando o Ticketz envia esses dados, para pre-preencher o checkout;
- mensagens de status direcionam para o mesmo link com `view=orders`;
- mensagens pedindo humano recebem resposta curta e geram nota interna;
- audio/imagem/documento tambem recebem orientacao para usar o cardapio ou pedir atendente;
- atualizado `frontend/src/public-menu.tsx` para ler `name`, `phone`/`whatsapp` e `view=orders` da URL;
- checkout publico agora exige rua, numero e bairro quando o pedido for delivery;
- frontend rebuildado e recriado no container `vib-saas-platform-frontend-1`;
- workflow atualizado no n8n em `workflow_entity` e na versao ativa em `workflow_history`;
- workflow exportado para `docs/n8n-workflows/vib-pizzaria-big-burguer-recepcao-ia.json`;
- validado webhook n8n com 5 chamadas simultaneas retornando HTTP `200` e link do cardapio em todas;
- validado `GET /api/public/pizzaria-big-burguer/menu` retornando `deliveryFeeDefault: 4`;
- validado cardapio publico com query `name` e `phone` retornando HTTP `200`.

### 2026-06-21 - Botoes de rota e confirmacao detalhada no WhatsApp

O que foi feito:

- adicionado endpoint autenticado `POST /api/orders/:id/status` para o painel mudar status de pedidos;
- adicionados botoes contextuais no quadro operacional:
  - `Liberar entrega` para pedidos delivery em producao;
  - `Pronto retirada` para pedidos de retirada;
  - `Mesa servida` para pedidos de mesa;
  - `Finalizar` para pedidos prontos/em rota;
- a mensagem enviada ao aceitar pedido agora inclui resumo do pedido, itens/sabores, total, forma de pagamento e destino;
- o envio via Ticketz tenta responder primeiro pelo ticket da conversa e, se precisar usar telefone, tenta formatos com pais, sem pais e apenas os ultimos 9 digitos;
- a atualizacao de status feita pelas integracoes tambem passa pelo mesmo servico do SaaS, mantendo notificacoes automaticas;
- rebuildado e recriado `backend` e `frontend` no servidor;
- validado `GET /api/health` com `200 OK` e confirmado no bundle publicado o texto `Liberar entrega`.

### 2026-06-21 - Confirmacao WhatsApp, numero do pedido e horario

O que foi feito:

- ajustado o backend do SaaS para enviar mensagem automatica ao cliente quando o pedido for aceito no painel;
- quando o pedido vem do Ticketz/n8n, a resposta volta para o ticket da conversa; quando vem do cardapio/site, a resposta usa o telefone informado pelo cliente;
- adicionados avisos automaticos para status de rota/pronto quando o status do pedido for atualizado pelas integracoes;
- corrigida exibicao do numero do pedido para usar sequencia amigavel (`#001`, `#010`, etc.) em vez de trecho do UUID;
- aplicado o numero amigavel no painel interno, cardapio publico, historico do cliente, impressao e mensagem para motoboy;
- corrigida a impressao para registrar data/hora no fuso `America/Sao_Paulo`;
- rebuildado e recriado `backend` e `frontend` no servidor;
- validado `GET /api/health` com `200 OK` e confirmado que a API publica retorna `displayNumber` para pedidos existentes.

### 2026-06-21 - Tamanhos de pizza sem centimetros na IA

O que foi feito:

- ajustado o workflow n8n ativo `Vib - Pizzaria Big Burguer - Recepcao IA`;
- a IA continua entendendo pedidos com `30cm`, `35cm`, `40cm` e `50cm`;
- nas mensagens ao cliente, os tamanhos passam a ser exibidos como `Media - 8 fatias`, `Grande - 10 fatias`, `Gigante - 12 fatias` e `Maracana - aprox. 20 pedacos`;
- o cardapio compacto enviado para a IA tambem passou a usar nomes amigaveis sem centimetros;
- validado webhook local perguntando tamanhos e iniciando pedido de pizza.

### 2026-06-21 - Tom da IA Big Burguer

O que foi feito:

- ajustado o workflow n8n ativo `Vib - Pizzaria Big Burguer - Recepcao IA`;
- a IA continua curta e objetiva, mas agora deve responder com mais gentileza;
- adicionadas regras para evitar respostas secas, impacientes ou em tom de ordem;
- preferencias de frase ajustadas para usar cordialidade curta, como `Perfeito`, `Claro`, `Combinado` e `por favor`;
- preservadas as regras de pedido, cardapio, total, taxa, Pix e criacao no SaaS;
- validado webhook local com saudacao e envio dos cardapios.

### 2026-06-20 - Taxa fixa de entrega Big Burguer

O que foi feito:

- ajustada a Pizzaria Big Burguer para taxa fixa de entrega de R$ 4,00;
- atualizado `company_settings.delivery_fee_default` da empresa `pizzaria-big-burguer` para `4.00`;
- criada/atualizada zona ativa `Taxa fixa` em `delivery_zones` com `delivery_fee=4.00`;
- validado `GET /api/public/pizzaria-big-burguer/menu` retornando `deliveryFeeDefault: 4`;
- validado contexto interno usado pelo n8n retornando `deliveryFeeDefault: 4`;
- criado pedido teste interno via endpoint do n8n sem enviar `deliveryFee`, e o SaaS calculou subtotal `8`, entrega `4` e total `12`;
- pedido teste, cliente e endereco de teste foram removidos do banco depois da validacao.

### 2026-06-20 - Cardapio real de pizzas Big Burguer

O que foi feito:

- ajustados somente os sabores/tamanhos de pizza da `Pizzaria Big Burguer`;
- bebidas, refrigerantes e sucos nao foram alterados;
- sabores de pizza agora seguem a numeracao real do cardapio impresso:
  `01` a `09`, `11` a `22`, `24`, `25`, `27` e `28`;
- removidas da exibicao/API as numeracoes inexistentes `10`, `23` e `26`;
- precos dos 4 tamanhos foram conferidos contra a imagem do cardapio;
- sincronizado tambem o arquivo `backend/prisma/big-burguer-menu.json` para evitar retorno da numeracao antiga em futura reimportacao;
- validado no banco e em `GET /api/public/pizzaria-big-burguer/menu`.

### 2026-06-20 - Aba de motoboys editavel

O que foi feito:

- ajustada somente a aba `Entregadores/Motoboys` do painel da empresa;
- criada tela dedicada para cadastrar, editar e remover motoboys;
- campos exibidos de forma simples: nome, telefone, WhatsApp, veiculo, placa, status e disponibilidade;
- a aba continua usando o recurso multitenant `deliveryPersons` e respeita a empresa selecionada;
- frontend validado com `tsc --noEmit`, rebuildado no servidor e checado com HTTP `200`.

### 2026-06-19 - Levantamento de incidente no teste real da Pizzaria

O que foi levantado:

- criado relatorio em `docs/incidents/2026-06-19-pizzaria-travamento-whatsapp-n8n.md`;
- relato: com mais de 3 clientes ao mesmo tempo, o atendimento pareceu travar;
- containers SaaS/Ticketz/n8n estavam ativos no momento da coleta e sem OOM;
- causa mais provavel encontrada: tickets recentes da Pizzaria entraram no Ticketz com `queueId=NULL`, entao nao dispararam o webhook n8n da fila `Recepcao`;
- quando o fluxo funcionava, os tickets estavam em `queueId=4` (`Recepcao`) e o workflow respondia normalmente;
- conexao `Pizzaria Big Burguer` no Ticketz estava `CONNECTED`, mas a tabela `WhatsappQueues` nao tinha vinculo dela com a fila `Recepcao`;
- tambem foram registrados erros Baileys/reconexoes no Ticketz, tarefas rejeitadas/timeout no n8n, falhas pontuais de impressao por nome de impressora Windows e erro de permissao em algumas mensagens outbound do SaaS;
- proximos acertos sugeridos: vincular WhatsApp da empresa a fila `Recepcao`, criar regra defensiva para ticket sem fila, monitorar tickets `queueId=NULL`, revisar token de envio SaaS -> Ticketz e ajustar config da impressora local.

Correcao aplicada:

- associadas as conexoes Ticketz `Pizzaria Big Burguer` (`whatsappId=8`) e `big burguer teste` (`whatsappId=9`) a fila `Recepcao` (`queueId=4`);
- alterado Ticketz custom em `/home/chat/fp-ticketz-custom-local/backend/src/services/TicketServices/FindOrCreateTicketService.ts`;
- o Ticketz agora aplica fallback de fila quando um ticket chega sem `queueId`: fila explicita, fila unica do WhatsApp, ou primeira fila da empresa com webhook n8n ativo;
- rebuildada a imagem `fp-ticketz-custom-local-backend:latest` e recriado o container `ticketz-docker-acme-backend-1`;
- validado que tickets novos da empresa 6 passaram a entrar com `queueId=4`;
- validado smoke test de 5 chamadas paralelas ao webhook n8n com HTTP `200` e execucoes `success`.

### 2026-06-15 - SSO SaaS -> Vib Chat e usuarios por empresa

O que foi feito:

- adicionada aba `Usuarios` no painel operacional padrao da empresa;
- criada rota SaaS `POST /api/ticketz/sso-url` para gerar link temporario assinado do Vib Chat;
- criada rota no Vib Chat `GET /backend/auth/saas-login?token=...` para validar o token, criar/usar empresa e usuario tecnico, gravar sessao no dominio `vib.correacloud.com.br` e abrir `/tickets`;
- renomeada a area embutida de `Ticketz completo` para `Vib Atendimento`;
- configuradas variaveis `TICKETZ_BASE_URL`, `TICKETZ_SSO_SECRET`, `TICKETZ_SSO_EMAIL_DOMAIN` e `TICKETZ_SSO_USER_PROFILE`;
- criada/pareada a empresa `Pizzaria Big Burguer` no Vib Chat como `ticketzCompanyId=6`;
- criado usuario tecnico `Atendimento Pizzaria Big Burguer` no Vib Chat para a empresa 6;
- validado login SaaS, geracao da URL SSO, resposta HTML com bootstrap de `localStorage` e saude dos endpoints publicos.

Arquivos alterados:

- SaaS: `backend/src/ticketz-sso.controller.ts`;
- SaaS: `backend/src/app.module.ts`;
- SaaS: `frontend/src/main.tsx`;
- SaaS: `.env.example`;
- Vib Chat fonte: `/home/chat/fp-ticketz-custom-local/backend/src/controllers/SessionController.ts`;
- Vib Chat fonte: `/home/chat/fp-ticketz-custom-local/backend/src/routes/authRoutes.ts`.

Observacoes:

- nao salvar o valor real de `TICKETZ_SSO_SECRET` no README;
- o usuario criado no Vib Chat e admin da empresa, mas nao e super admin;
- futuras empresas podem ser criadas no Vib Chat no primeiro acesso SSO se ainda nao existirem;
- o proximo passo e automatizar filas/conexoes WhatsApp por empresa e sincronizar melhor usuarios humanos.

### 2026-06-16 - Pizzaria conectada ao Ticketz/n8n e acoes SaaS para IA

O que foi feito:

- identificada a empresa `Pizzaria Big Burguer` no Vib Chat/Ticketz como `companyId=6`;
- identificada a conexao WhatsApp conectada `Bruno Teste - 5527997429484`, `whatsappId=5`;
- criadas filas padrao no Ticketz para a Pizzaria:
  - `Recepcao`, id `4`, com webhook n8n ativo;
  - `Pedidos`, id `5`;
  - `Cozinha`, id `6`;
  - `Entrega`, id `7`;
  - `Financeiro`, id `8`;
- associada somente a fila `Recepcao` ao WhatsApp de teste, para o Ticketz atribuir automaticamente tickets novos nessa fila e chamar o n8n;
- atualizado o cadastro SaaS da Pizzaria com:
  - `ticketz_company_id=6`;
  - `ticketz_whatsapp_id=5`;
  - `ticketz_queue_id=4`;
  - `ticketz_base_url=https://vib.correacloud.com.br`;
  - `n8n_webhook_url=https://n8n.correacloud.com.br/webhook/vib/recepcao/pizzaria-big-burguer/6/ticketz`;
- criado/importado/publicado workflow n8n `Vib - Pizzaria Big Burguer - Recepcao IA`;
- validado webhook publico do n8n com resposta de IA;
- validado workflow publico de recepcao carregando contexto/cardapio do SaaS e respondendo no formato `output` do Ticketz;
- reiniciado backend do Ticketz e validado que a sessao WhatsApp da Pizzaria voltou como `CONNECTED`;
- adicionados endpoints internos para o n8n controlar funcoes do SaaS por empresa:
  - listar/detalhar pedidos;
  - criar pedido;
  - confirmar pedido e gerar impressao;
  - reimprimir pedido;
  - atualizar status do pedido;
  - registrar anotacao interna;
  - listar impressoras e jobs de impressao;
- atualizado workflow da Pizzaria para carregar contexto/cardapio do SaaS, chamar a IA e executar acoes internas permitidas no SaaS.
- criada imagem publica de cardapio rapido:
  - `https://saas.correacloud.com.br/cardapio-pizzaria-big-burguer.png`;
- atualizado o workflow da recepcao para enviar essa imagem quando o cliente pedir cardapio ou disser que quer fazer pedido;
- corrigida a deteccao de pedido de cardapio no workflow para normalizar acentos (`cardapio`/`cardápio`) e tambem aceitar respostas curtas como `sim`;
- quando a imagem do cardapio e enviada, o texto complementar foi reduzido para nao repetir o cardapio inteiro em texto;
- atualizado o backend do Ticketz para aceitar acao n8n `media`, enviando imagem/audio/documento ao WhatsApp quando o workflow retornar `type=media`;
- o workflow passa a encaminhar imagem recebida pelo cliente para a IA quando houver `mediaUrl` publico; audio ainda fica como proximo passo para transcricao completa;
- diagnosticado que a mensagem `Quero uma Maracana / Me manda os sabores?` nao respondeu porque o Ticketz recebeu erro `520` ao chamar o n8n pelo dominio publico;
- alterada a fila `Recepcao` do Ticketz para chamar o webhook interno do n8n:
  - `http://11.88.88.8:5678/webhook/vib/recepcao/pizzaria-big-burguer/6/ticketz`;
- criada imagem publica de sabores com precos por tamanho:
  - `https://saas.correacloud.com.br/cardapio-sabores-pizzaria-big-burguer.png`;
- atualizado o workflow para enviar a imagem de sabores quando o cliente pedir `sabores`, `opcoes de pizza` ou mencionar `Maracana`;
- validado de dentro do container backend do Ticketz que o webhook interno retorna `200` com `media` da imagem de sabores e uma mensagem curta.
- transformado o botao `Abrir/Fechar` do painel da empresa em controle real de operacao da loja, usando `company_settings.accept_orders`;
- criado endpoint autenticado `PUT /api/companies/:id/order-acceptance` para abrir/fechar pedidos da empresa;
- a listagem de empresas do painel agora retorna `settings`, permitindo exibir `Aberto/Fechado` corretamente na sidebar e no topo;
- atualizado o workflow n8n para bloquear atendimento de pedido quando `acceptOrders=false`, respondendo que a loja esta fechada sem chamar a IA nem tentar criar pedido;
- testado o fluxo completo:
  - fechado: webhook retorna apenas aviso de loja fechada;
  - aberto: webhook volta ao atendimento normal e envia imagem de sabores/cardapio quando solicitado;
  - estado original da Pizzaria Big Burguer restaurado como `Aberto`.
- adicionadas acoes operacionais nos cards de pedidos do painel:
  - `Editar`, abrindo modal para ajustar cliente, telefone, tipo, status, pagamento, subtotal, taxa, desconto, total e observacao;
  - `Cancelar`, alterando o pedido para status `canceled` e removendo-o das colunas operacionais sem apagar historico;
- validado build do frontend local e rebuild Docker do frontend no servidor.
- corrigida a atualizacao dos contadores superiores do quadro de pedidos (`Em analise`, `Em producao`, `Prontos/rota`):
  - o componente do quadro agora sincroniza a lista recarregada com o painel pai depois de aceitar, editar ou cancelar pedido;
  - os contadores atualizam imediatamente, sem precisar dar F5;
  - validado novo build do frontend e health dos containers no servidor.
- simplificada a tela `Usuarios`:
  - removido o campo tecnico `permissions` do formulario para evitar erro de JSON ao cadastrar usuario;
  - `Perfil` agora e um select com opcoes validas (`Administrador da empresa`, `Gerente`, `Atendente`, `Entregador`);
  - campos ganharam labels amigaveis (`Nome`, `Email`, `Senha`, `Telefone`, `Perfil`, `Ativo`);
  - listagem de usuarios mostra dados resumidos em texto normal em vez de JSON cru;
  - validado build do frontend e rebuild Docker no servidor.
- removidas as credenciais hardcoded da tela de login:
  - o email e a senha nao abrem mais preenchidos por padrao em maquinas novas;
  - o formulario usa `autocomplete` normal do navegador para credenciais salvas localmente pelo proprio usuario;
  - validado build do frontend e rebuild Docker no servidor.
- ajustada a gestao de usuarios por perfil:
  - super admin agora consegue ver e editar usuarios pela tela `Usuarios`, incluindo o proprio usuario `super_admin`;
  - usuarios comuns da empresa nao enxergam registros com perfil `super_admin`;
  - backend bloqueia criacao/promocao para `super_admin` quando o solicitante nao e super admin;
  - tela `Usuarios` ganhou modo `Editar`, preenchendo o formulario e salvando via `PUT`;
  - senha fica em branco ao editar e so muda se for preenchida;
  - validado via API: super admin ve `super_admin`; usuario comum nao ve `super_admin`.
- reforcado isolamento multiempresa:
  - `super_admin` lista todas as empresas;
  - usuarios de empresa, incluindo `company_admin`, listam apenas a propria empresa;
  - rotas genericas de recursos escopados agora forcam `companyId` do usuario logado quando ele nao e `super_admin`;
  - se um usuario de empresa tentar consultar/criar recurso passando `companyId` de outra empresa, a API continua usando a empresa dele;
  - usuarios criados dentro da Pizzaria ficam vinculados apenas a Pizzaria;
  - validado via API: super admin viu 3 empresas; usuario da Pizzaria viu somente a Pizzaria e apenas usuarios dela.
- corrigida parada do cardapio publico e tela do garcom:
  - o arquivo `PublicMenuController` existia, mas nao estava registrado em `AppModule`;
  - restaurado `PublicMenuController` na lista de controllers do backend;
  - rebuild Docker do backend aplicado;
  - validado `GET /api/public/pizzaria-big-burguer/menu` retornando `200`;
  - validado HTML das rotas `/cardapio/pizzaria-big-burguer` e `/garcom/pizzaria-big-burguer` retornando `200`.
- ajustado workflow n8n da recepcao para nao reenviar cardapio quando o cliente ja informou a pizza:
  - regras automaticas de imagem agora disparam somente quando o cliente pede explicitamente cardapio/menu/sabores;
  - mensagens como `Quero uma Maracana de calabresa` seguem para a IA conduzir o pedido;
  - reforcado prompt para informar valor quando houver tamanho e sabor;
  - adicionada protecao deterministica que calcula o valor pelo cardapio e injeta na resposta se a IA omitir `R$`;
  - validado: `Quero uma Maracana de calabresa` retorna valor `R$ 102,90` sem mandar cardapio;
  - validado: `Me manda os sabores?` continua enviando a imagem de sabores;
  - validado: pizza grande metade Calabresa/metade 4 Queijos retorna `R$ 71,90` e pede endereco.
- publicado download do agente local de impressao:
  - arquivo publico: `https://saas.correacloud.com.br/print-agent.zip`;
  - conteudo do ZIP vem da pasta `print-agent/` do projeto;
  - aba `Impressoras` agora mostra um painel `Agente local de impressao` com botao `Baixar agente`;
  - validado HTTP `200`, `Content-Type: application/zip`, e arquivo presente no container frontend.
- decisao tecnica para a proxima etapa do agente de impressao:
  - o ZIP/Python atual fica como MVP tecnico/dev;
  - o pacote final deve ser um instalador Windows `.exe`, por exemplo `Vib Print Agent Setup.exe`;
  - o instalador deve criar um servico Windows, sugestao de nome `VibPrintAgent`, para iniciar junto com o Windows;
  - binario, configuracao e logs devem ficar em `C:\ProgramData\VibPrintAgent\`;
  - requisitos do instalador: configurar empresa/token/impressora, testar impressao, registrar logs locais e permitir suporte/atualizacao;
  - esta etapa ficou separada para o amigo do Daniel cuidar.

Arquivos importantes:

- `backend/src/integrations.controller.ts`;
- `backend/src/app.service.ts`;
- `backend/src/companies.controller.ts`;
- `frontend/src/main.tsx`;
- `frontend/src/styles.css`;
- Ticketz: `/home/chat/fp-ticketz-custom-local/backend/src/services/WbotServices/wbotMessageListener.ts`;
- `frontend/public/cardapio-pizzaria-big-burguer.png`;
- `frontend/public/cardapio-sabores-pizzaria-big-burguer.png`;
- `docs/n8n-saas-actions.md`;
- `docs/n8n-workflows/vib-pizzaria-big-burguer-recepcao-ia.json`.

Observacoes:

- o segredo real de webhook nao deve ser salvo no repositorio;
- o workflow usa as variaveis do container n8n `SAAS_API_URL`, `SAAS_WEBHOOK_SECRET` e `OPENAI_API_KEY`;
- o workflow aceita `SAAS_API_URL` com ou sem `/api` no final;
- retorno n8n com midia aceito pelo Ticketz:
  - `{ "type": "media", "mediaUrl": "https://...", "mimetype": "image/png", "filename": "cardapio.png", "caption": "..." }`;
- as acoes do workflow ainda sao MVP e devem ser ampliadas com mais validacoes conforme a operacao real da loja.

### 2026-06-14 - Ticketz completo por tras do Vib

Decisao:

- usar o Ticketz inteiro como motor de WhatsApp, chat, conexoes e filas humanas;
- o Vib continua como painel operacional da empresa, pedidos, cardapio, impressao, configuracoes e IA;
- a aba `WhatsApp` do Vib passa a embutir o Ticketz completo em iframe;
- o Ticketz existente no servidor roda publicamente em `https://vib.correacloud.com.br`;
- a porta direta `http://11.88.88.8:8085` tambem abre o frontend, mas pode falhar no backend por CORS/origem;
- o frontend aceita `VITE_TICKETZ_URL` para apontar para outra instalacao do Ticketz;
- proximos passos: configurar webhook/post por fila do Ticketz para o Vib/n8n e criar teste de IA via Groq.

Arquivos alterados:

- `frontend/src/main.tsx`: aba WhatsApp renderiza o Ticketz completo;
- `frontend/src/styles.css`: layout do container/iframe Ticketz;
- `frontend/Dockerfile` e `docker-compose.yml`: suporte a `VITE_TICKETZ_URL`;
- `.env.example`: exemplo da URL do Ticketz.

### 2026-06-14 - Workflows n8n separados por empresa

O que foi feito:

- criado script `scripts/provision-n8n-company-workflows.mjs`;
- criada documentacao `docs/n8n-company-workflows.md`;
- gerados JSONs em `docs/n8n-workflows/`;
- importados e ativados workflows no n8n para as empresas existentes;
- atualizado `companies.n8n_webhook_url` no Vib para cada empresa;
- validado POST no webhook da Barbearia com retorno `200` e chamada de volta para `POST /api/n8n/events`.

Workflows ativos no n8n:

- Barbearia Exemplo: `e41a8ZXTHiLL0uiy`
- Pizzaria Big Burguer: `Yymbb0TPEWfqvMOW`
- Restaurante Delivery Exemplo: `R5cuqEOKmL36geBR`

URLs de webhook seguem o padrao:

```text
http://11.88.88.8:5678/webhook/vib/{slug}/{companyId}/ticketz
```

Fluxo atual:

```text
Vib/Ticketz -> webhook n8n da empresa -> Code node padroniza evento -> POST /api/n8n/events no Vib
```

Proximo passo:

- plugar a chamada Groq/IA dentro de cada workflow;
- fazer o Ticketz postar eventos de mensagens/fila para o endpoint correto do Vib/n8n;
- criar provisioning automatico de empresa/usuarios/filas entre Vib e Ticketz.

### 2026-06-14 - Layout padrao por empresa e configuracao de marca

O que foi feito:

- todas as empresas passam a abrir o mesmo painel operacional principal;
- removidos hardcodes visuais da Big Burguer no painel administrativo;
- a logo/nome exibidos no painel agora vem da empresa selecionada;
- adicionada coluna `companies.logo_url` no Prisma/PostgreSQL;
- aba `Configuracoes` virou o ponto principal para editar dados, integracoes, imagem/logo e modulos da empresa;
- menu lateral do painel passa a esconder areas com modulo inativo para a empresa;
- removido fallback visual do painel generico antigo apos login;
- configurado Nginx do frontend para nao cachear `index.html` velho;
- cardapio publico e tela do garcom passam a usar a logo da empresa quando configurada;
- quando nao houver logo, o sistema mostra iniciais da empresa como marca padrao.

Onde mexer depois:

- dados e imagem da empresa: aba `Configuracoes`;
- layout visual do painel: `frontend/src/styles.css`;
- campos editaveis da empresa: `frontend/src/main.tsx`, lista `companySettingsFields`;
- retorno publico da empresa: `backend/src/public-menu.controller.ts`.

### 2026-06-13 - Acabamento visual do painel e cardapio

O que foi feito:

- aplicada camada de polimento visual no `frontend/src/styles.css`;
- melhorada hierarquia visual do painel operacional de restaurante;
- refinados sidebar, topbar, cards de pedidos, colunas do quadro, estados vazios e area WhatsApp;
- refinado visual do cardapio publico, tela de garcom, checkout e botoes principais;
- ajustado responsivo para reduzir aparencia quebrada em telas menores;
- menu lateral do painel restaurante fixado em desktop, com rolagem interna apenas nas abas;
- build local do frontend validado com `npm.cmd run build`.

### 2026-06-12 - Botao aceitar pedido no painel

O que foi feito:

- adicionada acao `Aceitar pedido` na tabela de `Pedidos` do painel SaaS;
- pedidos com status `draft` ou `waiting_confirmation` agora podem ser confirmados pelo painel;
- a acao chama `POST /api/orders/:id/confirm`, muda o status do pedido e gera os jobs de impressao;
- pedidos ja aceitos passam a mostrar a acao `Reimprimir`, chamando `POST /api/orders/:id/reprint`;
- com o agente local ativo, a confirmacao do pedido deve imprimir automaticamente na fila configurada.

### 2026-06-11 - Integracao inicial do cardapio Big Burguer ao SaaS

O que foi feito:

- criada API publica multitenant em `backend/src/public-menu.controller.ts`;
- adicionada rota publica `/cardapio/:slug` no frontend;
- criado cardapio publico para cliente final sem login administrativo;
- modeladas pizzas como produtos de tamanho e sabores como adicionais com limite de 1 a 2 escolhas;
- regra de preco de pizza com 2 sabores calculada no backend pelo maior valor selecionado;
- adicionadas colunas opcionais `description` e `image_url` em `product_addons`;
- criado seed da empresa `pizzaria-big-burguer` a partir de `backend/prisma/big-burguer-menu.json`;
- adicionados recursos de edicao para grupos de adicionais e sabores no painel generico;
- copiados assets publicos da Big Burguer para `frontend/public`;
- documentada a decisao em `docs/public-cardapio.md`.

### 2026-06-11 - Tela de garcom para pedidos de mesa

O que foi feito:

- criada rota publica operacional `/garcom/:slug`;
- adicionada tela de garcom para pedido de mesa/salao;
- garcom informa mesa, nome do garcom e opcionalmente nome do cliente;
- a tela usa o mesmo cardapio, bebidas, sucos e regra de pizza de ate 2 sabores;
- pedidos de mesa entram na API publica como `orderType: table`;
- backend passou a aceitar pedido de mesa sem telefone/cadastro de cliente;
- para delivery/retirada, nome e telefone continuam obrigatorios;
- informacoes de mesa e garcom sao registradas em `notes` para aparecerem no painel e na impressao.

### 2026-06-11 - Ajuste do agente local de impressao

O que foi feito:

- o agente local passou a separar o nome da fila no SaaS e o nome da impressora no Windows;
- `queue_printer_name` filtra os jobs pendentes pela impressora cadastrada no SaaS;
- `windows_printer_name` define a impressora fisica/local usada pelo Windows;
- documentacao atualizada em `print-agent/README.md` e `docs/print-agent.md`;
- isso permite usar, por exemplo, fila `Cozinha Big Burguer` no SaaS imprimindo localmente na `POSPrinter POS80`.

### 2026-06-12 - Impressao RAW/ESC-POS para POS USB

O que foi feito:

- identificado que o Windows aceitava jobs via `print /D:` mas a POS USB nao soltava papel;
- validado teste RAW direto na `POSPrinter POS80`;
- agente local passou a enviar bytes RAW/ESC-POS pelo spooler do Windows;
- adicionada opcao `encoding`, padrao recomendado `cp860`;
- documentacao atualizada para orientar impressoras POS USB.

Como testar depois do deploy:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
docker compose up --build -d
curl http://localhost:3101/api/public/pizzaria-big-burguer/menu
```

## Como rodar localmente

```bash
cp .env.example .env
docker compose up --build -d
```

URLs locais padrao:

- Frontend: `http://localhost:8090`
- Backend: `http://localhost:3101`
- Healthcheck: `http://localhost:3101/api/health`

Comandos uteis:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

## Estrutura do projeto

```text
backend/      API NestJS + Prisma
frontend/     React + Vite
docs/         Documentacao e exemplos de integracao
print-agent/  Agente local Python para impressao no Windows
```

## O que ja foi feito

### Base SaaS

- API NestJS com Prisma.
- Frontend React/Vite.
- Docker Compose com backend, frontend e PostgreSQL.
- Login JWT.
- Multitenancy por `company_id`.
- Seeds com restaurante e barbearia de exemplo.
- CRUD generico em `/api/resources/:resource`.
- Endpoints de contexto e prompt para IA:
  - `GET /api/companies/:id/context`
  - `GET /api/companies/:id/ai-prompt`
  - `GET /api/companies/:id/menu`
  - `GET /api/companies/:id/services`

### Modelos principais

Foram criadas estruturas para:

- empresas;
- usuarios;
- modulos por empresa;
- horarios de funcionamento;
- cardapio;
- adicionais;
- servicos;
- profissionais;
- agendamentos;
- clientes;
- enderecos;
- zonas de entrega;
- entregadores;
- pedidos;
- pagamentos;
- cupons;
- FAQ/base de conhecimento;
- configuracoes de bot;
- tickets;
- logs de mensagens;
- conexoes WhatsApp;
- impressoras;
- fila de impressao;
- auditoria.

### Modulos por empresa

Foi criada a tabela `company_modules`.

O sistema permite ativar/desativar modulos por empresa. O backend bloqueia recursos de modulos inativos com `403`.

Exemplos de modulos:

- orders
- delivery
- menu
- appointments
- services
- bot
- chat
- printing
- coupons
- reports

No frontend existe a tela "Modulos" para alternar os modulos por empresa.

### WhatsApp e usuarios

Foi criada estrutura para conexoes WhatsApp inspirada no funcionamento do Ticketz/Whaticket.

Modelo principal:

- `WhatsappConnection`

Endpoints criados:

- `POST /api/whatsapp-connections/:id/start`
- `POST /api/whatsapp-connections/:id/connected`
- `POST /api/whatsapp-connections/:id/disconnect`
- `POST /api/whatsapp-connections/:id/refresh`
- `POST /api/whatsapp-connections/:id/ticketz-config`

No frontend foram adicionados recursos para:

- usuarios;
- conexoes WhatsApp.

Observacao: a conexao real com WhatsApp ainda nao foi implementada. Hoje a estrutura esta pronta para integrar com Ticketz, Baileys ou outro conector.

### Chat, tickets e n8n

Foi criada a camada de chat para receber mensagens do Ticketz/Whaticket e encaminhar para o n8n.

Endpoints:

- `POST /api/chat/messages`
- `GET /api/chat/tickets`
- `GET /api/chat/tickets/:id/messages`
- `POST /api/chat/tickets/:id/handoff`
- `POST /api/chat/tickets/:id/bot`
- `POST /api/chat/send-message`
- `POST /api/webhooks/ticketz`
- `POST /api/n8n/events`

Logica atual:

- identifica a empresa por `company_id`, `companyId`, `ticketz_company_id` ou `ticketz_whatsapp_id`;
- cria/atualiza cliente por telefone/WhatsApp;
- cria/atualiza ticket por empresa e `ticketzTicketId`;
- salva mensagens em `MessageLog`;
- salva endereco quando chega localizacao;
- se a mensagem for recebida, bot estiver ativo e existir `company.n8nWebhookUrl`, envia payload estruturado para o n8n;
- se nao existir webhook configurado, retorna `n8n_webhook_not_configured`;
- evita bot quando ticket esta em atendimento humano.

Teste ja feito:

- `POST /api/chat/messages` com payload fake do Ticketz;
- criou ticket, cliente e mensagem;
- resposta indicou `n8n.sent=false` porque o webhook da empresa ainda nao esta configurado.

### Pedidos, delivery e impressao

Pedido:

- estrutura de pedidos e itens;
- confirmacao de pedido;
- criacao automatica de tarefas de impressao;
- suporte a reimpressao.

Impressao:

- tabela `Printer`;
- tabela `PrintJob`;
- fila de impressao com status;
- endpoints:
  - `GET /api/print-jobs/pending`
  - `POST /api/print-jobs/:id/claim`
  - `POST /api/print-jobs/:id/success`
  - `POST /api/print-jobs/:id/fail`
  - `POST /api/orders/:id/reprint`

Agente local:

- pasta `print-agent/`;
- agente Python inicial;
- `config.example.json`;
- README proprio;
- exemplo de impressao de pedido.

O MVP do agente foi pensado para Windows e impressora local por nome. ESC/POS e rede/IP ficam para etapa futura.

### n8n no servidor

Foi criado um ambiente separado em Docker:

```text
/home/chat/n8n-docker
```

Servicos:

- `n8n` com imagem `n8nio/n8n:latest`;
- `postgres` com imagem `postgres:16-alpine`;
- volumes persistentes para banco e dados do n8n.

URL:

```text
http://11.88.88.8:5678
```

Status validado:

- container do n8n subiu;
- container do PostgreSQL esta healthy;
- editor respondeu HTTP 200.

Proximo passo no n8n:

- criar o usuario dono no primeiro acesso;
- criar workflow com node Webhook;
- copiar a URL do webhook;
- configurar essa URL em `n8n_webhook_url` da empresa no SaaS.

## Integracao desejada Ticketz -> SaaS -> n8n

Fluxo esperado:

```text
Cliente WhatsApp
  -> Ticketz/Whaticket
  -> Webhook para SaaS
  -> ChatService cria ticket/mensagem
  -> SaaS envia payload ao n8n
  -> n8n decide resposta/automacao
  -> SaaS envia resposta para Ticketz
  -> Ticketz envia ao WhatsApp
```

Ainda falta fechar a parte de envio real de mensagem de volta ao Ticketz com credenciais/endpoint correto do Ticketz em producao.

## Proximos passos

1. Colocar dominio e HTTPS para SaaS e n8n.
2. Criar usuario dono do n8n.
3. Criar primeiro workflow no n8n para receber mensagens do SaaS.
4. Configurar `n8n_webhook_url` nas empresas seed/teste.
5. Implementar conector real para enviar mensagens do SaaS para Ticketz.
6. Criar tela de atendimento/chat no frontend.
7. Melhorar tela de usuarios com permissoes por modulo.
8. Criar tela de configuracao de WhatsApp com status real.
9. Implementar relatorios basicos.
10. Criar migrations formais para evolucao em producao.
11. Revisar seguranca:
    - tokens;
    - secrets;
    - CORS;
    - rate limit;
    - permissao por empresa;
    - HTTPS obrigatorio.
12. Melhorar o print-agent:
    - instalador Windows;
    - service em background;
    - logs locais;
    - ESC/POS;
    - impressora de rede por IP.

## Decisoes tecnicas

- O projeto novo fica separado do Ticketz para evitar quebrar o ambiente atual.
- O Vib Chat usa o Ticketz custom como motor de WhatsApp, filas e tickets.
- Alteracoes no Ticketz devem ser feitas no fonte `/home/chat/fp-ticketz-custom-local` e publicadas por rebuild da imagem `fp-ticketz-custom-local-backend:latest`.
- O SaaS concentra regra de negocio por empresa.
- O n8n fica como motor de automacao e inteligencia operacional.
- A impressao fica em modulo separado usando fila.
- Modulos sao controlados por empresa para permitir planos diferentes.

## Como colaborar

Quando alguem trabalhar no projeto com Codex:

1. Ler este README antes de alterar codigo.
2. Atualizar a secao "Registro de trabalho".
3. Adicionar novas URLs, comandos ou endpoints criados.
4. Marcar proximos passos que foram concluidos.
5. Nao salvar segredos reais no repositorio.

## Registro de trabalho

### 2026-06-15

- Publicados dominios HTTPS `saas.correacloud.com.br`, `vib.correacloud.com.br` e `n8n.correacloud.com.br`.
- Corrigido `VITE_API_URL` do SaaS para evitar chamada duplicada `/api/api/auth/login`.
- Atualizados webhooks das empresas para `https://n8n.correacloud.com.br/webhook/...`.
- Criada aba `Usuarios` no painel operacional padrao por empresa.
- Criado SSO assinado entre SaaS e Vib Chat.
- Criado endpoint SaaS `POST /api/ticketz/sso-url`.
- Criado endpoint Vib Chat `GET /backend/auth/saas-login`.
- Rebuildados e reiniciados containers `vib-saas-platform` e `ticketz-docker-acme-backend`.
- Validado fluxo da Pizzaria Big Burguer abrindo Vib Atendimento com usuario tecnico da empresa.
- Corrigido bloqueio `ERR_BLOCKED_BY_RESPONSE` ao abrir o Vib Atendimento dentro do SaaS.
- Ajustado nginx do Vib Chat para remover `X-Frame-Options` e CSP vindo do backend em `/backend/`, adicionando `Content-Security-Policy: frame-ancestors 'self' https://saas.correacloud.com.br`.
- Removida variavel remota `FRAME_ANCESTORS` dos arquivos `.env-backend`, pois o `env_file` do Docker interpretava o valor com espaco de forma incorreta.
- Persistida imagem `fp-ticketz-custom-local-frontend:latest` com a configuracao de nginx corrigida e recriado o frontend do Vib Chat.
- Validado SSO publico: `GET https://vib.correacloud.com.br/backend/auth/saas-login?...` responde `200`, sem `X-Frame-Options`, com CSP correto e bootstrap de login.
- Configurada chave OpenAI no n8n para teste de IA, sem registrar o segredo no repositorio.
- Criado workflow n8n `Vib - Pizzaria Big Burguer - Teste IA`.
- Arquivo do workflow salvo em `docs/n8n-workflows/vib-pizzaria-big-burguer-teste-ia.json`.
- Webhook de teste: `POST https://n8n.correacloud.com.br/webhook/vib/teste-ia/pizzaria-big-burguer/6d558f61-4f94-40aa-b96c-b8d6e8c38523/ticketz`.
- Validado teste publico com OpenAI `gpt-4.1-mini`: o workflow recebeu uma mensagem de pedido de pizza e retornou resposta curta para atendimento.
- Observacao: este workflow ainda apenas gera a resposta; o proximo passo e plugar o envio de volta para Ticketz/SaaS para a mensagem sair ao cliente.
- Diagnosticada parada da impressao: os PrintJobs estavam sendo criados e havia 3 jobs pendentes da Pizzaria Big Burguer, todos com `attempts=0`.
- Corrigido backend para aceitar chamadas acidentais em `/api/api/...`, evitando erro quando o agente local estiver com `api_base_url` terminando em `/api`.
- Corrigida consulta de jobs pendentes para nao esconder jobs quando `printer_name` enviado pelo agente for o nome real da impressora Windows e nao existir como nome cadastrado em `printers`.
- Atualizado `print-agent/agent.py` para normalizar `api_base_url`, evitando duplicar `/api` nas proximas instalacoes.
- Rebuildado e recriado o container `vib-saas-platform-backend`.
- Validado depois do deploy:
  - `GET /api/print-jobs/pending` retorna 3 jobs;
  - `GET /api/api/print-jobs/pending` tambem retorna 3 jobs;
  - filtro com `printer_name` desconhecido tambem retorna os jobs pendentes da empresa.
- Corrigido travamento do SaaS apos `F5` na tela `Carregando empresa`.
- Causa: quando o token salvo no navegador expirava ou ficava invalido, a chamada de empresas falhava, mas o frontend mantinha a sessao em memoria e nunca voltava para login.
- Ajuste: parse seguro de `vib-session`; em erro ao carregar empresas, remove `vib-session`, limpa estado e volta para a tela de login.
- Rebuildado e recriado o container `vib-saas-platform-frontend`.

### 2026-06-10

- Criado MVP inicial do SaaS.
- Criado backend NestJS + Prisma.
- Criado frontend React/Vite.
- Criado Docker Compose.
- Criados modelos principais do dominio.
- Criados endpoints de pedidos, entregas, impressao, contexto e recursos genericos.
- Criado agente local inicial de impressao em Python.
- Deploy inicial no servidor.

### 2026-06-11

- Adicionado controle de modulos por empresa.
- Adicionada estrutura de conexoes WhatsApp.
- Adicionada estrutura de usuarios/permissoes.
- Adicionada camada de chat/tickets.
- Adicionado encaminhamento de mensagens para n8n.
- Validado recebimento fake de mensagem Ticketz.
- Criado n8n em Docker no servidor com PostgreSQL dedicado.
- Validado acesso externo ao n8n.
- README ampliado para documentar colaboracao e historico do projeto.

### 2026-06-13

- Aplicada camada inicial de acabamento visual no painel restaurante, cardapio publico e tela de garcom.
- Refinados sidebar, topbar, quadro de pedidos, WhatsApp, checkout publico, tela de garcom e responsivo.
- Menu lateral do painel restaurante fixado em desktop; apenas a lista de abas rola internamente.
- Build local do frontend validado com `npm.cmd run build`.

### 2026-06-12

- Adicionado botao de aceitar pedido no painel SaaS.
- Validado fluxo de confirmacao de pedido criando jobs de impressao para o agente local.
- Limpos os pedidos de teste da Big Burguer, incluindo itens, sabores/adicionais, jobs de impressao, entrega e cadastros de clientes usados no teste.
- Criado backup SQL das tabelas operacionais antes da limpeza em `.codex-backups/`.
- Confirmado que a empresa `Pizzaria Big Burguer` nao foi removida; o painel estava abrindo na primeira empresa da lista.
- Ajustado o admin seed para usar a `Pizzaria Big Burguer` como empresa padrao e o frontend para lembrar/priorizar a empresa selecionada.
- Criado painel operacional de restaurante para empresas do segmento `restaurant`, inspirado no fluxo do AnotaAI Desktop.
- A empresa selecionada agora abre uma area gerenciavel com sidebar, caixa, pedidos em colunas, entregadores, mesas, cardapio, financeiro, pagamentos, impressoras, clientes, relatorios e configuracoes.
- O painel reutiliza os recursos existentes do SaaS e mantem links diretos para cardapio publico e tela do garcom.
- Corrigido o checkout do cardapio publico para permitir apenas `Delivery` e `Retirada`; pedido de mesa fica exclusivo da rota `/garcom/:slug`.
- Adicionada aba `WhatsApp` ao painel operacional da pizzaria com lista de conversas, historico de mensagens e painel lateral para criar pedido assistido.
- O envio de mensagem registra no historico via `POST /api/chat/send-message`; envio real para WhatsApp ainda depende de plugar Ticketz/WhatsApp Business.
- O pedido assistido cria pedido `waiting_confirmation` com origem `whatsapp`, para cair na fila de pedidos e seguir o fluxo de aceite/impressao.
- Criado template n8n `Ticketz Restaurante SaaS Template.json` em `C:\Users\Bruno\Nextcloud\Projetos\fluxo modelo` e em `docs/n8n-templates/`, derivado do fluxo atual do Bruno sem sobrescrever o original.
- Adicionados endpoints internos protegidos por `x-webhook-secret` para o n8n consultar contexto/cardapio e criar pedidos por empresa:
  - `GET /api/integrations/restaurants/:companyId/context`
  - `GET /api/integrations/restaurants/:companyId/menu`
  - `POST /api/integrations/restaurants/:companyId/orders`
- O pedido criado pelo n8n entra como `waiting_confirmation`, origem `n8n`, usando a validacao do SaaS para produtos, sabores/adicionais e regra de maior valor nas pizzas.
- Documentada a integracao em `docs/n8n-ticketz-restaurante.md`.
- Configurado o container do n8n com `SAAS_API_URL` e `SAAS_WEBHOOK_SECRET`; validado de dentro do n8n que o endpoint de cardapio da Big Burguer responde `200`.

### 2026-06-26

- Alterado o envio de avisos WhatsApp da Pizzaria Big Burguer para usar a API de mensagens do Ticketz (`POST /backend/api/messages/send`) em vez do webhook de integracao generico.
- O SaaS agora envia `number`, `body`, `saveOnTicket` com o `queueId` da empresa e `linkPreview=false`, mantendo a mensagem dentro do atendimento/fila do Ticketz.
- Ajustado o Ticketz para preservar `saveOnTicket` numerico no endpoint `/api/messages/send`; antes ele convertia tudo para booleano e perdia o `queueId`.
- Mantida a priorizacao de telefone em formato DDD local quando o numero vier com `55`, ajudando contatos como `27998832209` a cair na conversa correta.
- Rebuildado e recriado o container `vib-saas-platform-backend`.
- Reiniciado o backend do `ticketz-docker-acme` apos patch runtime em `dist/controllers/MessageController.js`; fonte tambem atualizada em `/home/chat/fp-ticketz-custom-local/backend/src/controllers/MessageController.ts`.
- Validacao realizada:
  - chamada direta ao endpoint do Ticketz retornou `200` com `Message added to queue`;
  - mensagem de teste registrada em `Messages` no ticket `365`;
  - ticket `365` confirmado com `queueId=4`, `whatsappId=9`, contato Bruno.

### 2026-06-26 - Correcao cadastro de motoboys

- Corrigido erro interno ao adicionar motoboy na aba `Entregadores`.
- Causa: o frontend enviava `vehicleType` com rotulo visual (`Moto`, `Bicicleta`, `Carro`, `Outro`), mas o Prisma espera o enum tecnico (`motorcycle`, `bicycle`, `car`, `walking`).
- Ajustado o frontend para exibir labels amigaveis e enviar os valores tecnicos corretos.
- Adicionada blindagem no backend para normalizar valores antigos como `Moto` antes de criar/editar `deliveryPersons`.

### 2026-06-26 - Ajuste impressao POS80

- Ajustada a montagem do comprovante para respeitar largura de bobina termica:
  - `mm80`: 42 colunas seguras;
  - `mm58`: 32 colunas;
  - `a4`: 80 colunas.
- O comprovante agora centraliza o titulo, usa separadores e quebra linhas longas de cliente, item, adicionais, observacoes e endereco para evitar corte lateral.
- Alterado o agente local de impressao para enviar RAW/ESC-POS via spooler do Windows, em vez do comando `print` do Windows.
- O envio RAW evita margem/fonte do Windows e melhora o encaixe na POS80 termica direta.
- Recriado `frontend/public/print-agent.zip` com o agente atualizado.

### 2026-06-26 - Atualizacao automatica da fila de pedidos

- Ajustado o quadro `Pedidos` do painel operacional para atualizar automaticamente sem precisar recarregar a pagina.
- A tela agora consulta novos pedidos a cada 3,5 segundos enquanto estiver visivel e tambem atualiza ao voltar o foco da aba.
- A atualizacao e silenciosa para nao piscar erro nem atrapalhar operacao; se um pedido estiver aberto em edicao, o refresh pausa ate fechar o modal.
- Adicionado indicador visual `Ao vivo` com o horario da ultima sincronizacao.

### 2026-06-26 - Selecao de motoboy no pedido delivery

- Adicionado seletor de motoboy diretamente no card de pedidos do tipo `Entrega`.
- O painel agora carrega `deliveries` e `deliveryPersons` junto com a fila de pedidos para mostrar/alterar o motoboy responsavel.
- Ao clicar em `Enviar para motoboy`, o SaaS chama `POST /api/deliveries/:id/assign` e atribui a entrega ao motoboy selecionado.
- O backend agora envia o resumo da entrega para o WhatsApp cadastrado do motoboy usando a API de mensagens do Ticketz.
- O card mostra o motoboy atual quando a entrega ja estiver atribuida e permite reenviar/alterar.

### 2026-06-26 - Financeiro com pedidos fechados e cancelados

- Transformada a aba `Financeiro` em uma tela de fechamento com pedidos finalizados, entregues e cancelados do dia.
- Pedidos cancelados continuam visiveis para conferencia, mas nao entram no faturamento, ticket medio nem totais por pagamento.
- Adicionados totais de faturamento, pedidos pagos, ticket medio, delivery pago, quantidade cancelada e valor cancelado.
- Incluida lista editavel dos pedidos financeiros, com busca por pedido, cliente, telefone, pagamento ou status.
- A edicao permite ajustar forma de pagamento, status financeiro, taxa de entrega, desconto, total, cliente e observacao.

### 2026-06-26 - Pedido concluido sem acoes no quadro operacional

- Ajustada a aba `Pedidos` para que pedidos `completed`/`delivered` aparecam apenas como `Pedido concluido`.
- Depois de finalizar, o card nao mostra mais opcoes de reimprimir, editar, cancelar ou selecionar motoboy no quadro operacional.
- Edicoes financeiras posteriores ficam concentradas na aba `Financeiro`, mantendo o fluxo operacional travado apos conclusao.

### 2026-06-26 - Edicao de mensagens automaticas ao cliente

- Adicionados campos em `company_settings` para modelos de mensagem de pedido aceito, entrega liberada e pedido pronto.
- Criada a rota `PUT /api/companies/:id/message-templates` para salvar os textos por empresa/tenant.
- O backend agora usa os modelos configurados antes de cair no texto padrao, substituindo variaveis como `{primeiro_nome}`, `{empresa}`, `{pedido}`, `{itens}`, `{total}`, `{pagamento}`, `{destino}` e `{proximo_passo}`.
- A aba `Configuracoes` do painel gerencial ganhou a secao `Mensagens automaticas`, permitindo editar os textos enviados para o cliente.
- O resumo `{itens}` agora exibe pizzas sem centimetros e sem numeracao de sabor, por exemplo `1x G - Moda da Casa - 10 fatias`.

### 2026-06-26 - Feedback visual ao adicionar item

- O cardapio publico agora destaca bebidas/sucos/itens comuns quando sao adicionados a sacola.
- O item clicado exibe temporariamente o aviso `Adicionado a sacola`, com borda verde e animacao leve.
- A tela de garcom usa a mesma regra, exibindo `Adicionado a comanda`.

### 2026-06-26 - Impressao de pizzas sem centimetros

- Ajustada a montagem do cupom para imprimir pizzas com tamanho amigavel e sabores, sem centimetros no nome.
- Exemplo de linha: `1x G - Mussarela + Frango c/ Catupiry - 10 fatias`.
- Sabores de pizza deixam de sair como bloco separado de `Adicionais`, reduzindo linhas compridas no papel.
- A largura segura da POS80 foi reduzida para 40 colunas para diminuir risco de corte lateral em impressora termica.
- Ajustada a impressao para manter a numeracao dos sabores e escrever pizzas de dois sabores como `metade 01 - Mussarela e metade 16 - Frango c/ Catupiry`, sem usar sinal de soma.

### 2026-06-26 - WhatsApp correto no envio via Ticketz

- Corrigido o envio automatico para cliente/motoboy para informar explicitamente o `whatsappId` configurado da empresa no payload enviado ao Ticketz.
- Ajustado o Ticketz para aceitar `whatsappId`/`ticketzWhatsappId` no corpo de `POST /backend/api/messages/send`, respeitando a mesma empresa do token.
- Atualizada a Big Burguer para usar a conexao conectada `8 - Pizzaria Big Burguer`; a conexao `9 - big burguer teste` estava desconectada.
- Migrado o token de API da conexao desconectada `9` para a conexao conectada `8`, mantendo o SaaS usando a API do Ticketz pelo numero real da pizzaria.
- Isso evita que confirmacoes saiam pelo numero pessoal/dono do token quando a loja possui outro WhatsApp padrao.

### 2026-06-28 - Prazo medio de entrega Big Burguer

- Ajustado o cabecalho do cardapio publico para exibir `40 a 70 min em media`, substituindo o prazo simples de 35 minutos.
- Atualizado o resumo automatico de pedido aceito para pedidos delivery, adicionando `Prazo medio para entrega: 40 a 70 minutos.`.
- Adicionada a variavel `{tempo_entrega}` aos modelos de mensagens automaticas e exibida na lista de variaveis da tela de configuracoes.
- Alterado o seed padrao de `preparationTimeMinutes` para 55 minutos, representando a media do intervalo de 40 a 70 minutos.

### 2026-06-30 - Acompanhamento do pedido pelo WhatsApp

- Ajustada a tela publica de `Meus pedidos` para nao exibir mais `Aguardando aceite` ao cliente.
- Pedidos em `waiting_confirmation` agora mostram `Acompanhe pelo WhatsApp` e um bloco com o texto `Acompanhe seu pedido pelo WhatsApp.`
- Adicionado botao `Acompanhar pelo WhatsApp`, abrindo conversa com o WhatsApp da pizzaria e mensagem preenchida com o numero do pedido.
- Corrigida a normalizacao do link do WhatsApp para evitar `55 55...` quando a empresa estiver cadastrada apenas com numero local; por padrao, numeros locais da Big Burguer recebem DDD `27`.

### 2026-06-30 - Upload de imagens no cardapio

- Adicionado endpoint autenticado `POST /api/uploads/images` para envio de imagens JPG, PNG, WEBP ou GIF ate 6MB.
- As imagens do cardapio sao salvas em `/app/uploads/menu/<companyId>` e servidas por `GET /api/uploads/files/:companyId/:fileName`.
- O volume Docker `backend_uploads` foi criado para manter as imagens mesmo apos rebuild/recriacao dos containers.
- No painel `Cardapio > Itens` e `Cardapio > Sabores e adicionais`, o campo `Imagem` agora aceita upload de arquivo, mostra previa e grava automaticamente a URL no item.
- A lista do cardapio exibe miniatura quando o item possui imagem cadastrada.

### 2026-07-03 - Resumo automatico ao acompanhar pedido no WhatsApp

- O webhook do Ticketz agora identifica mensagens inbound de acompanhamento, como `Fiz o pedido #010 e quero acompanhar por aqui`.
- Quando o cliente usa o botao `Acompanhar pelo WhatsApp`, o SaaS localiza o pedido pelo numero exibido no cardapio ou pelo telefone do cliente.
- O sistema envia automaticamente pelo Ticketz um resumo do pedido com itens, total, forma de pagamento, entrega/retirada e status atual.
- Esse caso e tratado antes do envio para o n8n, evitando respostas repetidas ou perda do resumo quando a IA nao memoriza o contexto do site.

### 2026-07-03 - Correcao conexao Ticketz Big Burguer

- Corrigido o `ticketz_whatsapp_id` da Big Burguer no SaaS de `8` para `10`, que e a conexao conectada `Pizzaria Big Burguer` no Ticketz.
- Confirmado no Ticketz que a conexao `10 - Pizzaria Big Burguer` esta `CONNECTED`, vinculada a empresa `6` e fila `4 - Recepcao`.
- Identificado que mensagens de acompanhamento podem ficar sem automacao quando o ticket esta `open` com usuario humano atribuido.
- Ajustado o backend do Ticketz para interceptar mensagens de acompanhamento de pedido antes do bloqueio por atendente humano, consultar o SaaS pelo telefone do contato e responder com resumo do pedido.
- A fila e o n8n continuam preservados para o atendimento normal; o tratamento novo atua apenas em textos de acompanhamento/status/resumo de pedido.

### 2026-07-03 - Aceite automatico de pedidos

- Ajustado o cardapio publico para aceitar automaticamente o pedido logo apos a criacao.
- Ajustada a integracao n8n/WhatsApp para tambem aceitar automaticamente pedidos criados pela IA.
- O pedido deixa de ficar parado em `waiting_confirmation` e passa direto para `confirmed`, aparecendo na coluna `Em producao`.
- O fluxo reutiliza a mesma rotina do botao `Aceitar`, mantendo geracao de impressao, criacao de entrega para delivery e tentativa de aviso ao cliente pelo Ticketz.
- Registrado log de auditoria `integration.order_auto_confirmed` para pedidos criados via n8n.

### 2026-07-03 - Aviso ao cliente ao enviar para motoboy

- Ajustado o fluxo `Enviar para motoboy` para tambem liberar o pedido como `out_for_delivery` quando ele ainda estiver em producao.
- Ao atribuir a entrega para um motoboy, o SaaS agora reutiliza a mensagem automatica de `pedido saiu para entrega` para avisar o cliente pelo Ticketz.
- Se o pedido ja estiver em rota/finalizado/cancelado, o sistema nao reenvia aviso duplicado ao cliente.
- O envio para o motoboy continua acontecendo normalmente com o resumo da entrega.

### 2026-07-03 - Horario de atendimento no bot Big Burguer

- Reforcado o prompt enviado ao n8n com o horario de atendimento cadastrado e o status atual da loja no fuso `America/Sao_Paulo`.
- A IA agora recebe instrucao explicita para, fora do horario, responder de forma curta e informar o horario de atendimento.
- Regra configurada para Big Burguer: quinta e sexta das 18:00 as 22:30; sabado e domingo das 18:00 as 23:00.
- Mensagem informativa padrao fora do horario: `No momento ainda nao estamos funcionando. Horario de funcionamento: quinta-feira das 18:00 as 22:30; sexta-feira das 18:00 as 22:30; sabado das 18:00 as 23:00; domingo das 18:00 as 23:00.`

### 2026-07-03 - Mensagem de loja fechada sem link de cardapio

- Ajustado o workflow n8n da recepcao da Big Burguer para nao enviar link do cardapio quando a loja estiver fechada ou fora do horario.
- O fluxo agora calcula o horario real pelo contexto do SaaS e bloqueia atendimento fora da janela cadastrada.
- Resposta fora de horario passa a ser apenas informativa, com a grade:
  - Quinta-feira: 18:00 as 22:30
  - Sexta-feira: 18:00 as 22:30
  - Sabado: 18:00 as 23:00
  - Domingo: 18:00 as 23:00

### 2026-08-21 - Reconexao WhatsApp da Pizzaria Big Burguer

- A conexao recriada no Ticketz recebeu o ID `21`, mas o Vib ainda apontava para o ID antigo `10`. O vinculo da empresa foi atualizado para `ticketz_whatsapp_id=21`.
- A conexao `21 - Pizzaria Big Burguer` foi associada explicitamente a fila `4 - Recepcao`, que e a fila com webhook n8n ativo.
- O Ticketz autentica o envio por `Whatsapps.token`. A nova conexao tinha sido criada sem token, portanto o Vib recebia `401 Acesso nao permitido` ao tentar enviar resumo de pedido, avisos e mensagens pelo painel.
- Foi gerado e sincronizado um token novo entre Ticketz, empresa Vib e conexao WhatsApp padrao. Nenhum segredo deve ser anotado no README.
- Validacao sem envio ao cliente: contexto do SaaS com o segredo n8n retornou `HTTP 200`; rota autenticada de envio do Ticketz passou pela autenticacao e retornou somente `HTTP 400 ERR_SYNTAX` para payload propositalmente vazio.

> **Ao recriar uma conexao do Ticketz, sempre sincronize no Vib o novo ID e o token da conexao.** Sem os dois, o chat pode abrir, mas envio manual, resumo de pedido e automacoes retornarao acesso negado.

### 2026-08-29 - Permissoes e automacoes da Pizzaria Big Burguer

- A conexao da Pizzaria foi recriada novamente no Ticketz e passou a usar o ID `23`. O Vib ainda apontava para o ID antigo `21`; o cadastro da empresa e a conexao padrao do Vib foram sincronizados para o novo ID e token, sem registrar segredos neste arquivo.
- A conexao `23 - Pizzaria Big Burguer` foi vinculada a fila `4 - Recepcao`. A fila esta com webhook n8n habilitado e URL configurada, portanto novas conversas recebidas pelo numero seguem para a automacao correta.
- O backend que estava em execucao no Ticketz era uma imagem anterior e nao reconhecia a acao `whatsapp_status`, usada pelo botao `Checar` do Vib. O backend foi reconstruido a partir do codigo atual e reiniciado.
- Validacao concluida: `POST /backend/integrations/webhook` com `action=whatsapp_status` retorna HTTP 200 para a conexao `23`, com status `CONNECTED`; `saas.correacloud.com.br` e `vib.correacloud.com.br` tambem retornam HTTP 200.

> **Regra de deploy do Ticketz:** quando forem alteradas rotas ou acoes de integracao em `fp-ticketz-custom-local/backend`, e obrigatorio reconstruir a imagem `fp-ticketz-sales-routing-alpha25-backend:test` e recriar somente o servico `backend` no compose. Alterar apenas o codigo-fonte nao atualiza o container que atende o Vib.
