import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { competenciaAtual, competenciaExtenso, dataBR, moeda } from "@/lib/formato";
import { tarifaPara } from "@/lib/lancamentos";
import { carregarPlano, conferenciaDoMes } from "@/lib/planos";
import { ActionForm } from "@/components/action-form";
import { Cabecalho } from "@/components/ui";
import { confirmarPendentes } from "../../actions";
import { ConferenciaForm } from "./conferencia-form";

export default async function ConferenciaPage({ params, searchParams }: PageProps<"/tratamentos/[id]/conferencia">) {
  await exigirUsuario();
  const id = Number((await params).id);
  const sp = await searchParams;
  const competencia = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : competenciaAtual();
  const db = await getDb();
  const plano = await carregarPlano(db, id);
  if (!plano) notFound();

  const dias = await conferenciaDoMes(db, plano, competencia);
  const valor = plano.valorUnitario ?? (await tarifaPara(db, plano.pacienteId, plano.tipo, null))?.valor ?? null;
  const previstas = dias.reduce((s, d) => s + d.previstas.length, 0);
  const realizadas = dias.reduce((s, d) => s + (d.realizadas ?? 0), 0);
  const pendentes = dias.filter((d) => d.realizadas === null && !d.futuro && d.previstas.length > 0).length;

  return (
    <>
      <Cabecalho
        titulo={`Conferência — ${plano.paciente}`}
        descricao={`${plano.tipo === "medicacao" ? "Medicação" : "Curativo"} · ${plano.empresa} · ${competenciaExtenso(competencia)}`}
        acoes={
          <>
            <form className="flex gap-2">
              <input type="month" name="mes" defaultValue={competencia} className="campo" />
              <button className="botao-sec">Ver</button>
            </form>
            <Link href={`/tratamentos/${plano.id}`} className="botao-sec">Editar tratamento</Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="cartao"><p className="rotulo">Previstos no mês</p><p className="text-2xl font-semibold">{previstas}</p></div>
        <div className="cartao"><p className="rotulo">Realizados (conferidos)</p><p className="text-2xl font-semibold">{realizadas}</p></div>
        <div className="cartao"><p className="rotulo">Dias pendentes até hoje</p><p className={`text-2xl font-semibold ${pendentes ? "text-amber-700" : ""}`}>{pendentes}</p></div>
        <div className="cartao"><p className="rotulo">A cobrar (realizados)</p><p className="text-2xl font-semibold">{valor != null ? moeda(realizadas * valor) : "sem tarifa"}</p></div>
      </div>

      {pendentes > 0 && (
        <ActionForm
          action={confirmarPendentes}
          className="cartao mb-6"
          botao="Confirmar todos os pendentes como previsto"
          confirmar="Marcar todos os dias pendentes (mês atual e anterior) como realizados conforme o previsto?"
        >
          <input type="hidden" name="planoId" value={plano.id} />
          <p className="text-sm text-gray-600">
            Atalho para quando tudo foi feito conforme a prescrição. Dias com alguma falta podem ser ajustados na tabela abaixo.
          </p>
        </ActionForm>
      )}

      {dias.length === 0 ? (
        <p className="cartao text-sm text-gray-500">Nenhum atendimento previsto neste mês.</p>
      ) : (
        <ConferenciaForm
          planoId={plano.id}
          dias={dias.map((d) => ({
            data: d.data,
            rotuloData: dataBR(d.data),
            horarios: d.previstas.map((p) => (plano.itens.length > 1 ? `${p.hora} ${p.item}` : p.hora)),
            realizadas: d.realizadas,
            cancelado: d.cancelado,
            bloqueado: d.bloqueado,
            futuro: d.futuro,
          }))}
        />
      )}
    </>
  );
}
