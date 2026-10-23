import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { salvarEmpresa } from "../actions";

export default async function EmpresaPage({ params }: PageProps<"/empresas/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const novo = id === "novo";
  let empresa: typeof schema.empresas.$inferSelect | undefined;
  if (!novo) {
    const db = await getDb();
    [empresa] = await db.select().from(schema.empresas).where(eq(schema.empresas.id, Number(id)));
    if (!empresa) notFound();
  }

  return (
    <>
      <Cabecalho titulo={novo ? "Nova empresa" : empresa!.nome} />
      <ActionForm action={salvarEmpresa} className="cartao max-w-3xl">
        {empresa && <input type="hidden" name="id" value={empresa.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome / razão social" className="sm:col-span-2">
            <input name="nome" className="campo" defaultValue={empresa?.nome} required />
          </Campo>
          <Campo rotulo="CNPJ">
            <input name="cnpj" className="campo" defaultValue={empresa?.cnpj ?? ""} />
          </Campo>
          <Campo rotulo="Prazo de pagamento após envio (dias)">
            <input name="prazoPagamentoDias" type="number" min={0} className="campo" defaultValue={empresa?.prazoPagamentoDias ?? 30} />
          </Campo>
          <Campo rotulo="Contato">
            <input name="contato" className="campo" defaultValue={empresa?.contato ?? ""} />
          </Campo>
          <Campo rotulo="E-mail">
            <input name="email" type="email" className="campo" defaultValue={empresa?.email ?? ""} />
          </Campo>
          <Campo rotulo="Telefone">
            <input name="telefone" className="campo" defaultValue={empresa?.telefone ?? ""} />
          </Campo>
          {empresa && (
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="ativo" defaultChecked={empresa.ativo} /> Ativa
            </label>
          )}
        </div>
      </ActionForm>
    </>
  );
}
