# Cardapio publico multitenant

Primeira integracao do modelo Big Burguer ao `vib-saas-platform`.

## URL publica

```text
/cardapio/:companySlug
```

Exemplo:

```text
/cardapio/pizzaria-big-burguer
```

## URL para garcom

```text
/garcom/:companySlug
```

Exemplo:

```text
/garcom/pizzaria-big-burguer
```

A tela de garcom foi criada para atendimento de mesa/salao. O garcom informa a mesa, seleciona itens junto com o cliente e envia o pedido para a fila como `orderType: table`.

O painel administrativo continua separado e protegido por login. O cliente final nao ve rota de admin nem precisa criar conta.

## API publica

```http
GET /api/public/:slug/menu
POST /api/public/:slug/orders
GET /api/public/:slug/orders?phone=11999999999
```

`GET /menu` retorna:

- dados publicos da empresa;
- status de aceite de pedidos;
- categorias ativas;
- produtos ativos/disponiveis;
- grupos de adicionais;
- adicionais/sabores ativos.

`POST /orders` cria pedido com status `waiting_confirmation`.

O pedido publico nao confirma automaticamente. O aceite continua sendo uma acao administrativa pelo painel/API autenticada.

Para pedidos de mesa:

- `orderType` deve ser `table`;
- `table.number` e obrigatorio;
- telefone do cliente nao e obrigatorio;
- `table.waiterName` e opcional;
- `table.customerName` e opcional;
- mesa e garcom sao gravados em `notes`.

## Modelo de pizza

Para nao criar tabela nova nesta primeira etapa, pizza foi modelada assim:

- cada tamanho e um `Product`;
- o grupo `Sabores` e um `ProductAddonGroup`;
- cada sabor e um `ProductAddon`;
- `ProductAddonGroup.minChoices = 1`;
- `ProductAddonGroup.maxChoices = 2`;
- em pedidos com 2 sabores, o backend calcula o valor pelo maior preco selecionado.

Isso permite:

- editar tamanhos em `Produtos`;
- editar sabores em `Adicionais e sabores`;
- reaproveitar a mesma estrutura para outros clientes alimenticios;
- manter pedidos, impressao e delivery no modelo central do SaaS.

## Seed Big Burguer

Arquivos envolvidos:

```text
backend/prisma/big-burguer-menu.json
backend/prisma/seed.ts
```

O seed cria a empresa:

```text
slug: pizzaria-big-burguer
nome: Pizzaria Big Burguer
```

Tambem cria:

- categorias Pizzas, Refrigerantes e Sucos;
- quatro produtos de tamanho de pizza;
- grupo de sabores com limite de ate 2 por tamanho;
- refrigerantes e sucos;
- forma de pagamento;
- impressora padrao de cozinha/entrega.

## Frontend

Arquivos envolvidos:

```text
frontend/src/public-menu.tsx
frontend/src/main.tsx
frontend/src/styles.css
frontend/public/*
```

O `main.tsx` decide a tela por rota:

- `/cardapio/:slug`: cardapio publico;
- qualquer outra rota: painel administrativo.

## Proximos passos

- Criar pagina operacional de pedidos com fila, preparo, rota e mesa dentro do painel SaaS.
- Melhorar edicao de cardapio com telas especificas em vez do CRUD generico.
- Adicionar endereco salvo por telefone no checkout publico.
- Conectar aceite de pedido a impressao automatica.
- Proteger publicacao com dominio/HTTPS e nao expor portas diretas em producao.
