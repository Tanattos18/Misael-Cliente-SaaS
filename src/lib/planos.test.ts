import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { schema, type DB } from "@/db";
import { gerarFechamento } from "./fechamento";
import { carregarPlano, conferenciaDoMes, pendenciasPorPlano, registrarRealizados, tratamentoNaData, type PlanoCompleto } from "./planos";
import { bancoDeTeste } from "./test-db";

let db: DB;
let usuario: number;
let empresaId: number;
let plano: PlanoCompleto;

beforeAll(async () => {
  db = await bancoDeTeste("curalog_teste_planos");
  [{ id: usuario }] = await db.insert(schema.usuarios).values({ nome: "T", email: "t@t", senhaHash: "x" }).returning();
  [{ id: empresaId }] = await db.insert(schema.empresas).values({ nome: "Empresa" }).returning();
  const [{ id: pacienteId }] = await db.insert(schema.pacientes).values({ nome: "Maria", empresaId }).returning();
  await db.insert(schema.tarifas).values({ tipo: "medicacao", valor: 55 });

  // 12/12h + 8/8h = 5 por dia, de 01/09 06h até 04/09 06h (3 dias completos = 15).
  const [{ id }] = await db
    .insert(schema.planos)
    .values({ pacienteId, tipo: "medicacao", inicioData: "2026-09-01", inicioHora: "06:00", fimData: "2026-09-04", fimHora: "06:00" })
    .returning();
  await db.insert(schema.planoItens).values([
    { planoId: id, descricao: "Antibiótico", horarios: "06:00,14:00,22:00" },
    { planoId: id, descricao: "Analgésico", horarios: "06:00,18:00" },
  ]);
  plano = (await carregarPlano(db, id))!;
}, 60_000);

const lancamentoDoDia = async (data: string) =>
  (await db.select().from(schema.lancamentos).where(and(eq(schema.lancamentos.planoId, plano.id), eq(schema.lancamentos.data, data))))[0];

describe("conferência de tratamento", () => {
  it("calcula previstos por dia sem a dose do horário final", async () => {
    const dias = await conferenciaDoMes(db, plano, "2026-09");
    expect(dias.map((d) => [d.data, d.previstas.length, d.realizadas])).toEqual([
      ["2026-09-01", 5, null],
      ["2026-09-02", 5, null],
      ["2026-09-03", 5, null],
    ]);
    const pend = (await pendenciasPorPlano(db, [plano], "2026-09-01", "2026-09-30")).get(plano.id)!;
    expect(pend).toEqual({ dias: ["2026-09-01", "2026-09-02", "2026-09-03"], doses: 15 });
  });

  it("grava realizados (completo, parcial e zero) usando a tarifa", async () => {
    const r = await registrarRealizados(db, usuario, plano, { "2026-09-01": 5, "2026-09-02": 4, "2026-09-03": 0 });
    expect(r.gravados).toBe(3);
    expect((await lancamentoDoDia("2026-09-01")).valorTotal).toBe(275);
    expect((await lancamentoDoDia("2026-09-02")).valorTotal).toBe(220);
    expect((await lancamentoDoDia("2026-09-03")).status).toBe("cancelado");

    const pend = (await pendenciasPorPlano(db, [plano], "2026-09-01", "2026-09-30")).get(plano.id)!;
    expect(pend.dias).toEqual([]);
  });

  it("corrige um dia e reativa um dia zerado", async () => {
    await registrarRealizados(db, usuario, plano, { "2026-09-02": 5, "2026-09-03": 2 });
    expect((await lancamentoDoDia("2026-09-02")).valorTotal).toBe(275);
    const d3 = await lancamentoDoDia("2026-09-03");
    expect([d3.status, d3.quantidade, d3.valorTotal]).toEqual(["realizado", 2, 110]);
  });

  it("entra no fechamento e depois não pode ser alterado", async () => {
    const fid = await gerarFechamento(db, usuario, empresaId, "enfermagem", "2026-09");
    const [f] = await db.select().from(schema.fechamentos).where(eq(schema.fechamentos.id, fid));
    expect(f.total).toBe(660); // 5 + 5 + 2 = 12 × 55
    const r = await registrarRealizados(db, usuario, plano, { "2026-09-01": 1 });
    expect(r.ignorados).toEqual(["2026-09-01 (já em fechamento)"]);
    expect((await lancamentoDoDia("2026-09-01")).quantidade).toBe(5);
  });
});

describe("lançamento avulso × tratamento", () => {
  it("encontra o tratamento que cobre a data (inclusive o dia do término)", async () => {
    expect(await tratamentoNaData(db, plano.pacienteId, "medicacao", "2026-09-02")).toEqual({ id: plano.id });
    expect(await tratamentoNaData(db, plano.pacienteId, "medicacao", "2026-09-04")).toEqual({ id: plano.id });
    expect(await tratamentoNaData(db, plano.pacienteId, "medicacao", "2026-09-05")).toBeNull();
    expect(await tratamentoNaData(db, plano.pacienteId, "curativo", "2026-09-02")).toBeNull();
  });

  it("conferência mostra lançamentos avulsos do mesmo dia", async () => {
    await db.insert(schema.lancamentos).values({
      area: "enfermagem", tipo: "medicacao", pacienteId: plano.pacienteId, empresaId, data: "2026-09-02",
      quantidade: 2, valorUnitario: 55, valorTotal: 110,
    });
    const dias = await conferenciaDoMes(db, plano, "2026-09");
    expect(dias.find((d) => d.data === "2026-09-02")?.avulsos).toBe(2);
    expect(dias.find((d) => d.data === "2026-09-01")?.avulsos).toBe(0);
  });
});
