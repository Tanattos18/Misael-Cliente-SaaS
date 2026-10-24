import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const valor = (nome: string) => numeric(nome, { precision: 12, scale: 2, mode: "number" });
const criadoEm = () => timestamp("criado_em", { withTimezone: true }).defaultNow().notNull();

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  perfil: text("perfil", { enum: ["admin", "operador"] }).notNull().default("operador"),
  ativo: boolean("ativo").notNull().default(true),
  // Senha provisória (criada por outra pessoa): obriga a troca no próximo acesso.
  trocarSenha: boolean("trocar_senha").notNull().default(false),
  criadoEm: criadoEm(),
});

/** Histórico de tentativas de login, usado para bloquear quem tenta adivinhar senhas. */
export const tentativasLogin = pgTable(
  "tentativas_login",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    sucesso: boolean("sucesso").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("tentativas_email_idx").on(t.email, t.criadoEm), index("tentativas_ip_idx").on(t.ip, t.criadoEm)],
);

export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  contato: text("contato"),
  email: text("email"),
  telefone: text("telefone"),
  // Prazo em dias, após o envio do relatório, para calcular o vencimento.
  prazoPagamentoDias: integer("prazo_pagamento_dias").notNull().default(30),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

export const regioes = pgTable("regioes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

export const pacientes = pgTable(
  "pacientes",
  {
    id: serial("id").primaryKey(),
    nome: text("nome").notNull(),
    empresaId: integer("empresa_id")
      .notNull()
      .references(() => empresas.id),
    regiaoId: integer("regiao_id").references(() => regioes.id),
    endereco: text("endereco"),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index("pacientes_empresa_idx").on(t.empresaId)],
);

/**
 * Tarifas em hierarquia. Para um mesmo tipo de serviço (e modal, nas corridas),
 * vale a mais específica: paciente > empresa > região > padrão (sem vínculo).
 */
export const tarifas = pgTable("tarifas", {
  id: serial("id").primaryKey(),
  tipo: text("tipo", { enum: ["medicacao", "curativo", "coleta", "corrida"] }).notNull(),
  modal: text("modal", { enum: ["moto", "carro"] }),
  pacienteId: integer("paciente_id").references(() => pacientes.id),
  empresaId: integer("empresa_id").references(() => empresas.id),
  regiaoId: integer("regiao_id").references(() => regioes.id),
  valor: valor("valor").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
});

export const fechamentos = pgTable(
  "fechamentos",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id")
      .notNull()
      .references(() => empresas.id),
    area: text("area", { enum: ["enfermagem", "logistica"] }).notNull(),
    // Mês de referência no formato AAAA-MM.
    competencia: text("competencia").notNull(),
    periodoInicio: date("periodo_inicio", { mode: "string" }).notNull(),
    periodoFim: date("periodo_fim", { mode: "string" }).notNull(),
    quantidadeItens: integer("quantidade_itens").notNull(),
    total: valor("total").notNull(),
    status: text("status", {
      enum: ["calculado", "enviado", "aprovado", "nf_emitida", "pago", "reaberto"],
    })
      .notNull()
      .default("calculado"),
    numeroNf: text("numero_nf"),
    dataEnvio: date("data_envio", { mode: "string" }),
    dataAprovacao: date("data_aprovacao", { mode: "string" }),
    dataNf: date("data_nf", { mode: "string" }),
    dataVencimento: date("data_vencimento", { mode: "string" }),
    dataPagamento: date("data_pagamento", { mode: "string" }),
    valorPago: valor("valor_pago"),
    observacoes: text("observacoes"),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("fechamentos_competencia_idx").on(t.competencia, t.empresaId)],
);

/**
 * Tratamento contínuo (medicação ou curativo): gera os atendimentos previstos.
 * Os realizados são lançamentos com plano_id, um por dia, com a quantidade feita.
 */
export const planos = pgTable(
  "planos",
  {
    id: serial("id").primaryKey(),
    pacienteId: integer("paciente_id")
      .notNull()
      .references(() => pacientes.id),
    tipo: text("tipo", { enum: ["medicacao", "curativo"] }).notNull(),
    inicioData: date("inicio_data", { mode: "string" }).notNull(),
    inicioHora: text("inicio_hora").notNull(),
    fimData: date("fim_data", { mode: "string" }),
    fimHora: text("fim_hora"),
    // Vazio: usa a tarifa vigente do paciente no momento da confirmação.
    valorUnitario: valor("valor_unitario"),
    observacoes: text("observacoes"),
    ativo: boolean("ativo").notNull().default(true),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("planos_paciente_idx").on(t.pacienteId)],
);

export const planoItens = pgTable("plano_itens", {
  id: serial("id").primaryKey(),
  planoId: integer("plano_id")
    .notNull()
    .references(() => planos.id, { onDelete: "cascade" }),
  descricao: text("descricao").notNull(),
  // Horários separados por vírgula, ex.: "06:00,14:00,22:00".
  horarios: text("horarios").notNull(),
});

export const lancamentos = pgTable(
  "lancamentos",
  {
    id: serial("id").primaryKey(),
    area: text("area", { enum: ["enfermagem", "logistica"] }).notNull(),
    tipo: text("tipo", { enum: ["medicacao", "curativo", "coleta", "corrida"] }).notNull(),
    pacienteId: integer("paciente_id")
      .notNull()
      .references(() => pacientes.id),
    // Copiada do paciente no lançamento: se o paciente mudar de empresa, o histórico não muda.
    empresaId: integer("empresa_id")
      .notNull()
      .references(() => empresas.id),
    data: date("data", { mode: "string" }).notNull(),
    hora: text("hora"),
    quantidade: integer("quantidade").notNull().default(1),
    valorUnitario: valor("valor_unitario").notNull(),
    valorTotal: valor("valor_total").notNull(),
    modal: text("modal", { enum: ["moto", "carro", "terceirizado"] }),
    origem: text("origem"),
    destino: text("destino"),
    // Corridas terceirizadas: custo pago à transportadora e acréscimo cobrado da empresa.
    custoTerceiro: valor("custo_terceiro"),
    percentualAcrescimo: numeric("percentual_acrescimo", { precision: 5, scale: 2, mode: "number" }),
    status: text("status", { enum: ["previsto", "realizado", "cancelado"] })
      .notNull()
      .default("realizado"),
    motivoCancelamento: text("motivo_cancelamento"),
    observacoes: text("observacoes"),
    fechamentoId: integer("fechamento_id").references(() => fechamentos.id),
    planoId: integer("plano_id").references(() => planos.id),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    criadoEm: criadoEm(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("lancamentos_data_idx").on(t.data),
    index("lancamentos_plano_data_idx").on(t.planoId, t.data),
    index("lancamentos_empresa_data_idx").on(t.empresaId, t.data),
    index("lancamentos_paciente_idx").on(t.pacienteId),
  ],
);

export const veiculos = pgTable("veiculos", {
  id: serial("id").primaryKey(),
  descricao: text("descricao").notNull(),
  placa: text("placa"),
  modal: text("modal", { enum: ["moto", "carro"] }).notNull(),
  // Área que usa o veículo: os custos dele vão para essa área no resultado.
  uso: text("uso", { enum: ["logistica", "enfermagem"] }).notNull().default("logistica"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

export const despesas = pgTable(
  "despesas",
  {
    id: serial("id").primaryKey(),
    data: date("data", { mode: "string" }).notNull(),
    categoria: text("categoria", {
      enum: ["combustivel", "manutencao", "oleo_pneus_pecas", "terceirizado", "pedagio_estacionamento", "outras"],
    }).notNull(),
    descricao: text("descricao"),
    valor: valor("valor").notNull(),
    // Para qual área/modal o custo é apropriado no resultado. "geral" = custo da empresa como um todo.
    area: text("area", { enum: ["enfermagem", "logistica", "geral"] }).notNull(),
    modal: text("modal", { enum: ["moto", "carro", "terceirizado"] }),
    veiculoId: integer("veiculo_id").references(() => veiculos.id),
    litros: numeric("litros", { precision: 10, scale: 2, mode: "number" }),
    km: integer("km"),
    status: text("status", { enum: ["ativa", "cancelada"] }).notNull().default("ativa"),
    motivoCancelamento: text("motivo_cancelamento"),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("despesas_data_idx").on(t.data)],
);

/** Cópia congelada dos itens de um fechamento: o relatório é sempre gerado a partir daqui. */
export const fechamentoItens = pgTable(
  "fechamento_itens",
  {
    id: serial("id").primaryKey(),
    fechamentoId: integer("fechamento_id")
      .notNull()
      .references(() => fechamentos.id, { onDelete: "cascade" }),
    lancamentoId: integer("lancamento_id")
      .notNull()
      .references(() => lancamentos.id),
    pacienteNome: text("paciente_nome").notNull(),
    tipo: text("tipo").notNull(),
    modal: text("modal"),
    data: date("data", { mode: "string" }).notNull(),
    hora: text("hora"),
    origem: text("origem"),
    destino: text("destino"),
    quantidade: integer("quantidade").notNull(),
    valorUnitario: valor("valor_unitario").notNull(),
    valorTotal: valor("valor_total").notNull(),
    observacoes: text("observacoes"),
  },
  (t) => [index("fechamento_itens_fechamento_idx").on(t.fechamentoId)],
);

export const auditoria = pgTable(
  "auditoria",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: integer("entidade_id"),
    dados: jsonb("dados"),
    criadoEm: criadoEm(),
  },
  (t) => [index("auditoria_entidade_idx").on(t.entidade, t.entidadeId)],
);
