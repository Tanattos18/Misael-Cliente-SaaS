import { and, asc, between, eq, inArray } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { auditar } from "./auditoria";
import { dosesPrevistas, type DiaPrevisto, type PlanoDoses } from "./doses";
import { centavos, hojeISO, periodoDaCompetencia } from "./formato";
import { lancamentoBloqueado, tarifaPara } from "./lancamentos";

export const CHAVE_FIM_INCLUSIVO = "dose_horario_final_conta";

export async function fimInclusivo(db: DB): Promise<boolean> {
  const [c] = await db.select().from(schema.configuracoes).where(eq(schema.configuracoes.chave, CHAVE_FIM_INCLUSIVO));
  return c?.valor === "true";
}

export type PlanoCompleto = typeof schema.planos.$inferSelect &
  PlanoDoses & { paciente: string; empresaId: number; empresa: string };

export async function carregarPlanos(db: DB, ids?: number[]): Promise<PlanoCompleto[]> {
  const linhas = await db
    .select({ p: schema.planos, paciente: schema.pacientes.nome, empresaId: schema.pacientes.empresaId, empresa: schema.empresas.nome })
    .from(schema.planos)
    .innerJoin(schema.pacientes, eq(schema.pacientes.id, schema.planos.pacienteId))
    .innerJoin(schema.empresas, eq(schema.empresas.id, schema.pacientes.empresaId))
    .where(ids ? inArray(schema.planos.id, ids.length ? ids : [-1]) : undefined)
    .orderBy(asc(schema.pacientes.nome));
  const itens = linhas.length
    ? await db.select().from(schema.planoItens).where(inArray(schema.planoItens.planoId, linhas.map((l) => l.p.id))).orderBy(asc(schema.planoItens.id))
    : [];
  return linhas.map(({ p, paciente, empresaId, empresa }) => ({
    ...p,
    paciente,
    empresaId,
    empresa,
    itens: itens.filter((i) => i.planoId === p.id).map((i) => ({ descricao: i.descricao, horarios: i.horarios.split(",") })),
  }));
}

export async function carregarPlano(db: DB, id: number): Promise<PlanoCompleto | null> {
  return (await carregarPlanos(db, [id]))[0] ?? null;
}

export type DiaConferencia = {
  data: string;
  previstas: DiaPrevisto["doses"];
  lancamentoId: number | null;
  realizadas: number | null; // null = ainda não conferido
  cancelado: boolean;
  bloqueado: boolean;
  futuro: boolean;
};

/** Previsto × realizado, dia a dia, no mês. */
export async function conferenciaDoMes(db: DB, plano: PlanoCompleto, competencia: string): Promise<DiaConferencia[]> {
  const { inicio, fim } = periodoDaCompetencia(competencia);
  const previstos = dosesPrevistas(plano, inicio, fim, await fimInclusivo(db));
  const lancs = await db
    .select()
    .from(schema.lancamentos)
    .where(and(eq(schema.lancamentos.planoId, plano.id), between(schema.lancamentos.data, inicio, fim)));
  const hoje = hojeISO();

  const datas = [...new Set([...previstos.map((p) => p.data), ...lancs.map((l) => l.data)])].sort();
  const dias: DiaConferencia[] = [];
  for (const data of datas) {
    const l = lancs.find((x) => x.data === data);
    dias.push({
      data,
      previstas: previstos.find((p) => p.data === data)?.doses ?? [],
      lancamentoId: l?.id ?? null,
      realizadas: l ? (l.status === "cancelado" ? 0 : l.quantidade) : null,
      cancelado: l?.status === "cancelado",
      bloqueado: l ? await lancamentoBloqueado(db, l.fechamentoId) : false,
      futuro: data > hoje,
    });
  }
  return dias;
}

/** Dias com atendimentos previstos (até hoje) que ainda não foram conferidos, por plano. */
export async function pendenciasPorPlano(db: DB, planos: PlanoCompleto[], de: string, ate = hojeISO()) {
  const inclusivo = await fimInclusivo(db);
  const ids = planos.map((p) => p.id);
  const conferidos = ids.length
    ? await db
        .select({ planoId: schema.lancamentos.planoId, data: schema.lancamentos.data })
        .from(schema.lancamentos)
        .where(and(inArray(schema.lancamentos.planoId, ids), between(schema.lancamentos.data, de, ate)))
    : [];
  const resultado = new Map<number, { dias: string[]; doses: number }>();
  for (const p of planos) {
    const feitos = new Set(conferidos.filter((c) => c.planoId === p.id).map((c) => c.data));
    const pend = dosesPrevistas(p, de, ate, inclusivo).filter((d) => !feitos.has(d.data));
    resultado.set(p.id, { dias: pend.map((d) => d.data), doses: pend.reduce((s, d) => s + d.doses.length, 0) });
  }
  return resultado;
}

/**
 * Grava quantos atendimentos foram realizados em cada dia.
 * 0 registra o dia como conferido sem atendimento (lançamento cancelado, não cobrado).
 * Dias já em fechamento não são alterados.
 */
export async function registrarRealizados(
  db: DB,
  usuarioId: number,
  plano: PlanoCompleto,
  quantidades: Record<string, number>,
): Promise<{ gravados: number; ignorados: string[] }> {
  const hoje = hojeISO();
  const ignorados: string[] = [];
  let gravados = 0;

  let valorUnitario = plano.valorUnitario;
  if (valorUnitario == null) {
    const t = await tarifaPara(db, plano.pacienteId, plano.tipo, null);
    if (!t) throw new Error("Não há tarifa para este paciente/serviço. Cadastre uma tarifa ou informe o valor no tratamento.");
    valorUnitario = t.valor;
  }

  await db.transaction(async (tx) => {
    for (const [data, qtd] of Object.entries(quantidades)) {
      if (data > hoje) {
        ignorados.push(`${data} (data futura)`);
        continue;
      }
      const [existente] = await tx
        .select()
        .from(schema.lancamentos)
        .where(and(eq(schema.lancamentos.planoId, plano.id), eq(schema.lancamentos.data, data)));

      if (existente) {
        const atual = existente.status === "cancelado" ? 0 : existente.quantidade;
        if (atual === qtd) continue;
        if (await lancamentoBloqueado(tx as unknown as DB, existente.fechamentoId)) {
          ignorados.push(`${data} (já em fechamento)`);
          continue;
        }
        const mudanca =
          qtd === 0
            ? { status: "cancelado" as const, motivoCancelamento: "Nenhum atendimento realizado (conferência)" }
            : {
                status: "realizado" as const,
                motivoCancelamento: null,
                quantidade: qtd,
                valorTotal: centavos(existente.valorUnitario * qtd),
              };
        await tx.update(schema.lancamentos).set({ ...mudanca, atualizadoEm: new Date() }).where(eq(schema.lancamentos.id, existente.id));
        await auditar(tx, usuarioId, "conferir", "lancamento", existente.id, { data, antes: atual, depois: qtd });
      } else {
        const [novo] = await tx
          .insert(schema.lancamentos)
          .values({
            area: "enfermagem",
            tipo: plano.tipo,
            pacienteId: plano.pacienteId,
            empresaId: plano.empresaId,
            planoId: plano.id,
            data,
            quantidade: Math.max(qtd, 1),
            valorUnitario,
            valorTotal: centavos(valorUnitario * qtd),
            status: qtd === 0 ? "cancelado" : "realizado",
            motivoCancelamento: qtd === 0 ? "Nenhum atendimento realizado (conferência)" : null,
            criadoPor: usuarioId,
          })
          .returning();
        await auditar(tx, usuarioId, "conferir", "lancamento", novo.id, { data, depois: qtd });
      }
      gravados++;
    }
  });
  return { gravados, ignorados };
}
