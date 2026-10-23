import Link from "next/link";
import { and, asc, between, desc, eq, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import {
  CATEGORIAS_DESPESA,
  ROTULO_AREA_DESPESA,
  ROTULO_CATEGORIA,
  ROTULO_MODAL,
  type CategoriaDespesa,
} from "@/lib/dominio";
import { centavos, competenciaAtual, competenciaExtenso, dataBR, moeda, periodoDaCompetencia } from "@/lib/formato";
import { resultadoDoMes } from "@/lib/resultado";
import { Cabecalho, Selo, Vazio } from "@/components/ui";

export default async function DespesasPage({ searchParams }: PageProps<"/despesas">) {
  await exigirUsuario();
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const categoria = (CATEGORIAS_DESPESA as readonly string[]).includes(String(sp.categoria)) ? (sp.categoria as CategoriaDespesa) : undefined;
  const verCanceladas = sp.canceladas === "1";
  const { inicio, fim } = periodoDaCompetencia(competencia);

  const D = schema.despesas;
  const filtros: SQL[] = [between(D.data, inicio, fim)];
  if (categoria) filtros.push(eq(D.categoria, categoria));
  if (!verCanceladas) filtros.push(eq(D.status, "ativa"));

  const db = await getDb();
  const [linhas, resultado] = await Promise.all([
    db
      .select({ d: D, veiculo: schema.veiculos.descricao })
      .from(D)
      .leftJoin(schema.veiculos, eq(schema.veiculos.id, D.veiculoId))
      .where(and(...filtros))
      .orderBy(desc(D.data), asc(D.id)),
    resultadoDoMes(db, competencia),
  ]);
  const total = centavos(linhas.filter((l) => l.d.status === "ativa").reduce((s, l) => s + l.d.valor, 0));
  const porCategoria = resultado.despesasPorCategoria;
  const totalCategorias = centavos(Object.values(porCategoria).reduce((s, v) => s + v, 0));

  return (
    <>
      <Cabecalho
        titulo="Despesas"
        descricao={competenciaExtenso(competencia)}
        acoes={
          <>
            <Link href="/despesas/novo" className="botao">Lançar despesa</Link>
            <Link href={`/resultado?mes=${competencia}`} className="botao-sec">Resultado do mês</Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {CATEGORIAS_DESPESA.map((c) => (
          <Link key={c} href={`/despesas?mes=${competencia}&categoria=${c}`} className={`cartao p-3 hover:border-teal-600 ${categoria === c ? "border-teal-600" : ""}`}>
            <p className="text-[11px] font-medium uppercase text-gray-500">{ROTULO_CATEGORIA[c]}</p>
            <p className="mt-1 font-semibold">{moeda(porCategoria[c])}</p>
          </Link>
        ))}
        <Link href={`/despesas?mes=${competencia}`} className="cartao bg-teal-50 p-3">
          <p className="text-[11px] font-medium uppercase text-gray-500">Total do mês</p>
          <p className="mt-1 font-semibold">{moeda(totalCategorias)}</p>
        </Link>
      </div>
      {porCategoria.terceirizado > 0 && (
        <p className="-mt-3 mb-4 text-xs text-gray-500">
          Transportadores terceirizados inclui o custo das corridas terceirizadas lançadas no mês (automático), além das despesas abaixo.
        </p>
      )}

      <form className="cartao mb-4 grid gap-3 sm:grid-cols-4">
        <input type="month" name="mes" defaultValue={competencia} className="campo" />
        <select name="categoria" defaultValue={categoria ?? ""} className="campo">
          <option value="">Todas as categorias</option>
          {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="canceladas" value="1" defaultChecked={verCanceladas} /> Ver canceladas
        </label>
        <button className="botao-sec">Filtrar</button>
      </form>

      <div className="cartao overflow-x-auto p-0">
        {linhas.length === 0 ? (
          <Vazio>Nenhuma despesa lançada no período.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Veículo / apropriação</th><th className="text-right">Litros</th><th className="text-right">Valor</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ d, veiculo }) => (
                <tr key={d.id} className={d.status === "cancelada" ? "text-gray-400 line-through" : ""}>
                  <td className="whitespace-nowrap">{dataBR(d.data)}</td>
                  <td><Link href={`/despesas/${d.id}`} className="link">{ROTULO_CATEGORIA[d.categoria]}</Link></td>
                  <td>{d.descricao}</td>
                  <td className="text-xs">
                    {veiculo ?? ROTULO_AREA_DESPESA[d.area]}
                    {!veiculo && d.modal ? ` · ${ROTULO_MODAL[d.modal]}` : ""}
                    {d.status === "cancelada" && <> <Selo tipo="cancelado">Cancelada</Selo></>}
                  </td>
                  <td className="text-right">{d.litros ? d.litros.toLocaleString("pt-BR") : ""}</td>
                  <td className="text-right font-medium">{moeda(d.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={5} className="px-3 py-3">Total (sem canceladas)</td>
                <td className="px-3 text-right">{moeda(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
