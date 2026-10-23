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
| `npm run db:senha -- <email> <senha>` | Redefine a senha de um usuário (e o reativa) |

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

## Pendências com o cliente

1. Medicação: o horário final do tratamento conta (6h→6h = 3 ou 4 doses)? Doses de medicações diferentes no mesmo horário contam separadas?
2. Tabela completa de cidades com valores de **moto e carro** (hoje só moto: Goiânia 25, Aparecida 30, Goianira 40, Bela Vista 60; falta a cidade de R$ 35).
3. Volume mensal aproximado (pacientes/corridas) para dimensionar a hospedagem.

## Próximas etapas

- **Etapa 2:** planos de medicação (várias medicações por paciente com frequências 24/12/8h) e curativos diários, geração de previstos e conferência previsto × realizado.
- **Etapa 3:** despesas (combustível com litros, manutenção por veículo, pedágios), pagamento de terceirizados como despesa, resultado por área e por modal.
- **Etapa 4:** painel gerencial completo, comparativos entre meses.

## Produção

Defina `DATABASE_URL` (PostgreSQL, ex.: Supabase região São Paulo) e `SESSION_SECRET`, rode `npm run db:migrate` e `npm run db:seed` uma vez e publique (Vercel ou VPS com `npm run build && npm start`).
