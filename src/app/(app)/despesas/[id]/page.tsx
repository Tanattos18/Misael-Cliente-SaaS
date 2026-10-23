import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { hojeISO } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { cancelarDespesa } from "../actions";
import { DespesaForm } from "../despesa-form";

export default async function DespesaPage({ params }: PageProps<"/despesas/[id]">) {
  await exigirUsuario();
  const db = await getDb();
  const [d] = await db.select().from(schema.despesas).where(eq(schema.despesas.id, Number((await params).id)));
  if (!d) notFound();
  const veiculos = await db
    .select({ id: schema.veiculos.id, descricao: schema.veiculos.descricao, modal: schema.veiculos.modal })
    .from(schema.veiculos)
    .orderBy(asc(schema.veiculos.descricao));
  const cancelada = d.status === "cancelada";

  return (
    <>
      <Cabecalho titulo={`Despesa nº ${d.id}`} acoes={<Link href="/despesas" className="botao-sec">Voltar</Link>} />
      {cancelada && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <Selo tipo="cancelado">Cancelada</Selo> Motivo: {d.motivoCancelamento}
        </p>
      )}
      <DespesaForm veiculos={veiculos} hoje={hojeISO()} inicial={d} bloqueado={cancelada} />
      {!cancelada && (
        <ActionForm
          action={cancelarDespesa}
          className="cartao mt-6 max-w-4xl"
          botao="Cancelar despesa"
          botaoClasse="botao-perigo"
          confirmar="Cancelar esta despesa? Ela sai dos relatórios, mas fica no histórico."
        >
          <input type="hidden" name="id" value={d.id} />
          <Campo rotulo="Motivo do cancelamento">
            <input name="motivo" className="campo" required />
          </Campo>
        </ActionForm>
      )}
    </>
  );
}
