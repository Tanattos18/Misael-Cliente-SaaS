import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { salvarPaciente } from "../actions";

export default async function PacientePage({ params }: PageProps<"/pacientes/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const novo = id === "novo";
  const db = await getDb();

  let paciente: typeof schema.pacientes.$inferSelect | undefined;
  if (!novo) {
    [paciente] = await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, Number(id)));
    if (!paciente) notFound();
  }
  const [empresas, regioes] = await Promise.all([
    db.select().from(schema.empresas).where(eq(schema.empresas.ativo, true)).orderBy(asc(schema.empresas.nome)),
    db.select().from(schema.regioes).where(eq(schema.regioes.ativo, true)).orderBy(asc(schema.regioes.nome)),
  ]);

  return (
    <>
      <Cabecalho
        titulo={novo ? "Novo paciente" : paciente!.nome}
        acoes={paciente && <Link href={`/tarifas?paciente=${paciente.id}`} className="botao-sec">Tarifas específicas</Link>}
      />
      {empresas.length === 0 ? (
        <p className="cartao text-sm">Cadastre primeiro uma <Link href="/empresas/novo" className="link">empresa contratante</Link>.</p>
      ) : (
        <ActionForm action={salvarPaciente} className="cartao max-w-3xl">
          {paciente && <input type="hidden" name="id" value={paciente.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome do paciente" className="sm:col-span-2">
              <input name="nome" className="campo" defaultValue={paciente?.nome} required />
            </Campo>
            <Campo rotulo="Empresa contratante">
              <select name="empresaId" className="campo" defaultValue={paciente?.empresaId} required>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Região (define a tarifa das corridas)">
              <select name="regiaoId" className="campo" defaultValue={paciente?.regiaoId ?? ""}>
                <option value="">—</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Endereço" className="sm:col-span-2">
              <input name="endereco" className="campo" defaultValue={paciente?.endereco ?? ""} />
            </Campo>
            <Campo rotulo="Observações" className="sm:col-span-2">
              <textarea name="observacoes" rows={3} className="campo" defaultValue={paciente?.observacoes ?? ""} />
            </Campo>
            {paciente && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" defaultChecked={paciente.ativo} /> Ativo
              </label>
            )}
          </div>
        </ActionForm>
      )}
    </>
  );
}
