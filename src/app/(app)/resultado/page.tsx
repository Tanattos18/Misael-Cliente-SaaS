import Link from "next/link";
import { and, asc, between, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA, ROTULO_MODAL, ROTULO_TIPO_PLURAL, TIPOS } from "@/lib/dominio";
import { competenciaAtual, competenciaExtenso, moeda, periodoDaCompetencia } from "@/lib/formato";
import { resultadoDoMes, ultimosMeses } from "@/lib/resultado";
import { GraficoMeses } from "@/components/grafico-meses";
import { Cabecalho, Indicador } from "@/components/ui";

const corResultado = (v: number) => (v < 0 ? "text-red-700" : "text-gray-900");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export default async function ResultadoPage({ searchParams }: PageProps<"/resultado">) {
  await exigirUsuario();
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const db = await getDb();

  const meses = ultimosMeses(competencia, 6);
  const historico = await Promise.all(meses.map(async (m) => ({ competencia: m, r: await resultadoDoMes(db, m) })));
  const r = historico[historico.length - 1].r;
  const anterior = historico[historico.length - 2].r;

  const { inicio, fim } = periodoDaCompetencia(competencia);
  const D = schema.despesas;
  const combustivel = await db
    .select({
      veiculo: schema.veiculos.descricao,
      abastecimentos: sql<number>`count(*)::int`,
      litros: sql<number>`coalesce(sum(${D.litros}), 0)::float`,
      valor: sql<number>`sum(${D.valor})::float`,
      kmMin: sql<number | null>`min(${D.km})`,
      kmMax: sql<number | null>`max(${D.km})`,
    })
    .from(D)
    .innerJoin(schema.veiculos, eq(schema.veiculos.id, D.veiculoId))
    .where(and(eq(D.status, "ativa"), eq(D.categoria, "combustivel"), between(D.data, inicio, fim)))
    .groupBy(schema.veiculos.descricao)
    .orderBy(asc(schema.veiculos.descricao));

  const variacao = (atual: number, ant: number) =>
    ant ? `${atual >= ant ? "+" : ""}${(((atual - ant) / ant) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% vs mês anterior` : undefined;

  return (
    <>
      <Cabecalho
        titulo="Resultado financeiro"
        descricao={`${competenciaExtenso(competencia)} · receita pela data do serviço realizado; despesas pela data do gasto`}
        acoes={
          <>
            <form className="flex gap-2">
              <input type="month" name="mes" defaultValue={competencia} className="campo" />
              <button className="botao-sec">Ver</button>
            </form>
            <a href={`/api/resultado/${competencia}`} className="botao">Baixar Excel</a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Receita" valor={moeda(r.total.receita)} detalhe={variacao(r.total.receita, anterior.total.receita)} />
        <Indicador rotulo="Despesas" valor={moeda(r.total.despesa)} detalhe={variacao(r.total.despesa, anterior.total.despesa)} />
        <Indicador rotulo="Resultado" valor={moeda(r.total.resultado)} detalhe={`Margem ${pct(r.total.margem)}`} />
        <Indicador rotulo="Combustível + manutenção" valor={moeda(r.despesasPorCategoria.combustivel + r.despesasPorCategoria.manutencao + r.despesasPorCategoria.oleo_pneus_pecas)} detalhe={`${r.combustivelLitros.toLocaleString("pt-BR")} litros abastecidos`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Por área</h2>
          <table className="tabela">
            <thead><tr><th>Área</th><th className="text-right">Receita</th><th className="text-right">Despesa</th><th className="text-right">Resultado</th></tr></thead>
            <tbody>
              {([["Enfermagem", r.enfermagem], ["Logística / home care", r.logistica]] as const).map(([nome, b]) => (
                <tr key={nome}>
                  <td>{nome}</td>
                  <td className="text-right">{moeda(b.receita)}</td>
                  <td className="text-right">{moeda(b.despesa)}</td>
                  <td className={`text-right font-medium ${corResultado(b.resultado)}`}>{moeda(b.resultado)}</td>
                </tr>
              ))}
              <tr>
                <td>Despesas gerais (empresa)</td><td className="text-right">—</td>
                <td className="text-right">{moeda(r.geral)}</td>
                <td className={`text-right font-medium ${corResultado(-r.geral)}`}>{moeda(-r.geral)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-3">Resultado geral</td>
                <td className="px-3 text-right">{moeda(r.total.receita)}</td>
                <td className="px-3 text-right">{moeda(r.total.despesa)}</td>
                <td className={`px-3 text-right ${corResultado(r.total.resultado)}`}>{moeda(r.total.resultado)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Logística por modal</h2>
          <table className="tabela">
            <thead><tr><th>Modal</th><th className="text-right">Corridas</th><th className="text-right">Receita</th><th className="text-right">Custo</th><th className="text-right">Resultado</th></tr></thead>
            <tbody>
              {(["moto", "carro", "terceirizado"] as const).map((m) => (
                <tr key={m}>
                  <td>{ROTULO_MODAL[m]}</td>
                  <td className="text-right">{r.modais[m].corridas}</td>
                  <td className="text-right">{moeda(r.modais[m].receita)}</td>
                  <td className="text-right">{moeda(r.modais[m].despesa)}</td>
                  <td className={`text-right font-medium ${corResultado(r.modais[m].resultado)}`}>{moeda(r.modais[m].resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">Custo de moto/carro: despesas lançadas com veículo ou modal. Terceirizado: custo pago às transportadoras.</p>
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Receita por serviço</h2>
          <table className="tabela">
            <thead><tr><th>Serviço</th><th className="text-right">Qtd</th><th className="text-right">Receita</th></tr></thead>
            <tbody>
              {TIPOS.map((t) => (
                <tr key={t}><td>{ROTULO_TIPO_PLURAL[t]}</td><td className="text-right">{r.receitaPorTipo[t].quantidade}</td><td className="text-right">{moeda(r.receitaPorTipo[t].total)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="cartao overflow-x-auto">
          <h2 className="mb-3 font-semibold">Despesas por categoria</h2>
          <table className="tabela">
            <thead><tr><th>Categoria</th><th className="text-right">{competenciaExtenso(meses[4]).slice(0, 3)}</th><th className="text-right">{competenciaExtenso(competencia).slice(0, 3)}</th></tr></thead>
            <tbody>
              {CATEGORIAS_DESPESA.map((c) => (
                <tr key={c}>
                  <td><Link className="link" href={`/despesas?mes=${competencia}&categoria=${c}`}>{ROTULO_CATEGORIA[c]}</Link></td>
                  <td className="text-right text-gray-500">{moeda(anterior.despesasPorCategoria[c])}</td>
                  <td className="text-right">{moeda(r.despesasPorCategoria[c])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {combustivel.length > 0 && (
        <section className="cartao mb-6 overflow-x-auto">
          <h2 className="mb-3 font-semibold">Combustível por veículo</h2>
          <table className="tabela">
            <thead><tr><th>Veículo</th><th className="text-right">Abastecimentos</th><th className="text-right">Litros</th><th className="text-right">Valor</th><th className="text-right">R$/litro</th><th className="text-right">Km rodados</th><th className="text-right">Km/litro</th></tr></thead>
            <tbody>
              {combustivel.map((c) => {
                const km = c.kmMax != null && c.kmMin != null ? c.kmMax - c.kmMin : null;
                return (
                  <tr key={c.veiculo}>
                    <td>{c.veiculo}</td>
                    <td className="text-right">{c.abastecimentos}</td>
                    <td className="text-right">{c.litros.toLocaleString("pt-BR")}</td>
                    <td className="text-right">{moeda(c.valor)}</td>
                    <td className="text-right">{c.litros ? moeda(c.valor / c.litros) : "—"}</td>
                    <td className="text-right">{km ? km.toLocaleString("pt-BR") : "—"}</td>
                    <td className="text-right">{km && c.litros ? (km / c.litros).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">Km rodados: diferença entre o maior e o menor hodômetro informado no mês.</p>
        </section>
      )}

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">Comparativo dos últimos 6 meses</h2>
        <GraficoMeses dados={historico.map((h) => ({ competencia: h.competencia, receita: h.r.total.receita, despesa: h.r.total.despesa }))} />
        <table className="tabela mt-4">
          <thead>
            <tr><th>Mês</th><th className="text-right">Enfermagem</th><th className="text-right">Logística</th><th className="text-right">Receita</th><th className="text-right">Despesas</th><th className="text-right">Resultado</th><th className="text-right">Margem</th></tr>
          </thead>
          <tbody>
            {historico.map(({ competencia: m, r: x }) => (
              <tr key={m} className={m === competencia ? "font-semibold" : ""}>
                <td><Link className="link" href={`/resultado?mes=${m}`}>{competenciaExtenso(m)}</Link></td>
                <td className="text-right">{moeda(x.enfermagem.receita)}</td>
                <td className="text-right">{moeda(x.logistica.receita)}</td>
                <td className="text-right">{moeda(x.total.receita)}</td>
                <td className="text-right">{moeda(x.total.despesa)}</td>
                <td className={`text-right ${corResultado(x.total.resultado)}`}>{moeda(x.total.resultado)}</td>
                <td className="text-right">{pct(x.total.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
