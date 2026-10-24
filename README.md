# CuraLog — Sistema de gestão

Gestão de enfermagem (medicações, curativos, coletas), logística home care (moto, carro, terceirizado), fechamento mensal por empresa e controle de recebimentos.

## Stack

- **Next.js 16** (App Router, Server Actions) + TypeScript + Tailwind CSS 4
- **PostgreSQL** com **Drizzle ORM** — em desenvolvimento, sem `DATABASE_URL`, usa **PGlite** (Postgres embutido, sem instalar nada)
- **ExcelJS** (planilhas) e **jsPDF + autotable** (PDF)
- Login próprio (bcrypt + cookie JWT assinado com `jose`), perfis `admin` e `operador`, trilha de auditoria
- **Vitest** para testes

## Como rodar

```bash
npm install
cp .env.example .env        # preencha SESSION_SECRET e ADMIN_PASSWORD
npm run db:migrate          # cria as tabelas
npm run db:seed             # admin + tarifas padrão + regiões
npm run dev                 # http://localhost:3000
```

O banco local fica em `~/.curalog/pglite` (fora do OneDrive de propósito — sincronizar arquivos de banco abertos pode corrompê-los). Pare o `npm run dev` antes de rodar `db:migrate`/`db:seed`: o PGlite só aceita um processo por vez.

| Script | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Servidor Next.js |
| `npm test` | Testes (unitários + integração com PGlite em memória) |
| `npm run typecheck` / `lint` | Verificações |
| `npm run db:generate` | Gera migração após alterar `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Aplica migrações / carga inicial |
| `npm run db:demo` | Dados fictícios para demonstração (3 empresas, 9 pacientes, set/out) |
| `npm run db:senha -- <email> <senha> [--provisoria]` | Redefine a senha de um usuário (e o reativa); `--provisoria` obriga a troca no próximo acesso |
| `npm run test:pg -- --paginas` | Valida tudo num PostgreSQL real temporário |

## Etapa 1 — o que já está pronto

- **Cadastros:** empresas (com prazo de pagamento), pacientes (empresa + região), regiões, tarifas, usuários.
- **Tarifas em hierarquia:** paciente › empresa › região › padrão. Corridas por **região × modal**. Padrões do cliente: medicação R$ 55, curativo R$ 45, coleta R$ 55; corridas de moto por cidade.
- **Lançamento rápido:** escolhe o paciente → empresa e valor preenchidos (pode alterar). Mantém data/serviço para lançar vários pacientes seguidos (ex.: 3 coletas no mesmo dia).
- **Terceirizado:** informa o custo da transportadora; cobra custo + **30%** (configurável).
- **Correção e cancelamento** com motivo; nada é apagado; tudo vai para a auditoria.
- **Fechamento mensal** por empresa × área (Enfermagem / Logística): prévia, geração individual ou “gerar todos”, cópia congelada dos itens, lançamentos bloqueados após fechar, reabertura (admin) com motivo.
- **Planilhas Excel e PDF:** resumo, total a pagar, uma aba/seção por serviço (ou por modal), detalhado por paciente com datas, quantidades, valor unitário e subtotais.
- **Recebimentos:** calculado → enviado → aprovado → NF emitida → pago, com vencimento pelo prazo da empresa e indicação de **em atraso**.
- **Painel** do mês: faturamento por serviço/área, corridas por modal, a receber por empresa.

## Estrutura

```
src/
  db/schema.ts            tabelas (Drizzle)
  db/index.ts             conexão (Postgres ou PGlite)
  lib/tarifas.ts          resolução de tarifa e cálculo do terceirizado (regra pura, testada)
  lib/fechamento.ts       prévia, geração, reabertura, relatório a partir da cópia congelada
  lib/relatorio/          modelo do relatório + geradores Excel e PDF
  lib/auth.ts, sessao.ts  sessão e controle de acesso
  app/(app)/...           telas (painel, lançamentos, fechamentos, cadastros, admin)
  app/api/fechamentos/[id]/[formato]   download Excel/PDF
  proxy.ts                redireciona para /login sem sessão
drizzle/                  migrações SQL
scripts/                  migrate e seed
```

## Etapa 2 — tratamentos (previsto × realizado)

- **Tratamentos** de medicação (várias medicações por paciente, cada uma com sua frequência: 1x, 12/12h, 8/8h, 6/6h, 4/4h ou horários livres) e de curativo (1x/dia, contínuo ou com término).
- **Previstos calculados** por dia a partir de início/término com data e hora. Cada dose de cada medicação conta como um atendimento (8/8h + 12/12h = 5/dia). Doses antes do início não contam; o horário exato do término **não conta** por padrão (6h→6h com 6h/14h/22h = 3 doses) — ajustável em Configurações.
- **Conferência** mensal por tratamento: previsto × realizado dia a dia, com dias pendentes, parciais e não realizados (0). Atalho “confirmar pendentes como previsto”.
- Os realizados viram lançamentos normais (um por dia, com a quantidade feita) e entram no fechamento; depois de fechados não mudam.
- A lista de tratamentos mostra quantos dias estão sem conferência.

Regra em `src/lib/doses.ts` (testada em `doses.test.ts`); persistência em `src/lib/planos.ts`.

## Etapa 3 — financeiro

- **Veículos** (motos e carros) com gasto total, combustível e preço médio por litro.
- **Despesas** por categoria: combustível (litros e hodômetro), manutenção, óleo/pneus/peças, transportadores terceirizados, pedágios/estacionamentos e outras. Correção e cancelamento com motivo e auditoria.
- **Apropriação do custo:** despesa com veículo vai para a área que usa o veículo (cadastro: logística ou enfermagem; na logística, também para o modal); sem veículo, escolhe-se a área (Enfermagem, Logística + modal, ou Geral). O custo pago às transportadoras nas corridas terceirizadas entra **automaticamente** como despesa.
- **Resultado** (`/resultado`): receita × despesa por área (enfermagem, logística, gerais), por modal (moto, carro, terceirizado), receita por serviço, despesas por categoria vs mês anterior, combustível por veículo (R$/L, km rodados, km/L) e comparativo dos últimos 6 meses com gráfico.

Cálculo em `src/lib/resultado.ts` (testado em `resultado.test.ts`).

## Etapa 4 — painel gerencial

- **Painel** (`/`): alertas (fechamentos em atraso, mês anterior sem fechamento, fechamentos aguardando envio, dias de tratamento sem conferência), faturamento/despesas/resultado/margem, a receber e em atraso, faturamento por serviço, corridas por modal, combustível e manutenção, resultado por área e modal, a receber por empresa, faturamento por empresa no mês, pacientes com maior faturamento e gráfico receita × despesa de 6 meses.
- **Excel do resultado mensal** (`/api/resultado/AAAA-MM`): resumo por área/modal, receita por serviço, despesas por categoria e lista de despesas — para o contador.

## Pendências com o cliente

1. Confirmar as duas regras adotadas: término exclusivo (3 doses no exemplo 6h→6h) e doses de medicações diferentes no mesmo horário contadas separadamente.
2. Tabela completa de cidades com valores de **moto e carro** (hoje só moto: Goiânia 25, Aparecida 30, Goianira 40, Bela Vista 60; falta a cidade de R$ 35).
3. Volume mensal aproximado (pacientes/corridas) para dimensionar a hospedagem.

## Próximos passos possíveis

- Publicar em produção (Supabase + Vercel ou VPS) e cadastrar os dados reais.
- PWA/app para a equipe marcar dose realizada e corrida no celular.
- Portal para a empresa contratante conferir e aprovar o fechamento online.
- Emissão de NFS-e integrada e aviso de atraso por e-mail/WhatsApp.

## Produção

Guia completo (Supabase + Vercel ou VPS, variáveis, backup, segurança e checklist LGPD): **[docs/PRODUCAO.md](docs/PRODUCAO.md)**.

Antes de publicar, valide num PostgreSQL real (sobe um Postgres temporário, roda testes, migrações, demonstração e abre todas as telas):

```bash
npm run test:pg -- --paginas
```
