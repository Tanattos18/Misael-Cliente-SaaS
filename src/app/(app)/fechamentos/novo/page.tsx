import Link from "next/link";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesEmpresas } from "@/lib/consultas";
import { AREAS, ROTULO_AREA, type Area } from "@/lib/dominio";
import { pendenciasDoMes, previaFechamento } from "@/lib/fechamento";
import { competenciaAtual, competenciaExtenso, moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Vazio } from "@/components/ui";
import { gerar, gerarTodos } from "../actions";

export default async function NovoFechamentoPage({ searchParams }: PageProps<"/fechamentos/novo">) {
  await exigirUsuario();
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const empresaId = Number(sp.empresa) || undefined;
  const area: Area = sp.area === "logistica" ? "logistica" : "enfermagem";

  const db = await getDb();
  const [empresas, pendencias] = await Promise.all([opcoesEmpresas(db), pendenciasDoMes(db, competencia)]);
  const previa = empresaId ? await previaFechamento(db, empresaId, area, competencia) : null;

  return (
    <>
      <Cabecalho
        titulo="Fechamento mensal"
        descricao="Gera a planilha de conferência por empresa e área. Os valores ficam congelados no fechamento."
      />

      <section className="cartao mb-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Em aberto em {competenciaExtenso(competencia)}</h2>
          <form className="flex gap-2">
            <input type="month" name="mes" defaultValue={competencia} className="campo" />
            <button className="botao-sec">Trocar mês</button>
          </form>
        </div>
        {pendencias.length === 0 ? (
          <Vazio>Nenhum lançamento em aberto neste mês.</Vazio>
        ) : (
          <>
            <table className="tabela">
              <thead><tr><th>Empresa</th><th>Área</th><th className="text-right">Atendimentos</th><th className="text-right">Total</th><th /></tr></thead>
              <tbody>
                {pendencias.map((p) => (
                  <tr key={`${p.empresaId}-${p.area}`}>
                    <td>{p.empresa}</td>
                    <td>{ROTULO_AREA[p.area]}</td>
                    <td className="text-right">{p.quantidade}</td>
                    <td className="text-right font-medium">{moeda(p.total)}</td>
                    <td className="text-right">
                      {p.existenteId ? (
                        <span className="text-xs text-amber-700">
                          Lançamentos após o <Link className="link" href={`/fechamentos/${p.existenteId}`}>fechamento nº {p.existenteId}</Link>
                        </span>
                      ) : (
                        <Link className="link" href={`/fechamentos/novo?mes=${competencia}&empresa=${p.empresaId}&area=${p.area}`}>Conferir</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ActionForm
              action={gerarTodos}
              botao={`Gerar todos os fechamentos de ${competenciaExtenso(competencia)}`}
              confirmar="Gerar os fechamentos de todas as empresas pendentes?"
            >
              <input type="hidden" name="competencia" value={competencia} />
            </ActionForm>
          </>
        )}
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Conferir uma empresa</h2>
        <form className="mb-4 grid gap-3 sm:grid-cols-4">
          <input type="month" name="mes" defaultValue={competencia} className="campo" />
          <select name="empresa" defaultValue={empresaId ?? ""} className="campo" required>
            <option value="">Empresa…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select name="area" defaultValue={area} className="campo">
            {AREAS.map((a) => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
          </select>
          <button className="botao-sec">Ver prévia</button>
        </form>

        {previa && (
          previa.relatorio.secoes.length === 0 ? (
            <Vazio>Nenhum lançamento em aberto para esta empresa/área no mês.</Vazio>
          ) : (
            <>
              {previa.relatorio.secoes.map((s) => (
                <div key={s.chave} className="mb-5">
                  <h3 className="mb-2 text-sm font-semibold text-teal-800">{s.titulo} — {s.quantidade} · {moeda(s.total)}</h3>
                  <table className="tabela">
                    <thead><tr><th>Paciente</th><th>Datas</th><th className="text-right">Qtd</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {s.pacientes.map((p) => (
                        <tr key={p.paciente}>
                          <td>{p.paciente}</td>
                          <td className="text-xs text-gray-500">{[...new Set(p.itens.map((i) => i.data.slice(8, 10)))].join(", ")}</td>
                          <td className="text-right">{p.quantidade}</td>
                          <td className="text-right">{moeda(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="mb-2 text-right text-lg font-semibold">Total: {moeda(previa.relatorio.total)}</p>
              {previa.existenteId ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  Já existe o <Link className="link" href={`/fechamentos/${previa.existenteId}`}>fechamento nº {previa.existenteId}</Link> para este mês. Estes lançamentos foram feitos depois dele: reabra o fechamento para incluí-los.
                </p>
              ) : (
                <ActionForm action={gerar} botao="Gerar fechamento" confirmar="Gerar o fechamento? Os lançamentos ficarão bloqueados para edição.">
                  <input type="hidden" name="empresaId" value={empresaId} />
                  <input type="hidden" name="area" value={area} />
                  <input type="hidden" name="competencia" value={competencia} />
                </ActionForm>
              )}
            </>
          )
        )}
      </section>
    </>
  );
}
