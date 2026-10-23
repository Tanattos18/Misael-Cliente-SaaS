import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, schema, type DB } from "@/db";
import { gerarFechamento, pendenciasDoMes, previaFechamento, reabrirFechamento, relatorioDoFechamento } from "./fechamento";
import { tarifaPara } from "./lancamentos";

// Banco PGlite em memória, com as migrações reais.
process.env.PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

let db: DB;
let empresaId: number;
let maria: number;
let joao: number;
let usuario: number;

async function lancar(v: Partial<typeof schema.lancamentos.$inferInsert> & { pacienteId: number; data: string }) {
  const valorUnitario = v.valorUnitario ?? 55;
  const quantidade = v.quantidade ?? 1;
  const [l] = await db
    .insert(schema.lancamentos)
    .values({ area: "enfermagem", tipo: "medicacao", empresaId, valorUnitario, quantidade, valorTotal: valorUnitario * quantidade, ...v })
    .returning();
  return l;
}

beforeAll(async () => {
  db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle" });

  [{ id: usuario }] = await db.insert(schema.usuarios).values({ nome: "Teste", email: "t@t", senhaHash: "x" }).returning();
  [{ id: empresaId }] = await db.insert(schema.empresas).values({ nome: "Empresa A" }).returning();
  const [{ id: goiania }] = await db.insert(schema.regioes).values({ nome: "Goiânia" }).returning();
  [{ id: maria }] = await db.insert(schema.pacientes).values({ nome: "Maria", empresaId, regiaoId: goiania }).returning();
  [{ id: joao }] = await db.insert(schema.pacientes).values({ nome: "João", empresaId }).returning();
  await db.insert(schema.tarifas).values([
    { tipo: "medicacao", valor: 55 },
    { tipo: "medicacao", pacienteId: joao, valor: 70 },
    { tipo: "corrida", modal: "moto", regiaoId: goiania, valor: 25 },
  ]);

  await lancar({ pacienteId: maria, data: "2026-10-01", quantidade: 5 });
  await lancar({ pacienteId: maria, data: "2026-10-02", quantidade: 5 });
  await lancar({ pacienteId: joao, data: "2026-10-02", valorUnitario: 70 });
  await lancar({ pacienteId: joao, data: "2026-10-03", status: "cancelado" });
  await lancar({ pacienteId: joao, data: "2026-11-01" }); // outro mês
  await lancar({ pacienteId: maria, data: "2026-10-05", area: "logistica", tipo: "corrida", modal: "moto", valorUnitario: 25 });
}, 60_000);

describe("tarifaPara", () => {
  it("preenche tarifa do paciente e da região", async () => {
    expect(await tarifaPara(db, maria, "medicacao", null)).toEqual({ valor: 55, origem: "tarifa padrão" });
    expect(await tarifaPara(db, joao, "medicacao", null)).toEqual({ valor: 70, origem: "tarifa do paciente" });
    expect((await tarifaPara(db, maria, "corrida", "moto"))?.valor).toBe(25);
    expect(await tarifaPara(db, joao, "corrida", "moto")).toBeNull();
  });
});

describe("fechamento mensal", () => {
  let fechamentoId: number;

  it("prévia considera só realizados do mês e da área", async () => {
    const { relatorio } = await previaFechamento(db, empresaId, "enfermagem", "2026-10");
    expect(relatorio.quantidade).toBe(11);
    expect(relatorio.total).toBe(620);
    const pend = await pendenciasDoMes(db, "2026-10");
    expect(pend.map((p) => [p.area, p.total])).toEqual([["enfermagem", 620], ["logistica", 25]]);
  });

  it("gera o fechamento, congela os itens e bloqueia duplicidade", async () => {
    fechamentoId = await gerarFechamento(db, usuario, empresaId, "enfermagem", "2026-10");
    const [f] = await db.select().from(schema.fechamentos).where(eq(schema.fechamentos.id, fechamentoId));
    expect(f.total).toBe(620);
    expect(f.status).toBe("calculado");

    const vinculados = await db.select().from(schema.lancamentos).where(eq(schema.lancamentos.fechamentoId, fechamentoId));
    expect(vinculados).toHaveLength(3);

    await expect(gerarFechamento(db, usuario, empresaId, "enfermagem", "2026-10")).rejects.toThrow(/Já existe/);
  });

  it("relatório vem da cópia congelada, mesmo se o lançamento mudar", async () => {
    await db.update(schema.lancamentos).set({ valorTotal: 9999 }).where(eq(schema.lancamentos.fechamentoId, fechamentoId));
    const r = await relatorioDoFechamento(db, fechamentoId);
    expect(r?.total).toBe(620);
    expect(r?.porPaciente).toEqual([
      { paciente: "João", quantidade: 1, total: 70 },
      { paciente: "Maria", quantidade: 10, total: 550 },
    ]);
  });

  it("reabrir libera os lançamentos para novo fechamento", async () => {
    await reabrirFechamento(db, usuario, fechamentoId, "teste");
    const livres = await db.select().from(schema.lancamentos).where(eq(schema.lancamentos.fechamentoId, fechamentoId));
    expect(livres).toHaveLength(0);
    const novo = await gerarFechamento(db, usuario, empresaId, "enfermagem", "2026-10");
    expect(novo).not.toBe(fechamentoId);
    await expect(reabrirFechamento(db, usuario, fechamentoId, "de novo")).rejects.toThrow(/reaberto/);
  });

  it("sem lançamentos em aberto, não gera fechamento vazio", async () => {
    await expect(gerarFechamento(db, usuario, empresaId, "enfermagem", "2026-09")).rejects.toThrow(/Não há lançamentos/);
  });
});
