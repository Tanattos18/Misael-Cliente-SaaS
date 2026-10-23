import { and, asc, between, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { auditar } from "./auditoria";
import type { Area } from "./dominio";
import { centavos, hojeISO, periodoDaCompetencia } from "./formato";
import { montarRelatorio, type ItemRelatorio, type Relatorio } from "./relatorio/modelo";

const L = schema.lancamentos;

/** Lançamentos realizados, ainda não fechados, da empresa/área no mês. */
async function lancamentosPendentes(db: DB, empresaId: number, area: Area, competencia: string) {
  const { inicio, fim } = periodoDaCompetencia(competencia);
  return db
    .select({
      id: L.id,
      pacienteNome: schema.pacientes.nome,
      tipo: L.tipo,
      modal: L.modal,
      data: L.data,
      hora: L.hora,
      origem: L.origem,
      destino: L.destino,
      quantidade: L.quantidade,
      valorUnitario: L.valorUnitario,
      valorTotal: L.valorTotal,
      observacoes: L.observacoes,
    })
    .from(L)
    .innerJoin(schema.pacientes, eq(schema.pacientes.id, L.pacienteId))
    .where(
      and(
        eq(L.empresaId, empresaId),
        eq(L.area, area),
        eq(L.status, "realizado"),
        isNull(L.fechamentoId),
        between(L.data, inicio, fim),
      ),
    )
    .orderBy(asc(schema.pacientes.nome), asc(L.data));
}

async function fechamentoAtivo(db: Pick<DB, "select">, empresaId: number, area: Area, competencia: string) {
  const [f] = await db
    .select({ id: schema.fechamentos.id })
    .from(schema.fechamentos)
    .where(
      and(
        eq(schema.fechamentos.empresaId, empresaId),
        eq(schema.fechamentos.area, area),
        eq(schema.fechamentos.competencia, competencia),
        ne(schema.fechamentos.status, "reaberto"),
      ),
    );
  return f ?? null;
}

export async function previaFechamento(
  db: DB,
  empresaId: number,
  area: Area,
  competencia: string,
): Promise<{ relatorio: Relatorio; existenteId: number | null }> {
  const [empresa] = await db.select().from(schema.empresas).where(eq(schema.empresas.id, empresaId));
  if (!empresa) throw new Error("Empresa não encontrada.");
  const { inicio, fim } = periodoDaCompetencia(competencia);
  const itens = await lancamentosPendentes(db, empresaId, area, competencia);
  const existente = await fechamentoAtivo(db, empresaId, area, competencia);
  const relatorio = montarRelatorio(
    { empresa: empresa.nome, cnpj: empresa.cnpj, area, competencia, periodoInicio: inicio, periodoFim: fim, numero: 0, emitidoEm: hojeISO() },
    itens,
  );
  return { relatorio, existenteId: existente?.id ?? null };
}

/**
 * Fecha o mês de uma empresa/área: grava a cópia dos itens e vincula os lançamentos.
 * Só pode haver um fechamento ativo por empresa/área/competência.
 */
export async function gerarFechamento(
  db: DB,
  usuarioId: number,
  empresaId: number,
  area: Area,
  competencia: string,
): Promise<number> {
  const { inicio, fim } = periodoDaCompetencia(competencia);
  return db.transaction(async (tx) => {
    // Serializa fechamentos concorrentes da mesma empresa.
    await tx.execute(sql`select id from empresas where id = ${empresaId} for update`);
    if (await fechamentoAtivo(tx, empresaId, area, competencia)) {
      throw new Error("Já existe um fechamento para esta empresa, área e mês. Reabra-o para gerar novamente.");
    }
    const itens = await lancamentosPendentes(tx as unknown as DB, empresaId, area, competencia);
    if (itens.length === 0) throw new Error("Não há lançamentos em aberto para fechar neste período.");

    const total = centavos(itens.reduce((s, i) => s + i.valorTotal, 0));
    const [f] = await tx
      .insert(schema.fechamentos)
      .values({
        empresaId,
        area,
        competencia,
        periodoInicio: inicio,
        periodoFim: fim,
        quantidadeItens: itens.reduce((s, i) => s + i.quantidade, 0),
        total,
        criadoPor: usuarioId,
      })
      .returning();

    await tx.insert(schema.fechamentoItens).values(
      itens.map(({ id, ...i }) => ({ ...i, fechamentoId: f.id, lancamentoId: id })),
    );
    await tx
      .update(L)
      .set({ fechamentoId: f.id })
      .where(inArray(L.id, itens.map((i) => i.id)));
    await auditar(tx, usuarioId, "gerar", "fechamento", f.id, { empresaId, area, competencia, total, itens: itens.length });
    return f.id;
  });
}

/** Empresas/áreas com lançamentos em aberto no mês e ainda sem fechamento ativo. */
export async function pendenciasDoMes(db: DB, competencia: string) {
  const { inicio, fim } = periodoDaCompetencia(competencia);
  const linhas = await db
    .select({
      empresaId: L.empresaId,
      empresa: schema.empresas.nome,
      area: L.area,
      quantidade: sql<number>`sum(${L.quantidade})::int`,
      total: sql<number>`sum(${L.valorTotal})::float`,
    })
    .from(L)
    .innerJoin(schema.empresas, eq(schema.empresas.id, L.empresaId))
    .where(and(eq(L.status, "realizado"), isNull(L.fechamentoId), between(L.data, inicio, fim)))
    .groupBy(L.empresaId, schema.empresas.nome, L.area)
    .orderBy(asc(schema.empresas.nome), asc(L.area));

  const resultado = [];
  for (const l of linhas) {
    const existente = await fechamentoAtivo(db, l.empresaId, l.area, competencia);
    resultado.push({ ...l, total: centavos(l.total), existenteId: existente?.id ?? null });
  }
  return resultado;
}

export async function reabrirFechamento(db: DB, usuarioId: number, fechamentoId: number, motivo: string) {
  await db.transaction(async (tx) => {
    const [f] = await tx.select().from(schema.fechamentos).where(eq(schema.fechamentos.id, fechamentoId));
    if (!f) throw new Error("Fechamento não encontrado.");
    if (f.status === "pago") throw new Error("Fechamento já pago não pode ser reaberto.");
    if (f.status === "reaberto") throw new Error("Fechamento já está reaberto.");
    await tx.update(schema.fechamentos).set({ status: "reaberto" }).where(eq(schema.fechamentos.id, f.id));
    await tx.update(L).set({ fechamentoId: null }).where(eq(L.fechamentoId, f.id));
    await auditar(tx, usuarioId, "reabrir", "fechamento", f.id, { motivo, statusAnterior: f.status });
  });
}

/** Monta o relatório a partir da cópia congelada (itens do fechamento). */
export async function relatorioDoFechamento(db: DB, fechamentoId: number): Promise<Relatorio | null> {
  const [f] = await db
    .select({ f: schema.fechamentos, empresa: schema.empresas.nome, cnpj: schema.empresas.cnpj })
    .from(schema.fechamentos)
    .innerJoin(schema.empresas, eq(schema.empresas.id, schema.fechamentos.empresaId))
    .where(eq(schema.fechamentos.id, fechamentoId));
  if (!f) return null;
  const itens: ItemRelatorio[] = await db
    .select()
    .from(schema.fechamentoItens)
    .where(eq(schema.fechamentoItens.fechamentoId, fechamentoId));
  return montarRelatorio(
    {
      empresa: f.empresa,
      cnpj: f.cnpj,
      area: f.f.area,
      competencia: f.f.competencia,
      periodoInicio: f.f.periodoInicio,
      periodoFim: f.f.periodoFim,
      numero: f.f.id,
      emitidoEm: f.f.criadoEm.toISOString().slice(0, 10),
    },
    itens,
  );
}

/** "Em atraso": enviado/aprovado/NF emitida e vencimento já passou. */
export function emAtraso(f: { status: string; dataVencimento: string | null }, hoje = hojeISO()): boolean {
  return ["enviado", "aprovado", "nf_emitida"].includes(f.status) && !!f.dataVencimento && f.dataVencimento < hoje;
}
