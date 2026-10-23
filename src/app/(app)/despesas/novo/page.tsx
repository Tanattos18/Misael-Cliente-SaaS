import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { hojeISO } from "@/lib/formato";
import { Cabecalho } from "@/components/ui";
import { DespesaForm } from "../despesa-form";

export default async function NovaDespesaPage() {
  await exigirUsuario();
  const db = await getDb();
  const veiculos = await db
    .select({ id: schema.veiculos.id, descricao: schema.veiculos.descricao, modal: schema.veiculos.modal, uso: schema.veiculos.uso })
    .from(schema.veiculos)
    .where(eq(schema.veiculos.ativo, true))
    .orderBy(asc(schema.veiculos.descricao));

  return (
    <>
      <Cabecalho
        titulo="Lançar despesa"
        descricao="O custo das transportadoras nas corridas terceirizadas já entra sozinho; use “Transportadores terceirizados” só para pagamentos fora das corridas."
      />
      <DespesaForm veiculos={veiculos} hoje={hojeISO()} />
    </>
  );
}
