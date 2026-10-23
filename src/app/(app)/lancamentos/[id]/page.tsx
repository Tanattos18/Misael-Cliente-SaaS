import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesPacientes } from "@/lib/consultas";
import { hojeISO } from "@/lib/formato";
import { acrescimoTerceirizado, lancamentoBloqueado } from "@/lib/lancamentos";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { cancelarLancamento } from "../actions";
import { LancamentoForm } from "../lancamento-form";

export default async function LancamentoPage({ params }: PageProps<"/lancamentos/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const db = await getDb();
  const [l] = await db.select().from(schema.lancamentos).where(eq(schema.lancamentos.id, Number(id)));
  if (!l) notFound();

  const [pacientes, acrescimo, bloqueado] = await Promise.all([
    opcoesPacientes(db, l.pacienteId),
    acrescimoTerceirizado(db),
    lancamentoBloqueado(db, l.fechamentoId),
  ]);
  const cancelado = l.status === "cancelado";

  return (
    <>
      <Cabecalho titulo={`Lançamento nº ${l.id}`} acoes={<Link href="/lancamentos" className="botao-sec">Voltar</Link>} />
      {bloqueado && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Este lançamento faz parte do <Link href={`/fechamentos/${l.fechamentoId}`} className="link">fechamento nº {l.fechamentoId}</Link>. Para alterar, reabra o fechamento.
        </p>
      )}
      {cancelado && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <Selo tipo="cancelado">Cancelado</Selo> Motivo: {l.motivoCancelamento}
        </p>
      )}
      <LancamentoForm
        area={l.area}
        pacientes={pacientes}
        hoje={hojeISO()}
        acrescimoPadrao={acrescimo}
        bloqueado={bloqueado || cancelado}
        inicial={{
          id: l.id,
          tipo: l.tipo,
          pacienteId: l.pacienteId,
          data: l.data,
          hora: l.hora,
          quantidade: l.quantidade,
          valorUnitario: l.valorUnitario,
          modal: l.modal,
          origem: l.origem,
          destino: l.destino,
          custoTerceiro: l.custoTerceiro,
          percentualAcrescimo: l.percentualAcrescimo,
          observacoes: l.observacoes,
        }}
      />
      {!bloqueado && !cancelado && (
        <ActionForm
          action={cancelarLancamento}
          className="cartao mt-6 max-w-4xl"
          botao="Cancelar lançamento"
          botaoClasse="botao-perigo"
          confirmar="Cancelar este lançamento? Ele deixa de ser cobrado, mas continua no histórico."
        >
          <input type="hidden" name="id" value={l.id} />
          <Campo rotulo="Motivo do cancelamento">
            <input name="motivo" className="campo" required />
          </Campo>
        </ActionForm>
      )}
    </>
  );
}
