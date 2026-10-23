import { centavos } from "../formato";
import { ROTULO_MODAL, ROTULO_TIPO_PLURAL, type Area, type Modal, type Tipo } from "../dominio";

export type ItemRelatorio = {
  pacienteNome: string;
  tipo: string;
  modal: string | null;
  data: string;
  hora: string | null;
  origem: string | null;
  destino: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  observacoes: string | null;
};

export type CabecalhoRelatorio = {
  empresa: string;
  cnpj: string | null;
  area: Area;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  numero: number;
  emitidoEm: string;
};

export type GrupoPaciente = {
  paciente: string;
  itens: ItemRelatorio[];
  quantidade: number;
  total: number;
};

export type Secao = {
  chave: string;
  titulo: string;
  pacientes: GrupoPaciente[];
  quantidade: number;
  total: number;
};

export type Relatorio = {
  cabecalho: CabecalhoRelatorio;
  secoes: Secao[];
  /** Totais por paciente somando todas as seções. */
  porPaciente: { paciente: string; quantidade: number; total: number }[];
  quantidade: number;
  total: number;
};

const ORDEM_ENFERMAGEM: Tipo[] = ["medicacao", "curativo", "coleta"];
const ORDEM_LOGISTICA: Modal[] = ["moto", "carro", "terceirizado"];

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

function agruparPorPaciente(itens: ItemRelatorio[]): GrupoPaciente[] {
  const mapa = new Map<string, ItemRelatorio[]>();
  for (const item of itens) {
    const lista = mapa.get(item.pacienteNome) ?? [];
    lista.push(item);
    mapa.set(item.pacienteNome, lista);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => porNome(a, b))
    .map(([paciente, lista]) => {
      lista.sort((a, b) => (a.data + (a.hora ?? "")).localeCompare(b.data + (b.hora ?? "")));
      return {
        paciente,
        itens: lista,
        quantidade: lista.reduce((s, i) => s + i.quantidade, 0),
        total: centavos(lista.reduce((s, i) => s + i.valorTotal, 0)),
      };
    });
}

/**
 * Organiza os itens de um fechamento para o relatório:
 * enfermagem é separada por serviço; logística, por modal.
 */
export function montarRelatorio(cabecalho: CabecalhoRelatorio, itens: ItemRelatorio[]): Relatorio {
  const chaves: string[] = cabecalho.area === "enfermagem" ? ORDEM_ENFERMAGEM : ORDEM_LOGISTICA;
  const chaveDoItem = (i: ItemRelatorio) => (cabecalho.area === "enfermagem" ? i.tipo : (i.modal ?? "moto"));
  const titulo = (chave: string) =>
    cabecalho.area === "enfermagem"
      ? ROTULO_TIPO_PLURAL[chave as Tipo]
      : `Corridas — ${ROTULO_MODAL[chave as Modal]}`;

  const secoes: Secao[] = [];
  for (const chave of chaves) {
    const daSecao = itens.filter((i) => chaveDoItem(i) === chave);
    if (daSecao.length === 0) continue;
    const pacientes = agruparPorPaciente(daSecao);
    secoes.push({
      chave,
      titulo: titulo(chave),
      pacientes,
      quantidade: pacientes.reduce((s, p) => s + p.quantidade, 0),
      total: centavos(pacientes.reduce((s, p) => s + p.total, 0)),
    });
  }

  const porPaciente = agruparPorPaciente(itens).map(({ paciente, quantidade, total }) => ({
    paciente,
    quantidade,
    total,
  }));

  return {
    cabecalho,
    secoes,
    porPaciente,
    quantidade: secoes.reduce((s, x) => s + x.quantidade, 0),
    total: centavos(secoes.reduce((s, x) => s + x.total, 0)),
  };
}

export function nomeArquivoRelatorio(c: CabecalhoRelatorio, extensao: string): string {
  const empresa = c.empresa
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `CuraLog_${c.competencia}_${empresa}_${c.area === "enfermagem" ? "Enfermagem" : "Logistica"}.${extensao}`;
}
