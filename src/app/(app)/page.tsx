import Link from "next/link";
import { and, between, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ROTULO_AREA, ROTULO_MODAL, ROTULO_TIPO_PLURAL, TIPOS_ENFERMAGEM } from "@/lib/dominio";
import { emAtraso } from "@/lib/fechamento";
import { centavos, competenciaAtual, competenciaExtenso, hojeISO, inicioMesAnterior, moeda, periodoDaCompetencia } from "@/lib/formato";
import { carregarPlanos, pendenciasPorPlano } from "@/lib/planos";
import { resultadoDoMes, ultimosMeses } from "@/lib/resultado";
import { GraficoMeses } from "@/components/grafico-meses";
import { Cabecalho, Indicador } from "@/components/ui";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const corResultado = (v: number) => (v < 0 ? "text-red-700" : "");

export default async function PainelPage({ searchParams }: PageProps<"/">) {
  await exigirUsuario();
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const { inicio, fim } = periodoDaCompetencia(competencia);
  const hoje = hojeISO();
  const L = schema.lancamentos;
  const F = schema.fechamentos;
  const db = await getDb();

  const meses = ultimosMeses(competencia, 6);
  const [historico, abertos, porEmpresa, topPacientes, planos] = await Promise.all([
    Promise.all(meses.map(async (m) => ({ competencia: m, r: await resultadoDoMes(db, m) }))),
    db
      .select({ f: F, empresa: schema.empresas.nome })
      .from(F)
      .innerJoin(schema.empresas, eq(schema.empresas.id, F.empresaId))
      .where(and(ne(F.status, "reaberto"), ne(F.status, "pago"))),
    db
      .select({
        empresa: schema.empresas.nome,
        area: L.area,
        total: sql<number>`sum(${L.valorTotal})::float`,
        emAberto: sql<number>`coalesce(sum(${L.valorTotal}) filter (where ${L.fechamentoId} is null), 0)::float`,
      })
      .from(L)
      .innerJoin(schema.empresas, eq(schema.empresas.id, L.empresaId))
      .where(and(eq(L.status, "realizado"), between(L.data, inicio, fim)))
      .groupBy(schema.empresas.nome, L.area)
      .orderBy(schema.empresas.nome, L.area),
    db
      .select({ paciente: schema.pacientes.nome, total: sql<number>`sum(${L.valorTotal})::float`, qtd: sql<number>`sum(${L.quantidade})::int` })
      .from(L)
      .innerJoin(schema.pacientes, eq(schema.pacientes.id, L.pacienteId))
      .where(and(eq(L.status, "realizado"), between(L.data, inicio, fim)))
      .groupBy(schema.pacientes.nome)
      .orderBy(desc(sql`sum(${L.valorTotal})`))
      .limit(5),
    carregarPlanos(db).then((p) => p.filter((x) => x.ativo)),
  ]);
  const r = historico[historico.length - 1].r;

  // --- Alertas ---
  const pend = await pendenciasPorPlano(db, planos, inicioMesAnterior(hoje), hoje);
  const diasSemConferencia = [...pend.values()].reduce((s, p) => s + p.dias.length, 0);
  const atrasados = abertos.filter((x) => emAtraso(x.f));
  const aguardandoEnvio = abertos.filter((x) => x.f.status === "calculado");
  const mesAnterior = inicioMesAnterior(hoje).slice(0, 7);
  const periodoAnt = periodoDaCompetencia(mesAnterior);
  const [{ semFechamento }] = await db
    .select({ semFechamento: sql<number>`coalesce(sum(${L.valorTotal}), 0)::float` })
    .from(L)
    .where(and(eq(L.status, "realizado"), isNull(L.fechamentoId), between(L.data, periodoAnt.inicio, periodoAnt.fim)));

  const aReceber = centavos(abertos.reduce((s, x) => s + x.f.total, 0));
  const totalAtraso = centavos(atrasados.reduce((s, x) => s + x.f.total, 0));
  const receberPorEmpresa = new Map<string, { total: number; atraso: number }>();
  for (const { f, empresa } of abertos) {
    const e = receberPorEmpresa.get(empresa) ?? { total: 0, atraso: 0 };
    e.total = centavos(e.total + f.total);
    if (emAtraso(f)) e.atraso = centavos(e.atraso + f.total);
    receberPorEmpresa.set(empresa, e);
  }

  const alertas: { texto: string; href: string; nivel: "alto" | "medio" }[] = [];
  if (atrasados.length) alertas.push({ texto: `${atrasados.length} fechamento(s) em atraso — ${moeda(totalAtraso)}`, href: "/fechamentos?status=em_atraso", nivel: "alto" });
  if (semFechamento > 0) alertas.push({ texto: `${moeda(semFechamento)} de ${competenciaExtenso(mesAnterior)} ainda sem fechamento`, href: `/fechamentos/novo?mes=${mesAnterior}`, nivel: "alto" });
  if (aguardandoEnvio.length) alertas.push({ texto: `${aguardandoEnvio.length} fechamento(s) calculado(s) aguardando envio à empresa`, href: "/fechamentos?status=calculado", nivel: "medio" });
  if (diasSemConferencia) alertas.push({ texto: `${diasSemConferencia} dia(s) de tratamento sem conferência`, href: "/tratamentos", nivel: "medio" });

  return (
    <>
      <Cabecalho
        titulo="Painel"
        descricao={`Visão geral de ${competenciaExtenso(competencia)}`}
        acoes={
          <form className="flex gap-2">
            <input type="month" name="mes" defaultValue={competencia} className="campo" />
            <button className="botao-sec">Ver</button>
          </form>
        }
      />

      {alertas.length > 0 && (
        <section className="mb-6 grid gap-2 md:grid-cols-2">
          {alertas.map((a) => (
            <Link key={a.texto} href={a.href}
              className={`flex items-center gap-2 rounded-md border p-3 text-sm hover:shadow-sm ${a.nivel === "alto" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <span aria-hidden>{a.nivel === "alto" ? "⚠" : "●"}</span>
              <span className="font-medium">{a.nivel === "alto" ? "Atenção:" : "Pendente:"}</span> {a.texto}
            </Link>
          ))}
        </section>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Faturamento do mês" valor={moeda(r.total.receita)} />
        <Indicador rotulo="Despesas operacionais" valor={moeda(r.total.despesa)} />
        <Indicador rotulo="Resultado geral" valor={moeda(r.total.resultado)} detalhe={`Margem ${pct(r.total.margem)}`} />
        <Indicador rotulo="A receber (todas as empresas)" valor={moeda(aReceber)} detalhe={totalAtraso ? `${moeda(totalAtraso)} em atraso` : "nada em atraso"} />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TIPOS_ENFERMAGEM.map((t) => (
          <Indicador key={t} rotulo={ROTULO_TIPO_PLURAL[t]} valor={moeda(r.receitaPorTipo[t].total)} detalhe={`${r.receitaPorTipo[t].quantidade} atendimento(s)`} />
        ))}
        <Indicador rotulo="Logística / home care" valor={moeda(r.receitaPorTipo.corrida.total)} detalhe={`${r.receitaPorTipo.corrida.quantidade} corrida(s)`} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["moto", "carro", "terceirizado"] as const).map((m) => (
          <Indicador key={m} rotulo={`Corridas — ${ROTULO_MODAL[m]}`} valor={String(r.modais[m].corridas)} detalhe={`${moeda(r.modais[m].receita)} faturados`} />
        ))}
        <Indicador
          rotulo="Combustível e manutenção"
          valor={moeda(r.despesasPorCategoria.combustivel + r.despesasPorCategoria.manutencao + r.despesasPorCategoria.oleo_pneus_pecas)}
          detalhe={`Combustível ${moeda(r.despesasPorCategoria.combustivel)} · ${r.combustivelLitros.toLocaleString("pt-BR")} L`}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao overflow-x-auto">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Resultado por área</h2>
            <Link href={`/resultado?mes=${competencia}`} className="link text-sm">Detalhar</Link>
          </div>
          <table className="tabela">
            <thead><tr><th>Área</th><th className="text-right">Receita</th><th className="text-right">Despesa</th><th className="text-right">Resultado</th></tr></thead>
            <tbody>
              <tr><td>Enfermagem</td><td className="text-right">{moeda(r.enfermagem.receita)}</td><td className="text-right">{moeda(r.enfermagem.despesa)}</td><td className={`text-right font-medium ${corResultado(r.enfermagem.resultado)}`}>{moeda(r.enfermagem.resultado)}</td></tr>
              <tr><td>Logística / home care</td><td className="text-right">{moeda(r.logistica.receita)}</td><td className="text-right">{moeda(r.logistica.despesa)}</td><td className={`text-right font-medium ${corResultado(r.logistica.resultado)}`}>{moeda(r.logistica.resultado)}</td></tr>
              {(["moto", "carro", "terceirizado"] as const).map((m) => (
                <tr key={m} className="text-xs text-gray-500">
                  <td className="pl-6">↳ {ROTULO_MODAL[m]}</td>
                  <td className="text-right">{moeda(r.modais[m].receita)}</td>
                  <td className="text-right">{moeda(r.modais[m].despesa)}</td>
                  <td className={`text-right ${corResultado(r.modais[m].resultado)}`}>{moeda(r.modais[m].resultado)}</td>
                </tr>
              ))}
              <tr><td>Despesas gerais</td><td className="text-right">—</td><td className="text-right">{moeda(r.geral)}</td><td className="text-right">{moeda(-r.geral)}</td></tr>
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-3">Geral</td>
                <td className="px-3 text-right">{moeda(r.total.receita)}</td>
                <td className="px-3 text-right">{moeda(r.total.despesa)}</td>
                <td className={`px-3 text-right ${corResultado(r.total.resultado)}`}>{moeda(r.total.resultado)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="cartao overflow-x-auto">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">A receber por empresa</h2>
            <Link href="/fechamentos" className="link text-sm">Fechamentos</Link>
          </div>
          {receberPorEmpresa.size === 0 ? (
            <p className="text-sm text-gray-500">Nada pendente de recebimento.</p>
          ) : (
            <table className="tabela">
              <thead><tr><th>Empresa</th><th className="text-right">Em aberto</th><th className="text-right">Em atraso</th></tr></thead>
              <tbody>
                {[...receberPorEmpresa.entries()].map(([nome, v]) => (
                  <tr key={nome}>
                    <td>{nome}</td>
                    <td className="text-right">{moeda(v.total)}</td>
                    <td className={`text-right ${v.atraso ? "font-semibold text-red-700" : ""}`}>{moeda(v.atraso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-gray-500">Fechamentos enviados, aprovados ou com NF ainda não pagos.</p>
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Faturamento por empresa no mês</h2>
          <table className="tabela">
            <thead><tr><th>Empresa</th><th>Área</th><th className="text-right">Faturado</th><th className="text-right">Ainda sem fechamento</th></tr></thead>
            <tbody>
              {porEmpresa.map((e) => (
                <tr key={e.empresa + e.area}>
                  <td>{e.empresa}</td>
                  <td>{ROTULO_AREA[e.area]}</td>
                  <td className="text-right">{moeda(e.total)}</td>
                  <td className="text-right">{e.emAberto ? moeda(e.emAberto) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Pacientes com maior faturamento no mês</h2>
          <table className="tabela">
            <thead><tr><th>Paciente</th><th className="text-right">Atendimentos</th><th className="text-right">Faturado</th></tr></thead>
            <tbody>
              {topPacientes.map((p) => (
                <tr key={p.paciente}><td>{p.paciente}</td><td className="text-right">{p.qtd}</td><td className="text-right">{moeda(p.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="cartao">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Receita × despesa — últimos 6 meses</h2>
          <Link href={`/resultado?mes=${competencia}`} className="link text-sm">Ver tabela</Link>
        </div>
        <GraficoMeses dados={historico.map((h) => ({ competencia: h.competencia, receita: h.r.total.receita, despesa: h.r.total.despesa }))} />
      </section>
    </>
  );
}
