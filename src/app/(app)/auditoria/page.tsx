import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { Cabecalho } from "@/components/ui";

export default async function AuditoriaPage() {
  await exigirAdmin();
  const db = await getDb();
  const registros = await db
    .select({ a: schema.auditoria, usuario: schema.usuarios.nome })
    .from(schema.auditoria)
    .leftJoin(schema.usuarios, eq(schema.usuarios.id, schema.auditoria.usuarioId))
    .orderBy(desc(schema.auditoria.id))
    .limit(300);

  return (
    <>
      <Cabecalho titulo="Auditoria" descricao="Últimas 300 ações registradas (quem, o quê e quando)." />
      <div className="cartao overflow-x-auto p-0">
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Detalhes</th></tr></thead>
          <tbody>
            {registros.map(({ a, usuario }) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{a.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td>{usuario ?? "—"}</td>
                <td>{a.acao}</td>
                <td>{a.entidade}{a.entidadeId ? ` #${a.entidadeId}` : ""}</td>
                <td className="max-w-md truncate font-mono text-xs text-gray-500" title={a.dados ? JSON.stringify(a.dados) : ""}>
                  {a.dados ? JSON.stringify(a.dados) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
