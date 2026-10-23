import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesEmpresas } from "@/lib/consultas";
import { ROTULO_AREA, ROTULO_STATUS, STATUS_FECHAMENTO, type StatusFechamento } from "@/lib/dominio";
import { emAtraso } from "@/lib/fechamento";
import { centavos, competenciaExtenso, dataBR, moeda } from "@/lib/formato";
import { Cabecalho, Indicador, Selo, Vazio } from "@/components/ui";

export default async function FechamentosPage({ searchParams }: PageProps<"/fechamentos">) {
  await exigirUsuario();
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : "";
  const empresaId = Number(sp.empresa) || undefined;
  const status = (STATUS_FECHAMENTO as readonly string[]).includes(String(sp.status)) ? (sp.status as StatusFechamento) : undefined;
  const somenteAtraso = sp.status === "em_atraso";

  const F = schema.fechamentos;
  const filtros: SQL[] = [];
  if (mes) filtros.push(eq(F.competencia, mes));
  if (empresaId) filtros.push(eq(F.empresaId, empresaId));
  if (status) filtros.push(eq(F.status, status));

  const db = await getDb();
  const [todos, empresas] = await Promise.all([
    db
      .select({ f: F, empresa: schema.empresas.nome })
      .from(F)
      .innerJoin(schema.empresas, eq(schema.empresas.id, F.empresaId))
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(desc(F.competencia), desc(F.id))
      .limit(500),
    opcoesEmpresas(db),
  ]);
  const lista = somenteAtraso ? todos.filter((x) => emAtraso(x.f)) : todos;

  const ativos = lista.filter((x) => x.f.status !== "reaberto");
  const soma = (fn: (x: (typeof lista)[number]) => boolean) => centavos(ativos.filter(fn).reduce((s, x) => s + x.f.total, 0));
  const aguardando = soma((x) => x.f.status === "calculado");
  const aReceber = soma((x) => ["enviado", "aprovado", "nf_emitida"].includes(x.f.status));
  const atrasado = soma((x) => emAtraso(x.f));
  const recebido = centavos(ativos.filter((x) => x.f.status === "pago").reduce((s, x) => s + (x.f.valorPago ?? x.f.total), 0));

  return (
    <>
      <Cabecalho
        titulo="Fechamentos e recebimentos"
        acoes={<Link href="/fechamentos/novo" className="botao">Novo fechamento</Link>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Aguardando envio" valor={moeda(aguardando)} />
        <Indicador rotulo="A receber" valor={moeda(aReceber)} detalhe="enviado, aprovado ou com NF" />
        <Indicador rotulo="Em atraso" valor={moeda(atrasado)} />
        <Indicador rotulo="Recebido" valor={moeda(recebido)} />
      </div>

      <form className="cartao mb-4 grid gap-3 sm:grid-cols-4">
        <input type="month" name="mes" defaultValue={mes} className="campo" />
        <select name="empresa" defaultValue={empresaId ?? ""} className="campo">
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select name="status" defaultValue={somenteAtraso ? "em_atraso" : (status ?? "")} className="campo">
          <option value="">Todos os status</option>
          {STATUS_FECHAMENTO.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          <option value="em_atraso">{ROTULO_STATUS.em_atraso}</option>
        </select>
        <button className="botao-sec">Filtrar</button>
      </form>

      <div className="cartao overflow-x-auto p-0">
        {lista.length === 0 ? (
          <Vazio>Nenhum fechamento encontrado.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Nº</th><th>Competência</th><th>Empresa</th><th>Área</th><th className="text-right">Total</th><th>Vencimento</th><th>Status</th><th>Arquivos</th></tr>
            </thead>
            <tbody>
              {lista.map(({ f, empresa }) => (
                <tr key={f.id} className={f.status === "reaberto" ? "text-gray-400" : ""}>
                  <td><Link href={`/fechamentos/${f.id}`} className="link">{f.id}</Link></td>
                  <td>{competenciaExtenso(f.competencia)}</td>
                  <td>{empresa}</td>
                  <td>{ROTULO_AREA[f.area]}</td>
                  <td className="text-right font-medium">{moeda(f.total)}</td>
                  <td>{dataBR(f.dataVencimento)}</td>
                  <td className="space-x-1">
                    <Selo tipo={f.status}>{ROTULO_STATUS[f.status]}</Selo>
                    {emAtraso(f) && <Selo tipo="em_atraso">Em atraso</Selo>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap text-xs">
                    <a className="link" href={`/api/fechamentos/${f.id}/excel`}>Excel</a>
                    <a className="link" href={`/api/fechamentos/${f.id}/pdf`}>PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
