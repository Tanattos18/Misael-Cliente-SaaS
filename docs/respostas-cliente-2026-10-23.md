# CuraLog — Respostas do cliente (Misael) — 23/10/2026

Transcrição automática (Whisper) dos áudios "Resposta 01–08". Trechos marcados com (?) ficaram incertos.

## Regras definidas

### 1. Medicações
- Cada paciente pode ter **várias medicações**, cada uma com frequência própria: 1x/dia, 2x/dia (12/12h), 3x/dia (8/8h).
- Atendimentos do dia = **soma das doses de todas as medicações**.
  Ex.: medicação 12/12h + medicação 8/8h = **5 atendimentos/dia**.
- Pendente: o horário final do tratamento conta? (6h→6h = 3 ou 4 doses). Doses de medicações diferentes no mesmo horário contam separado?

### 2. Tarifas padrão (enfermagem)
| Serviço | Valor |
|---|---|
| Coleta de exames | R$ 55,00 |
| Medicação | R$ 55,00 |
| Curativo | R$ 45,00 |
Alguns pacientes podem ter preço diferenciado → manter override por paciente.

### 2b. Tarifas logística — por **cidade/região × modal**
| Região (?) | Valor citado |
|---|---|
| Goiânia | R$ 25,00 |
| Aparecida de Goiânia (?) | R$ 30,00 |
| (região não identificada) (?) | R$ 35,00 |
| Goianira (?) | R$ 40,00 |
| Bela Vista de Goiás (?) | R$ 60,00 |
- Moto e carro têm valores diferentes (valores acima provavelmente de moto — confirmar tabela completa).

### 3. Curativos
- Frequência fixa: **1x por dia, 7 dias por semana**.

### 4. Usuários
- No início, só o Misael e talvez mais uma pessoa.

### 5. Fechamento
- **Mês cheio** (dia 1 ao último dia do mês). (?)

### 6. Planilha
- Sem modelo exigido pelas empresas.
- Separar por **empresa e área**: ex. "Enfermagem – Empresa X", "Logística – Empresa Y".

### 7. Transportadora terceirizada
- Misael **paga a transportadora antes** (ex.: corridas para o interior) e recebe da empresa contratante depois.
- Valor cobrado = custo da transportadora **+ 30%** (25% administrativo + 5% por adiantar o dinheiro).
  Ex.: custo R$ 100,00 → cobra R$ 130,00.
- O custo é informado na hora do lançamento.

### 8. Volume / hospedagem
- Resposta pouco clara ("depende, tem mês com menos"). (?)

## Impacto no modelo de dados
- Nova entidade **Região/Cidade**; paciente vinculado a uma região.
- **Tarifa logística** = região × modal (com override por paciente).
- **Plano de medicação** com N itens (medicação + frequência/horários) por paciente.
- Lançamento de terceirizado guarda **custo** e **% de acréscimo** (padrão 30%, configurável); gera automaticamente a despesa "pagamento transportador".
- Fechamento e planilhas: um arquivo por **empresa × área** (Enfermagem / Logística).
- Perfis de acesso simplificados (admin + operador), mantendo login e auditoria (LGPD).
