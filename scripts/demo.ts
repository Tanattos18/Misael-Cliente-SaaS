import { eq, like } from "drizzle-orm";
import { getDb, schema, type DB } from "../src/db";
import type { Modal, Tipo } from "../src/lib/dominio";
import { gerarFechamento } from "../src/lib/fechamento";
import { centavos, hojeISO, somarDias } from "../src/lib/formato";
import { tarifaPara } from "../src/lib/lancamentos";
import { valorTerceirizado } from "../src/lib/tarifas";

/**
 * Dados FICTÍCIOS para demonstração ao cliente.
 * Cria 3 empresas, 9 pacientes, lançamentos de setembro (já fechados, em vários
 * status de recebimento) e de outubro até hoje (em aberto, prontos para fechar).
 * Rode depois de db:migrate e db:seed. Não roda duas vezes.
 */
async function main() {
  const db = await getDb();

  const existe = await db.select().from(schema.empresas).where(like(schema.empresas.nome, "%(demo)%")).limit(1);
  if (existe.length) {
    console.log("Dados de demonstração já existem. Nada a fazer.");
    process.exit(0);
  }
  const [admin] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.perfil, "admin")).limit(1);
  if (!admin) throw new Error("Rode `npm run db:seed` antes.");

  // --- Regiões e tarifas de carro (valores de exemplo, a confirmar com o cliente) ---
  const regioes = Object.fromEntries(
    (await db.select().from(schema.regioes)).map((r) => [r.nome, r.id]),
  ) as Record<string, number>;
  const carro: [string, number][] = [
    ["Goiânia", 40],
    ["Aparecida de Goiânia", 45],
    ["Goianira", 60],
    ["Bela Vista de Goiás", 90],
  ];
  for (const [nome, valor] of carro) {
    if (regioes[nome]) await db.insert(schema.tarifas).values({ tipo: "corrida", modal: "carro", regiaoId: regioes[nome], valor });
  }

  // --- Empresas ---
  const empresa = async (nome: string, cnpj: string, prazo: number) =>
    (await db.insert(schema.empresas).values({ nome, cnpj, prazoPagamentoDias: prazo, contato: "Financeiro" }).returning())[0].id;
  const A = await empresa("Home Care Vida Plena (demo)", "11.111.111/0001-11", 30);
  const B = await empresa("Saúde em Casa Bem-Estar (demo)", "22.222.222/0001-22", 15);
  const C = await empresa("Clínica Cuidar Mais (demo)", "33.333.333/0001-33", 20);

  // --- Pacientes (nomes fictícios) ---
  const paciente = async (nome: string, empresaId: number, regiao: string) =>
    (await db.insert(schema.pacientes).values({ nome, empresaId, regiaoId: regioes[regiao] ?? null }).returning())[0].id;
  const p = {
    maria: await paciente("Maria Aparecida Souza", A, "Goiânia"),
    joao: await paciente("João Pedro Lima", A, "Aparecida de Goiânia"),
    ana: await paciente("Ana Clara Mendes", A, "Goiânia"),
    antonio: await paciente("Antônio Carlos Ribeiro", B, "Goianira"),
    francisca: await paciente("Francisca de Oliveira", B, "Goiânia"),
    benedito: await paciente("Benedito Alves", B, "Aparecida de Goiânia"),
    raimunda: await paciente("Raimunda Costa", C, "Bela Vista de Goiás"),
    luiz: await paciente("Luiz Fernando Rocha", C, "Goiânia"),
    helena: await paciente("Helena Martins", C, "Goiânia"),
  };

  // Tarifa diferenciada: exemplo de paciente com coleta mais cara.
  await db.insert(schema.tarifas).values({ tipo: "coleta", pacienteId: p.benedito, valor: 60 });

  // --- Lançamentos ---
  const hoje = hojeISO();
  let total = 0;
  async function lancar(
    pacienteId: number,
    tipo: Tipo,
    data: string,
    opts: { quantidade?: number; modal?: Modal; origem?: string; destino?: string; custo?: number; obs?: string } = {},
  ) {
    if (data > hoje) return;
    const [pac] = await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, pacienteId));
    const quantidade = opts.quantidade ?? 1;
    let valorUnitario: number;
    let custoTerceiro: number | null = null;
    let percentualAcrescimo: number | null = null;
    if (opts.modal === "terceirizado") {
      custoTerceiro = opts.custo ?? 100;
      percentualAcrescimo = 30;
      valorUnitario = valorTerceirizado(custoTerceiro, percentualAcrescimo);
    } else {
      const t = await tarifaPara(db, pacienteId, tipo, opts.modal ?? null);
      if (!t) throw new Error(`Sem tarifa: paciente ${pacienteId} ${tipo} ${opts.modal}`);
      valorUnitario = t.valor;
    }
    await db.insert(schema.lancamentos).values({
      area: tipo === "corrida" ? "logistica" : "enfermagem",
      tipo,
      pacienteId,
      empresaId: pac.empresaId,
      data,
      quantidade,
      valorUnitario,
      valorTotal: centavos(valorUnitario * quantidade),
      modal: opts.modal ?? null,
      origem: opts.origem ?? null,
      destino: opts.destino ?? null,
      custoTerceiro,
      percentualAcrescimo,
      observacoes: opts.obs ?? null,
      criadoPor: admin.id,
    });
    total++;
  }
  const dias = (inicio: string, fim: string, passo = 1) => {
    const lista: string[] = [];
    for (let d = inicio; d <= fim; d = somarDias(d, passo)) lista.push(d);
    return lista;
  };

  // Medicações: atendimentos/dia = soma das doses (ex.: 12/12h + 8/8h = 5).
  for (const d of dias("2026-09-01", "2026-09-10")) await lancar(p.maria, "medicacao", d, { quantidade: 5, obs: "Antibiótico 8/8h + analgésico 12/12h" });
  for (const d of dias("2026-10-14", "2026-10-21")) await lancar(p.maria, "medicacao", d, { quantidade: 2, obs: "12/12h" });
  for (const d of dias("2026-09-15", "2026-10-12")) await lancar(p.antonio, "medicacao", d, { quantidade: 3, obs: "8/8h" });
  for (const d of dias("2026-09-05", "2026-09-25")) await lancar(p.raimunda, "medicacao", d, { quantidade: 2, obs: "12/12h" });
  for (const d of dias("2026-10-05", "2026-10-19")) await lancar(p.helena, "medicacao", d, { quantidade: 1, obs: "1x ao dia" });

  // Curativos: 1x por dia, 7 dias por semana.
  for (const d of dias("2026-09-01", hoje)) await lancar(p.joao, "curativo", d);
  for (const d of dias("2026-09-10", "2026-10-09")) await lancar(p.francisca, "curativo", d);

  // Coletas: vários pacientes no mesmo dia.
  for (const [pac, d] of [
    [p.ana, "2026-09-20"], [p.benedito, "2026-09-20"], [p.luiz, "2026-09-20"],
    [p.benedito, "2026-09-25"], [p.luiz, "2026-09-25"],
    [p.ana, "2026-10-08"], [p.luiz, "2026-10-15"], [p.helena, "2026-10-15"], [p.francisca, "2026-10-20"],
  ] as const) {
    await lancar(pac, "coleta", d);
  }

  // Corridas.
  for (const d of dias("2026-09-02", hoje, 7)) {
    await lancar(p.maria, "corrida", d, { modal: "moto", origem: "Base CuraLog", destino: "Residência — Setor Bueno" });
    await lancar(p.joao, "corrida", d, { modal: "moto", origem: "Base CuraLog", destino: "Residência — Aparecida" });
    await lancar(p.luiz, "corrida", d, { modal: "carro", origem: "Residência", destino: "Hospital — Setor Oeste" });
  }
  for (const d of dias("2026-09-04", hoje, 10)) {
    await lancar(p.antonio, "corrida", d, { modal: "moto", origem: "Base CuraLog", destino: "Goianira" });
    await lancar(p.francisca, "corrida", d, { modal: "carro", origem: "Residência", destino: "Clínica de imagem" });
  }
  for (const [d, custo] of [["2026-09-08", 100], ["2026-09-22", 120], ["2026-10-06", 100], ["2026-10-20", 150]] as const) {
    await lancar(p.raimunda, "corrida", d, { modal: "terceirizado", custo, origem: "Bela Vista de Goiás", destino: "Hospital — Goiânia", obs: "Transportadora parceira (pago adiantado)" });
  }
  await lancar(p.raimunda, "corrida", "2026-09-15", { modal: "carro", origem: "Bela Vista de Goiás", destino: "Laboratório — Goiânia" });

  // Um lançamento cancelado, para mostrar o histórico.
  const [cancelar] = await db
    .insert(schema.lancamentos)
    .values({ area: "enfermagem", tipo: "coleta", pacienteId: p.helena, empresaId: C, data: "2026-10-16", valorUnitario: 55, valorTotal: 55, status: "cancelado", motivoCancelamento: "Paciente remarcou a coleta", criadoPor: admin.id })
    .returning();

  // --- Setembro: fechamentos em vários status de recebimento ---
  const f = async (empresaId: number, area: "enfermagem" | "logistica") => gerarFechamento(db, admin.id, empresaId, area, "2026-09");
  const status = (id: number, v: Partial<typeof schema.fechamentos.$inferInsert>) =>
    db.update(schema.fechamentos).set(v).where(eq(schema.fechamentos.id, id));

  const aEnf = await f(A, "enfermagem");
  await status(aEnf, { status: "pago", dataEnvio: "2026-10-01", dataVencimento: "2026-10-31", dataAprovacao: "2026-10-03", numeroNf: "1021", dataNf: "2026-10-04", dataPagamento: "2026-10-15" });
  await pagarTotal(db, aEnf);
  const aLog = await f(A, "logistica");
  await status(aLog, { status: "nf_emitida", dataEnvio: "2026-10-01", dataVencimento: "2026-10-31", dataAprovacao: "2026-10-05", numeroNf: "1022", dataNf: "2026-10-06" });
  const bEnf = await f(B, "enfermagem");
  await status(bEnf, { status: "enviado", dataEnvio: "2026-10-01", dataVencimento: "2026-10-16" }); // vencido → em atraso
  const bLog = await f(B, "logistica");
  await status(bLog, { status: "aprovado", dataEnvio: "2026-10-01", dataVencimento: "2026-10-30", dataAprovacao: "2026-10-08" });
  await f(C, "enfermagem"); // calculado, aguardando envio
  // Logística da empresa C em setembro fica em aberto, para mostrar "Gerar todos".

  console.log(`Demonstração criada: 3 empresas, 9 pacientes, ${total + (cancelar ? 1 : 0)} lançamentos, 5 fechamentos de setembro.`);
  process.exit(0);
}

async function pagarTotal(db: DB, id: number) {
  const [f] = await db.select().from(schema.fechamentos).where(eq(schema.fechamentos.id, id));
  await db.update(schema.fechamentos).set({ valorPago: f.total }).where(eq(schema.fechamentos.id, id));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
