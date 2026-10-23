import { and, between, eq, sql } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { CATEGORIAS_DESPESA, type AreaDespesa, type CategoriaDespesa, type Modal, type Tipo } from "./dominio";
import { centavos, periodoDaCompetencia, somarDias } from "./formato";

export type LinhaReceita = { tipo: Tipo; modal: Modal | null; quantidade: number; total: number; custoTerceiro: number };
export type LinhaDespesa = { categoria: CategoriaDespesa; area: AreaDespesa; modal: Modal | null; valor: number; litros: number | null };

type Bloco = { receita: number; despesa: number; resultado: number };
const bloco = (receita: number, despesa: number): Bloco => ({
  receita: centavos(receita),
  despesa: centavos(despesa),
  resultado: centavos(receita - despesa),
});

export type Resultado = {
  receitaPorTipo: Record<Tipo, { quantidade: number; total: number }>;
  despesasPorCategoria: Record<CategoriaDespesa, number>;
  enfermagem: Bloco;
  logistica: Bloco;
  modais: Record<Modal, Bloco & { corridas: number }>;
  geral: number;
  combustivelLitros: number;
  total: Bloco & { margem: number | null };
};

/**
 * Apura o resultado do período.
 * - Receita: lançamentos realizados (pela data do serviço).
 * - Despesa: despesas ativas + custo pago às transportadoras nas corridas terceirizadas
 *   (entra automaticamente como "Transportadores terceirizados", modal terceirizado).
 * - Despesas de veículo/modal vão para a logística e para o modal; "geral" só entra no total.
 */
export function apurarResultado(receitas: LinhaReceita[], despesas: LinhaDespesa[]): Resultado {
  const receitaPorTipo = {
    medicacao: { quantidade: 0, total: 0 },
    curativo: { quantidade: 0, total: 0 },
    coleta: { quantidade: 0, total: 0 },
    corrida: { quantidade: 0, total: 0 },
  } satisfies Resultado["receitaPorTipo"];
  const recModal: Record<Modal, number> = { moto: 0, carro: 0, terceirizado: 0 };
  const corridas: Record<Modal, number> = { moto: 0, carro: 0, terceirizado: 0 };
  const despModal: Record<Modal, number> = { moto: 0, carro: 0, terceirizado: 0 };
  const despesasPorCategoria = Object.fromEntries(CATEGORIAS_DESPESA.map((c) => [c, 0])) as Record<CategoriaDespesa, number>;
  let despEnf = 0;
  let despLog = 0;
  let geral = 0;
  let litros = 0;

  for (const r of receitas) {
    receitaPorTipo[r.tipo].quantidade += r.quantidade;
    receitaPorTipo[r.tipo].total += r.total;
    if (r.tipo === "corrida" && r.modal) {
      recModal[r.modal] += r.total;
      corridas[r.modal] += r.quantidade;
      if (r.custoTerceiro) {
        despesasPorCategoria.terceirizado += r.custoTerceiro;
        despModal.terceirizado += r.custoTerceiro;
        despLog += r.custoTerceiro;
      }
    }
  }

  for (const d of despesas) {
    despesasPorCategoria[d.categoria] += d.valor;
    if (d.categoria === "combustivel" && d.litros) litros += d.litros;
    if (d.area === "enfermagem") despEnf += d.valor;
    else if (d.area === "logistica") {
      despLog += d.valor;
      if (d.modal) despModal[d.modal] += d.valor;
    } else geral += d.valor;
  }

  for (const t of Object.values(receitaPorTipo)) t.total = centavos(t.total);
  for (const c of CATEGORIAS_DESPESA) despesasPorCategoria[c] = centavos(despesasPorCategoria[c]);

  const recEnf = receitaPorTipo.medicacao.total + receitaPorTipo.curativo.total + receitaPorTipo.coleta.total;
  const recLog = receitaPorTipo.corrida.total;
  const totalRec = recEnf + recLog;
  const totalDesp = despEnf + despLog + geral;
  const modal = (m: Modal) => ({ ...bloco(recModal[m], despModal[m]), corridas: corridas[m] });

  return {
    receitaPorTipo,
    despesasPorCategoria,
    enfermagem: bloco(recEnf, despEnf),
    logistica: bloco(recLog, despLog),
    modais: { moto: modal("moto"), carro: modal("carro"), terceirizado: modal("terceirizado") },
    geral: centavos(geral),
    combustivelLitros: centavos(litros),
    total: { ...bloco(totalRec, totalDesp), margem: totalRec > 0 ? (totalRec - totalDesp) / totalRec : null },
  };
}

export async function resultadoDoPeriodo(db: DB, inicio: string, fim: string): Promise<Resultado> {
  const L = schema.lancamentos;
  const D = schema.despesas;
  const [receitas, despesas] = await Promise.all([
    db
      .select({
        tipo: L.tipo,
        modal: L.modal,
        quantidade: sql<number>`sum(${L.quantidade})::int`,
        total: sql<number>`sum(${L.valorTotal})::float`,
        custoTerceiro: sql<number>`coalesce(sum(${L.custoTerceiro} * ${L.quantidade}), 0)::float`,
      })
      .from(L)
      .where(and(eq(L.status, "realizado"), between(L.data, inicio, fim)))
      .groupBy(L.tipo, L.modal),
    db
      .select({ categoria: D.categoria, area: D.area, modal: D.modal, valor: D.valor, litros: D.litros })
      .from(D)
      .where(and(eq(D.status, "ativa"), between(D.data, inicio, fim))),
  ]);
  return apurarResultado(receitas, despesas);
}

export async function resultadoDoMes(db: DB, competencia: string) {
  const { inicio, fim } = periodoDaCompetencia(competencia);
  return resultadoDoPeriodo(db, inicio, fim);
}

/** "2026-10", 3 → ["2026-08", "2026-09", "2026-10"] */
export function ultimosMeses(competencia: string, n: number): string[] {
  const lista = [competencia];
  let atual = competencia;
  for (let i = 1; i < n; i++) {
    atual = somarDias(`${atual}-01`, -1).slice(0, 7);
    lista.unshift(atual);
  }
  return lista;
}
