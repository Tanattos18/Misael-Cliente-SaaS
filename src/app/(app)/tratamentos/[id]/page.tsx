import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesPacientes } from "@/lib/consultas";
import { hojeISO } from "@/lib/formato";
import { carregarPlano } from "@/lib/planos";
import { Cabecalho } from "@/components/ui";
import { PlanoForm } from "../plano-form";

export default async function TratamentoPage({ params }: PageProps<"/tratamentos/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const db = await getDb();
  const plano = id === "novo" ? null : await carregarPlano(db, Number(id));
  if (id !== "novo" && !plano) notFound();
  const pacientes = await opcoesPacientes(db, plano?.pacienteId);

  return (
    <>
      <Cabecalho
        titulo={plano ? `Tratamento — ${plano.paciente}` : "Novo tratamento"}
        descricao="Alterações valem para os previstos; dias já conferidos não mudam."
        acoes={plano && <Link href={`/tratamentos/${plano.id}/conferencia`} className="botao-sec">Conferência</Link>}
      />
      <PlanoForm
        pacientes={pacientes}
        hoje={hojeISO()}
        inicial={plano ?? undefined}
      />
    </>
  );
}
