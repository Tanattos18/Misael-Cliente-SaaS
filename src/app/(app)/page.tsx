import Link from "next/link";
import { and, between, eq, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ROTULO_MODAL, ROTULO_TIPO_PLURAL, TIPOS, type Modal, type Tipo } from "@/lib/dominio";
import { emAtraso } from "@/lib/fechamento";
import { centavos, competenciaAtual, competenciaExtenso, moeda, periodoDaCompetencia } from "@/lib/formato";
import { Cabecalho, Indicador } from "@/components/ui";

export default async function PainelPage({ searchParams }: PageProps<"/">) {
  await exigirUsuario();
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const { inicio, fim } = periodoDaCompetencia(competencia);
  const L = schema.lancamentos;
  const F = schema.fechamentos;
  const db = await getDb();

  const [porTipo, porModal, abertos] = await Promise.all([
    db
      .select({ tipo: L.tipo, qtd: sql<number>`sum(${L.quantidade})::int`, total: sql<number>`sum(${L.valorTotal})::float` })
      .from(L)
      .where(and(eq(L.status, "realizado"), between(L.data, inicio, fim)))
      .groupBy(L.tipo),
    db
      .select({
        modal: L.modal,
        qtd: sql<number>`sum(${L.quantidade})::int`,
        total: sql<number>`sum(${L.valorTotal})::float`,
        custo: sql<number>`coalesce(sum(${L.custoTerceiro} * ${L.quantidade}), 0)::float`,
      })
      .from(L)
      .where(and(eq(L.status, "realizado"), eq(L.tipo, "corrida"), between(L.data, inicio, fim)))
      .groupBy(L.modal),
    db
      .select({ f: F, empresa: schema.empresas.nome })
      .from(F)
      .innerJoin(schema.empresas, eq(schema.empresas.id, F.empresaId))
      .where(and(ne(F.status, "reaberto"), ne(F.status, "pago"))),
  ]);

  const tipo = (t: Tipo) => porTipo.find((x) => x.tipo === t) ?? { qtd: 0, total: 0 };
  const modal = (m: Modal) => porModal.find((x) => x.modal === m) ?? { qtd: 0, total: 0, custo: 0 };
  const totalMes = centavos(porTipo.reduce((s, x) => s + x.total, 0));
  const enfermagem = centavos(tipo("medicacao").total + tipo("curativo").total + tipo("coleta").total);

  const porEmpresa = new Map<string, { total: number; atraso: number }>();
  for (const { f, empresa } of abertos) {
    const e = porEmpresa.get(empresa) ?? { total: 0, atraso: 0 };
    e.total = centavos(e.total + f.total);
    if (emAtraso(f)) e.atraso = centavos(e.atraso + f.total);
    porEmpresa.set(empresa, e);
  }

  return (
    <>
      <Cabecalho
        titulo="Painel"
        descricao={`Serviços realizados em ${competenciaExtenso(competencia)}`}
        acoes={
          <form className="flex gap-2">
            <input type="month" name="mes" defaultValue={competencia} className="campo" />
            <button className="botao-sec">Ver</button>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicador rotulo="Faturamento do mês" valor={moeda(totalMes)} />
        <Indicador rotulo="Enfermagem" valor={moeda(enfermagem)} />
        <Indicador rotulo="Logística / home care" valor={moeda(tipo("corrida").total)} detalhe={`${tipo("corrida").qtd} corrida(s)`} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {TIPOS.filter((t) => t !== "corrida").map((t) => (
          <Indicador key={t} rotulo={ROTULO_TIPO_PLURAL[t]} valor={moeda(tipo(t).total)} detalhe={`${tipo(t).qtd} atendimento(s)`} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Corridas por modal</h2>
          <table className="tabela">
            <thead><tr><th>Modal</th><th className="text-right">Corridas</th><th className="text-right">Faturado</th><th className="text-right">Custo terceiro</th></tr></thead>
            <tbody>
              {(["moto", "carro", "terceirizado"] as const).map((m) => (
                <tr key={m}>
                  <td>{ROTULO_MODAL[m]}</td>
                  <td className="text-right">{modal(m).qtd}</td>
                  <td className="text-right">{moeda(modal(m).total)}</td>
                  <td className="text-right">{m === "terceirizado" ? moeda(modal(m).custo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">Despesas de combustível e manutenção entram na etapa 3 (módulo financeiro).</p>
        </section>

        <section className="cartao">
          <h2 className="mb-3 font-semibold">A receber por empresa (todos os meses)</h2>
          {porEmpresa.size === 0 ? (
            <p className="text-sm text-gray-500">Nada pendente.</p>
          ) : (
            <table className="tabela">
              <thead><tr><th>Empresa</th><th className="text-right">Em aberto</th><th className="text-right">Em atraso</th></tr></thead>
              <tbody>
                {[...porEmpresa.entries()].map(([nome, v]) => (
                  <tr key={nome}>
                    <td>{nome}</td>
                    <td className="text-right">{moeda(v.total)}</td>
                    <td className={`text-right ${v.atraso ? "font-semibold text-red-700" : ""}`}>{moeda(v.atraso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/fechamentos" className="link mt-3 inline-block text-sm">Ver fechamentos</Link>
        </section>
      </div>
    </>
  );
}
