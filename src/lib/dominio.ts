export const AREAS = ["enfermagem", "logistica"] as const;
export type Area = (typeof AREAS)[number];

export const TIPOS = ["medicacao", "curativo", "coleta", "corrida"] as const;
export type Tipo = (typeof TIPOS)[number];

export const TIPOS_ENFERMAGEM = ["medicacao", "curativo", "coleta"] as const satisfies readonly Tipo[];

export const MODAIS = ["moto", "carro", "terceirizado"] as const;
export type Modal = (typeof MODAIS)[number];

export const STATUS_FECHAMENTO = [
  "calculado",
  "enviado",
  "aprovado",
  "nf_emitida",
  "pago",
  "reaberto",
] as const;
export type StatusFechamento = (typeof STATUS_FECHAMENTO)[number];

export const ROTULO_AREA: Record<Area, string> = {
  enfermagem: "Enfermagem",
  logistica: "Logística",
};

export const ROTULO_TIPO: Record<Tipo, string> = {
  medicacao: "Medicação",
  curativo: "Curativo",
  coleta: "Coleta de exames",
  corrida: "Corrida",
};

export const ROTULO_TIPO_PLURAL: Record<Tipo, string> = {
  medicacao: "Medicações",
  curativo: "Curativos",
  coleta: "Coletas de exames",
  corrida: "Corridas",
};

export const ROTULO_MODAL: Record<Modal, string> = {
  moto: "Moto",
  carro: "Carro",
  terceirizado: "Transportador terceirizado",
};

export const ROTULO_STATUS: Record<StatusFechamento | "em_atraso", string> = {
  calculado: "Calculado — aguardando envio",
  enviado: "Enviado p/ conferência",
  aprovado: "Aprovado pela empresa",
  nf_emitida: "NF emitida",
  pago: "Pago",
  reaberto: "Reaberto (substituído)",
  em_atraso: "Em atraso",
};

export function areaDoTipo(tipo: Tipo): Area {
  return tipo === "corrida" ? "logistica" : "enfermagem";
}

export const CATEGORIAS_DESPESA = [
  "combustivel",
  "manutencao",
  "oleo_pneus_pecas",
  "terceirizado",
  "pedagio_estacionamento",
  "outras",
] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

export const ROTULO_CATEGORIA: Record<CategoriaDespesa, string> = {
  combustivel: "Combustível",
  manutencao: "Manutenção",
  oleo_pneus_pecas: "Óleo, pneus e peças",
  terceirizado: "Transportadores terceirizados",
  pedagio_estacionamento: "Pedágios e estacionamentos",
  outras: "Outras despesas",
};

export const AREAS_DESPESA = ["logistica", "enfermagem", "geral"] as const;
export type AreaDespesa = (typeof AREAS_DESPESA)[number];
export const ROTULO_AREA_DESPESA: Record<AreaDespesa, string> = {
  logistica: "Logística / home care",
  enfermagem: "Enfermagem",
  geral: "Geral (empresa)",
};

/** Acréscimo padrão sobre o custo do terceirizado: 25% administrativo + 5% por adiantar o pagamento. */
export const ACRESCIMO_TERCEIRIZADO_PADRAO = 30;
export const CHAVE_ACRESCIMO_TERCEIRIZADO = "acrescimo_terceirizado_pct";
