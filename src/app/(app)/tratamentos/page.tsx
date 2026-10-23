import Link from "next/link";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { dataBR, hojeISO, inicioMesAnterior } from "@/lib/formato";
import { carregarPlanos, pendenciasPorPlano } from "@/lib/planos";
import { Cabecalho, Selo, Vazio } from "@/components/ui";

export default async function TratamentosPage({ searchParams }: PageProps<"/tratamentos">) {
  await exigirUsuario();
  const verEncerrados = (await searchParams).todos === "1";
  const db = await getDb();
  const todos = await carregarPlanos(db);
  const planos = verEncerrados ? todos : todos.filter((p) => p.ativo);
  const hoje = hojeISO();
  const pend = await pendenciasPorPlano(db, planos.filter((p) => p.ativo), inicioMesAnterior(hoje), hoje);
  const totalPendente = [...pend.values()].reduce((s, p) => s + p.dias.length, 0);

  return (
    <>
      <Cabecalho
        titulo="Tratamentos"
        descricao="Medicações e curativos contínuos: o sistema calcula os atendimentos previstos e você confirma os realizados."
        acoes={<Link href="/tratamentos/novo" className="botao">Novo tratamento</Link>}
      />
      {totalPendente > 0 && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {totalPendente} dia(s) com atendimentos previstos ainda não conferidos (mês atual e anterior).
        </p>
      )}
      <div className="mb-3 text-sm">
        <Link className="link" href={verEncerrados ? "/tratamentos" : "/tratamentos?todos=1"}>
          {verEncerrados ? "Mostrar só ativos" : "Mostrar também encerrados"}
        </Link>
      </div>
      <div className="cartao overflow-x-auto p-0">
        {planos.length === 0 ? (
          <Vazio>Nenhum tratamento cadastrado.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Paciente</th><th>Tipo</th><th>Itens e horários</th><th>Período</th><th className="text-right">Por dia</th><th>Pendências</th><th /></tr>
            </thead>
            <tbody>
              {planos.map((p) => {
                const pp = pend.get(p.id);
                return (
                  <tr key={p.id} className={p.ativo ? "" : "text-gray-400"}>
                    <td>
                      <Link href={`/tratamentos/${p.id}`} className="link">{p.paciente}</Link>
                      <span className="block text-xs text-gray-500">{p.empresa}</span>
                    </td>
                    <td>{p.tipo === "medicacao" ? "Medicação" : "Curativo"}</td>
                    <td className="text-xs">
                      {p.itens.map((i) => (
                        <span key={i.descricao + i.horarios.join()} className="block">
                          <strong>{i.descricao}</strong> {i.horarios.join(" · ")}
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {dataBR(p.inicioData)} {p.inicioHora}
                      <span className="block">{p.fimData ? `até ${dataBR(p.fimData)} ${p.fimHora}` : "contínuo"}</span>
                    </td>
                    <td className="text-right">{p.itens.reduce((s, i) => s + i.horarios.length, 0)}</td>
                    <td>
                      {!p.ativo ? <Selo tipo="cancelado">Encerrado</Selo>
                        : pp && pp.dias.length ? <Selo tipo="em_atraso">{pp.dias.length} dia(s) · {pp.doses} atend.</Selo>
                        : <Selo tipo="realizado">Em dia</Selo>}
                    </td>
                    <td className="text-right"><Link href={`/tratamentos/${p.id}/conferencia`} className="link">Conferir</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
