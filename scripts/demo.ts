import { eq, like } from "drizzle-orm";
import { fecharDb, getDb, schema, type DB } from "../src/db";
import type { Modal, Tipo } from "../src/lib/dominio";
import { gerarFechamento } from "../src/lib/fechamento";
import { centavos, hojeISO, somarDias } from "../src/lib/formato";
import { tarifaPara } from "../src/lib/lancamentos";
import { dosesPrevistas } from "../src/lib/doses";
import { carregarPlano, registrarRealizados } from "../src/lib/planos";
import { valorTerceirizado } from "../src/lib/tarifas";

/**
 * Dados FICTÍCIOS para demonstração ao cliente.
 * Cria 3 empresas, 9 pacientes, 7 tratamentos, lançamentos de setembro (já fechados, em vários
 * status de recebimento) e de outubro até hoje (em aberto, prontos para fechar).
 * Rode depois de db:migrate e db:seed. Não roda duas vezes.
 */
async function main() {
  const db = await getDb();

  const existe = await db.select().from(schema.empresas).where(like(schema.empresas.nome, "%(demo)%")).limit(1);
  if (existe.length) {
    console.log("Dados de demonstração já existem. Nada a fazer.");
    await fecharDb();
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

  // Tratamentos: os previstos saem da prescrição; os realizados são confirmados na conferência.
  // ajustes: dia → quantidade realizada diferente do previsto; ate: último dia já conferido.
  async function tratamento(
    pacienteId: number,
    tipo: "medicacao" | "curativo",
    inicio: [string, string],
    fim: [string, string] | null,
    itens: { descricao: string; horarios: string }[],
    opts: { ate?: string; ajustes?: Record<string, number>; obs?: string } = {},
  ) {
    const [{ id }] = await db
      .insert(schema.planos)
      .values({ pacienteId, tipo, inicioData: inicio[0], inicioHora: inicio[1], fimData: fim?.[0] ?? null, fimHora: fim?.[1] ?? null, observacoes: opts.obs ?? null, criadoPor: admin.id })
      .returning();
    await db.insert(schema.planoItens).values(itens.map((i) => ({ planoId: id, ...i })));
    const plano = (await carregarPlano(db, id))!;
    const ate = opts.ate ?? hoje;
    const previstos = dosesPrevistas(plano, inicio[0], ate);
    const quantidades = Object.fromEntries(previstos.map((d) => [d.data, opts.ajustes?.[d.data] ?? d.doses.length]));
    await registrarRealizados(db, admin.id, plano, quantidades);
    total += previstos.length;
  }

  // Medicações: atendimentos/dia = soma das doses (ex.: 8/8h + 12/12h = 5).
  await tratamento(p.maria, "medicacao", ["2026-09-01", "06:00"], ["2026-09-11", "06:00"], [
    { descricao: "Ceftriaxona (8/8h)", horarios: "06:00,14:00,22:00" },
    { descricao: "Dipirona (12/12h)", horarios: "06:00,18:00" },
  ]);
  await tratamento(p.maria, "medicacao", ["2026-10-14", "08:00"], ["2026-10-22", "08:00"], [
    { descricao: "Enoxaparina (12/12h)", horarios: "08:00,20:00" },
  ], { ate: "2026-10-20", ajustes: { "2026-10-18": 1 }, obs: "Dia 18: paciente recusou a dose da noite" });
  await tratamento(p.antonio, "medicacao", ["2026-09-15", "06:00"], ["2026-10-13", "06:00"], [
    { descricao: "Meropenem (8/8h)", horarios: "06:00,14:00,22:00" },
  ]);
  await tratamento(p.raimunda, "medicacao", ["2026-09-05", "08:00"], ["2026-09-26", "08:00"], [
    { descricao: "Insulina (12/12h)", horarios: "08:00,20:00" },
  ]);
  await tratamento(p.helena, "medicacao", ["2026-10-05", "09:00"], ["2026-10-20", "09:00"], [
    { descricao: "Vitamina B12 (1x/dia)", horarios: "09:00" },
  ], { ajustes: { "2026-10-12": 0 } });

  // Curativos: 1x por dia, 7 dias por semana.
  await tratamento(p.joao, "curativo", ["2026-09-01", "08:00"], null, [{ descricao: "Curativo", horarios: "08:00" }], { ate: "2026-10-20" });
  await tratamento(p.francisca, "curativo", ["2026-09-10", "10:00"], ["2026-10-10", "10:00"], [{ descricao: "Curativo", horarios: "10:00" }]);

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

  // --- Veículos e despesas (setembro e outubro) ---
  const veiculos: Record<number, { modal: "moto" | "carro"; uso: "logistica" | "enfermagem" }> = {};
  const veiculo = async (descricao: string, placa: string, modal: "moto" | "carro", uso: "logistica" | "enfermagem") => {
    const [v] = await db.insert(schema.veiculos).values({ descricao, placa, modal, uso }).returning();
    veiculos[v.id] = { modal, uso };
    return v.id;
  };
  const cg = await veiculo("Moto Honda CG 160", "QWE1A23", "moto", "logistica");
  const factor = await veiculo("Moto Yamaha Factor 150 (visitas da enfermagem)", "RTY2B34", "moto", "enfermagem");
  const mobi = await veiculo("Carro Fiat Mobi", "ABC3D45", "carro", "logistica");

  let despesasCriadas = 0;
  async function despesa(
    data: string,
    categoria: (typeof schema.despesas.$inferInsert)["categoria"],
    valor: number,
    descricao: string,
    opts: { veiculoId?: number; litros?: number; km?: number; area?: "enfermagem" | "logistica" | "geral"; modal?: "moto" | "carro" | "terceirizado" } = {},
  ) {
    if (data > hoje) return;
    await db.insert(schema.despesas).values({
      data,
      categoria,
      valor,
      descricao,
      area: opts.veiculoId ? veiculos[opts.veiculoId].uso : (opts.area ?? "geral"),
      modal: opts.veiculoId
        ? (veiculos[opts.veiculoId].uso === "logistica" ? veiculos[opts.veiculoId].modal : null)
        : (opts.modal ?? null),
      veiculoId: opts.veiculoId ?? null,
      litros: opts.litros ?? null,
      km: opts.km ?? null,
      criadoPor: admin.id,
    });
    despesasCriadas++;
  }

  // Abastecimentos: motos a cada 4 dias, carro semanal (gasolina a ~R$ 6,19/L).
  let kmCg = 18_200;
  let kmFactor = 9_850;
  let kmMobi = 42_300;
  for (const [i, d] of dias("2026-09-01", hoje, 4).entries()) {
    const l1 = 6 + (i % 3) * 0.5;
    await despesa(d, "combustivel", centavos(l1 * 6.19), "Posto — gasolina comum", { veiculoId: cg, litros: l1, km: (kmCg += 170 + (i % 4) * 15) });
    const l2 = 5.5 + (i % 2) * 0.8;
    await despesa(somarDias(d, 1), "combustivel", centavos(l2 * 6.19), "Posto — gasolina comum", { veiculoId: factor, litros: l2, km: (kmFactor += 160 + (i % 3) * 20) });
  }
  for (const [i, d] of dias("2026-09-03", hoje, 7).entries()) {
    const l = 28 + (i % 3) * 3;
    await despesa(d, "combustivel", centavos(l * 6.19), "Posto — gasolina comum", { veiculoId: mobi, litros: l, km: (kmMobi += 340 + (i % 2) * 40) });
    await despesa(somarDias(d, 2), "pedagio_estacionamento", 15, "Estacionamento hospital", { area: "logistica", modal: "carro" });
  }
  await despesa("2026-09-12", "manutencao", 180, "Revisão 18.000 km", { veiculoId: cg });
  await despesa("2026-09-20", "oleo_pneus_pecas", 65, "Troca de óleo", { veiculoId: factor });
  await despesa("2026-09-26", "oleo_pneus_pecas", 95, "Pastilhas de freio", { veiculoId: cg });
  await despesa("2026-10-03", "manutencao", 120, "Alinhamento e balanceamento", { veiculoId: mobi });
  await despesa("2026-10-15", "oleo_pneus_pecas", 420, "Par de pneus", { veiculoId: mobi });
  await despesa("2026-10-17", "oleo_pneus_pecas", 70, "Troca de óleo", { veiculoId: cg });
  await despesa("2026-09-05", "outras", 320, "Materiais de enfermagem (luvas, gazes, seringas)", { area: "enfermagem" });
  await despesa("2026-10-05", "outras", 290, "Materiais de enfermagem (luvas, gazes, seringas)", { area: "enfermagem" });
  await despesa("2026-09-10", "outras", 400, "Contabilidade", { area: "geral" });
  await despesa("2026-10-10", "outras", 400, "Contabilidade", { area: "geral" });

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

  console.log(`Demonstração criada: 3 empresas, 9 pacientes, 7 tratamentos, ${total + (cancelar ? 1 : 0)} lançamentos, 3 veículos, ${despesasCriadas} despesas, 5 fechamentos de setembro.`);
  await fecharDb();
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
