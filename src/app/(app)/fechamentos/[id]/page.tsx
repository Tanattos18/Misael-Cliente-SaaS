import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ROTULO_AREA, ROTULO_STATUS } from "@/lib/dominio";
import { emAtraso, relatorioDoFechamento } from "@/lib/fechamento";
import { competenciaExtenso, dataBR, hojeISO, moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { atualizarStatus, reabrir } from "../actions";

const ETAPAS = [
  { status: "calculado", rotulo: "Calculado", data: "criadoEm" },
  { status: "enviado", rotulo: "Enviado p/ conferência", data: "dataEnvio" },
  { status: "aprovado", rotulo: "Aprovado", data: "dataAprovacao" },
  { status: "nf_emitida", rotulo: "NF emitida", data: "dataNf" },
  { status: "pago", rotulo: "Pago", data: "dataPagamento" },
] as const;

export default async function FechamentoPage({ params }: PageProps<"/fechamentos/[id]">) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const db = await getDb();
  const [linha] = await db
    .select({ f: schema.fechamentos, empresa: schema.empresas.nome })
    .from(schema.fechamentos)
    .innerJoin(schema.empresas, eq(schema.empresas.id, schema.fechamentos.empresaId))
    .where(eq(schema.fechamentos.id, id));
  if (!linha) notFound();
  const { f, empresa } = linha;
  const relatorio = (await relatorioDoFechamento(db, id))!;

  const reaberto = f.status === "reaberto";
  const indice = ETAPAS.findIndex((e) => e.status === f.status);
  const proxima = reaberto ? undefined : ETAPAS[indice + 1];
  const hoje = hojeISO();

  return (
    <>
      <Cabecalho
        titulo={`Fechamento nº ${f.id} — ${empresa}`}
        descricao={`${ROTULO_AREA[f.area]} · ${competenciaExtenso(f.competencia)} · ${f.quantidadeItens} atendimento(s)`}
        acoes={
          <>
            <a href={`/api/fechamentos/${f.id}/excel`} className="botao">Baixar Excel</a>
            <a href={`/api/fechamentos/${f.id}/pdf`} className="botao-sec">Baixar PDF</a>
          </>
        }
      />

      {reaberto && (
        <p className="mb-4 rounded-md bg-gray-100 p-3 text-sm text-gray-600">
          Este fechamento foi reaberto e não vale mais para cobrança. Gere um novo em <Link className="link" href={`/fechamentos/novo?mes=${f.competencia}&empresa=${f.empresaId}&area=${f.area}`}>Novo fechamento</Link>.
        </p>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="cartao lg:col-span-2">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-3xl font-semibold">{moeda(f.total)}</p>
          <ol className="mt-5 grid gap-2 sm:grid-cols-5">
            {ETAPAS.map((e, i) => {
              const feito = !reaberto && i <= indice;
              const valor = f[e.data];
              const data = valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;
              return (
                <li key={e.status} className={`rounded-md border p-2 text-xs ${feito ? "border-teal-600 bg-teal-50" : "border-gray-200 text-gray-400"}`}>
                  <p className="font-semibold">{e.rotulo}</p>
                  <p>{data ? dataBR(data) : "—"}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Status: <Selo tipo={f.status}>{ROTULO_STATUS[f.status]}</Selo> {emAtraso(f) && <Selo tipo="em_atraso">Em atraso</Selo>}</span>
            {f.dataVencimento && <span>Vencimento: <strong>{dataBR(f.dataVencimento)}</strong></span>}
            {f.numeroNf && <span>NF: <strong>{f.numeroNf}</strong></span>}
            {f.valorPago != null && <span>Valor pago: <strong>{moeda(f.valorPago)}</strong></span>}
          </div>
          {f.observacoes && <p className="mt-3 text-sm text-gray-600">Obs.: {f.observacoes}</p>}
        </div>

        {proxima && (
          <ActionForm action={atualizarStatus} className="cartao" botao={`Marcar como "${proxima.rotulo}"`}>
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="etapa" value={proxima.status} />
            <h2 className="mb-3 font-semibold">Próxima etapa</h2>
            <div className="space-y-3">
              <Campo rotulo="Data">
                <input type="date" name="data" className="campo" defaultValue={hoje} />
              </Campo>
              {(proxima.status === "enviado" || proxima.status === "nf_emitida") && (
                <Campo rotulo="Vencimento (vazio = prazo da empresa)">
                  <input type="date" name="dataVencimento" className="campo" defaultValue={f.dataVencimento ?? ""} />
                </Campo>
              )}
              {proxima.status === "nf_emitida" && (
                <Campo rotulo="Número da NF">
                  <input name="numeroNf" className="campo" required />
                </Campo>
              )}
              {proxima.status === "pago" && (
                <Campo rotulo="Valor recebido (R$)">
                  <input name="valorPago" className="campo" inputMode="decimal" defaultValue={f.total.toFixed(2).replace(".", ",")} />
                </Campo>
              )}
              <Campo rotulo="Observações">
                <input name="observacoes" className="campo" />
              </Campo>
            </div>
          </ActionForm>
        )}
      </div>

      <div className="cartao mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Resumo por paciente</h2>
        <table className="tabela">
          <thead><tr><th>Paciente</th><th className="text-right">Atendimentos</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {relatorio.porPaciente.map((p) => (
              <tr key={p.paciente}><td>{p.paciente}</td><td className="text-right">{p.quantidade}</td><td className="text-right">{moeda(p.total)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {usuario.perfil === "admin" && !reaberto && f.status !== "pago" && (
        <ActionForm
          action={reabrir}
          className="cartao max-w-xl"
          botao="Reabrir fechamento"
          botaoClasse="botao-perigo"
          confirmar="Reabrir? Os lançamentos voltam a ficar editáveis e este fechamento deixa de valer."
        >
          <input type="hidden" name="id" value={f.id} />
          <h2 className="mb-1 font-semibold">Reabrir</h2>
          <p className="mb-3 text-sm text-gray-500">Use para corrigir lançamentos ou incluir atendimentos esquecidos. Depois gere um novo fechamento.</p>
          <Campo rotulo="Motivo">
            <input name="motivo" className="campo" required />
          </Campo>
        </ActionForm>
      )}
    </>
  );
}
