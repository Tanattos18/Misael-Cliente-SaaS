# CuraLog — Sistema de gestão

Sistema web de gestão da **CuraLog**: enfermagem domiciliar (medicações, curativos e coletas), logística de home care (moto, carro e transportador terceirizado), fechamento mensal por empresa contratante com planilhas Excel/PDF, controle de recebimentos, despesas e resultado financeiro por área.

> **Status:** em finalização para entrega. As quatro etapas da proposta estão implementadas e testadas; falta a implantação em produção com os dados reais (ver [Pendências para a entrega](#pendências-para-a-entrega)).

Desenvolvido por **Akylla Studio** — Joás Santana Nascimento · WhatsApp (62) 99165-7619 · [akyllastudio.github.io](https://akyllastudio.github.io).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Regras de negócio](#regras-de-negócio)
- [Tecnologia](#tecnologia)
- [Como rodar localmente](#como-rodar-localmente)
- [Scripts](#scripts)
- [Testes](#testes)
- [Estrutura do código](#estrutura-do-código)
- [Segurança e LGPD](#segurança-e-lgpd)
- [Produção e backup](#produção-e-backup)
- [Documentação](#documentação)
- [Pendências para a entrega](#pendências-para-a-entrega)
- [Evoluções possíveis](#evoluções-possíveis)

---

## Funcionalidades

| Módulo | Tela | O que faz |
|---|---|---|
| **Painel** | `/` | Alertas do dia (fechamentos em atraso, mês anterior sem fechamento, envios pendentes, tratamentos sem conferência) e indicadores do mês: faturamento por serviço, despesas, resultado e margem, corridas por modal, a receber por empresa, pacientes de maior faturamento e gráfico de 6 meses. |
| **Tratamentos** | `/tratamentos` | Medicações (várias por paciente, cada uma com sua frequência) e curativos; cálculo automático das doses previstas; conferência dia a dia **previsto × realizado**. |
| **Lançamentos** | `/lancamentos` | Coletas, atendimentos avulsos e corridas; tarifa preenchida automaticamente; correção e cancelamento com motivo; bloqueio de cobrança em dobro. |
| **Fechamento mensal** | `/fechamentos/novo` | Prévia e geração do fechamento por empresa e área (Enfermagem / Logística), individual ou de todas as empresas; valores congelados; **Excel e PDF** por paciente, com datas, quantidades, valores unitários e totais. |
| **Recebimentos** | `/fechamentos` | Calculado → enviado → aprovado → NF emitida → pago, com vencimento automático e indicação de atraso. |
| **Despesas** | `/despesas` | Combustível (litros e km), manutenção, óleo/pneus/peças, transportadores, pedágios e outras; apropriação por área e modal. |
| **Resultado** | `/resultado` | Receita × despesa por área e por modal, despesas por categoria vs mês anterior, consumo por veículo, comparativo de 6 meses e Excel para o contador. |
| **Cadastros** | `/empresas`, `/pacientes`, `/regioes`, `/tarifas`, `/veiculos` | Empresas (com prazo de pagamento), pacientes (empresa e região), cidades, tarifas e veículos (com área de uso). |
| **Administração** | `/usuarios`, `/configuracoes`, `/auditoria` | Usuários e perfis, acréscimo do terceirizado, regra da dose no término e registro de todas as ações. |

---

## Regras de negócio

**Tarifas** — vale a mais específica: **paciente › empresa › região › padrão**. Corridas são cobradas por região × modal (moto ou carro). Padrões informados pela CuraLog: medicação R$ 55, curativo R$ 45, coleta R$ 55; corridas de moto por cidade. O valor é copiado para o lançamento: mudar a tarifa depois não altera o histórico.

**Transportador terceirizado** — cobra-se o custo da transportadora + **30%** (25% administrativo + 5% pelo adiantamento), configurável. O custo entra automaticamente como despesa do modal terceirizado.

**Doses previstas** (`src/lib/doses.ts`)
- Cada dose de cada medicação é um atendimento: 8/8h + 12/12h = **5 por dia**.
- Doses anteriores ao horário de início não contam.
- A dose no horário exato do término **não conta** por padrão: das 6h às 6h, com doses às 6h, 14h e 22h, são **3 doses**. A regra pode ser alterada em Configurações.

**Cobrança** — sempre pelo **realizado**. A conferência registra quantos atendimentos foram feitos em cada dia (0 = não realizado, não cobrado). Lançamento avulso de medicação ou curativo para paciente com tratamento ativo é bloqueado, salvo confirmação de atendimento extra; a conferência sinaliza avulsos no mesmo dia.

**Fechamento** — um por empresa, área e mês. Ao gerar, os itens são copiados (cópia congelada) e os lançamentos ficam travados; o relatório é sempre gerado dessa cópia. Para corrigir, o administrador reabre o fechamento (nunca um já pago) e gera um novo.

**Resultado** — receita pela data do serviço; despesa pela data do gasto. Despesas de veículo vão para a área que usa o veículo (logística ou enfermagem; na logística, também para o modal). Despesas "gerais" entram só no resultado total.

**Histórico** — nada é apagado: correções e cancelamentos guardam motivo e ficam na auditoria.

---

## Tecnologia

- **Next.js 16** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **PostgreSQL** com **Drizzle ORM** — em desenvolvimento, sem `DATABASE_URL`, usa **PGlite** (Postgres embutido, sem instalar nada)
- **ExcelJS** (planilhas) e **jsPDF + autotable** (PDF)
- Autenticação própria: bcrypt + cookie de sessão JWT (`jose`), perfis `admin` e `operador`
- **Vitest** (unitários e integração) + **embedded-postgres** (validação em PostgreSQL real)

---

## Como rodar localmente

Requisitos: Node.js 24.

```bash
npm install
cp .env.example .env        # preencha SESSION_SECRET e ADMIN_PASSWORD
npm run db:migrate          # cria as tabelas
npm run db:seed             # administrador, tarifas padrão e regiões
npm run db:demo             # (opcional) dados fictícios para demonstração
npm run dev                 # http://localhost:3000
```

- O banco local fica em `~/.curalog/pglite`, fora da pasta do projeto, para não ser sincronizado por OneDrive/Dropbox.
- O PGlite aceita **um processo por vez**: pare o `npm run dev` antes de rodar `db:migrate`, `db:seed`, `db:demo` ou `db:senha`.
- Para recriar o banco de demonstração do zero: pare o servidor, apague `~/.curalog/pglite` e rode `db:migrate`, `db:seed` e `db:demo`.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Servidor Next.js (desenvolvimento / build / produção) |
| `npm test` | Testes unitários e de integração (PGlite em memória) |
| `npm run test:pg -- --paginas` | Sobe um PostgreSQL temporário, roda os testes, migrações, carga e demonstração e abre todas as telas e downloads |
| `npm run typecheck` / `lint` | Verificação de tipos e lint |
| `npm run db:generate` | Gera uma migração após alterar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações (`drizzle/`) |
| `npm run db:seed` | Carga inicial: administrador, tarifas padrão e regiões |
| `npm run db:demo` | Dados fictícios: 3 empresas, 9 pacientes, tratamentos, corridas, despesas e fechamentos |
| `npm run db:senha -- <email> <senha> [--provisoria]` | Redefine a senha de um usuário e o reativa; `--provisoria` obriga a troca no próximo acesso |
| `scripts/backup.sh` | Backup diário com `pg_dump` (servidor próprio) — ver [docs/PRODUCAO.md](docs/PRODUCAO.md) |

---

## Testes

```bash
npm test                         # 48 testes
npm run test:pg -- --paginas     # mesma suíte + telas em PostgreSQL real
```

Cobrem as regras de tarifa e do terceirizado, o cálculo de doses (inclusive o exemplo do cliente), a conferência previsto × realizado, o fechamento (cópia congelada, bloqueio, reabertura), o resultado por área/modal, o bloqueio de login e a geração de Excel/PDF.

---

## Estrutura do código

```
src/
  app/
    (app)/                 telas autenticadas (painel, tratamentos, lançamentos,
                           fechamentos, despesas, resultado, cadastros, administração)
    api/fechamentos/[id]/[formato]   download Excel/PDF do fechamento
    api/resultado/[mes]              Excel do resultado mensal
    login/, trocar-senha/            acesso
  components/              UI compartilhada, gráfico, formulário sem reset em erro (use-acao)
  db/schema.ts             tabelas (Drizzle)
  db/index.ts              conexão (PostgreSQL ou PGlite)
  lib/
    tarifas.ts             resolução de tarifa e cálculo do terceirizado
    doses.ts               doses previstas de um tratamento
    planos.ts              tratamentos, conferência e realizados
    lancamentos.ts         tarifa aplicável e bloqueio por fechamento
    fechamento.ts          prévia, geração, reabertura e relatório congelado
    resultado.ts           apuração do resultado por área e modal
    relatorio/             modelo do relatório + Excel e PDF
    auth.ts, sessao.ts, login.ts   sessão, permissões e bloqueio de login
    auditoria.ts           registro de ações
  proxy.ts                 redireciona para /login sem sessão
drizzle/                   migrações SQL (0000–0004)
scripts/                   migrate, seed, demo, redefinir-senha, testar-postgres, backup
docs/                      produção, respostas do cliente e proposta comercial
```

---

## Segurança e LGPD

- Senhas com bcrypt; mínimo de 8 caracteres com letras e números; senha provisória com troca obrigatória no primeiro acesso.
- Bloqueio por 15 minutos após 5 erros de login no mesmo e-mail (ou 20 no mesmo IP).
- Sessão em cookie `httpOnly` assinado, 12 horas; usuário desativado perde o acesso na hora (inclusive nos downloads).
- Perfis: `admin` (tudo) e `operador` (sem usuários, configurações do sistema, auditoria e reabertura de fechamento).
- Auditoria de alterações, cancelamentos, logins e downloads de relatórios.
- Cabeçalhos HTTP de segurança: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy.
- Formulários não enviam dados pela URL, nem antes de a página carregar.

---

## Produção e backup

Guia completo — Supabase + Vercel ou servidor próprio, variáveis de ambiente, backup, restauração e checklist LGPD: **[docs/PRODUCAO.md](docs/PRODUCAO.md)**.

Resumo:

1. Defina `DATABASE_URL` e `SESSION_SECRET` (sem `DATABASE_URL` o sistema **não sobe** em produção).
2. `npm run db:migrate` e `npm run db:seed` com `ADMIN_PASSWORD` vazio: é gerada uma senha provisória, com troca obrigatória.
3. Publique com `npm run build && npm start` (servidor próprio) ou pela Vercel.
4. Backup diário automático (Supabase Pro) ou `scripts/backup.sh` no cron (servidor próprio), com teste de restauração.

Antes de cada publicação: `npm run test:pg -- --paginas`.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/PRODUCAO.md](docs/PRODUCAO.md) | Implantação, variáveis, backup, segurança e checklist LGPD |
| [docs/respostas-cliente-2026-10-23.md](docs/respostas-cliente-2026-10-23.md) | Regras de negócio definidas pelo cliente (respostas de 23/10/2026) |
| [docs/proposta/](docs/proposta/) | Proposta comercial (HTML e PDF) |

Material de apoio entregue separadamente: guia de uso do sistema em slides e apresentação comercial da CuraLog para as empresas contratantes.

---

## Pendências para a entrega

- [ ] Confirmar com o cliente as regras de doses (término exclusivo; doses de medicações diferentes no mesmo horário contadas separadamente).
- [ ] Receber a tabela de corridas de **carro** por cidade e o nome da cidade de R$ 35.
- [ ] Definir a área de uso de cada veículo (logística ou enfermagem).
- [ ] Escolher e contratar a hospedagem; publicar com domínio e HTTPS.
- [ ] Cadastro inicial com os dados reais (empresas, pacientes, tarifas e veículos) e treinamento da equipe.
- [ ] Rodar `scripts/backup.sh` uma vez no servidor e testar a restauração (só no caso de servidor próprio).

---

## Evoluções possíveis

- Busca de paciente nos formulários e paginação nas listas longas.
- Fechamento complementar (lançamentos depois do fechamento já enviado).
- Aplicativo/PWA para a equipe marcar dose realizada e corrida no celular.
- Portal para a empresa contratante conferir e aprovar o fechamento online.
- Emissão de NFS-e integrada e aviso de atraso por e-mail/WhatsApp.
- Importação de pacientes e empresas a partir de planilhas.

---

© 2026 CuraLog. Sistema desenvolvido sob encomenda por Akylla Studio; uso e propriedade do código conforme contrato.
