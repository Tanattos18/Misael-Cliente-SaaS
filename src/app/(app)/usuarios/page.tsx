import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { alternarUsuario, criarUsuario } from "./actions";

export default async function UsuariosPage() {
  const admin = await exigirAdmin();
  const db = await getDb();
  const usuarios = await db.select().from(schema.usuarios).orderBy(asc(schema.usuarios.nome));

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Administrador: acesso total. Operador: cadastros, lançamentos e fechamentos (não reabre fechamentos)." />
      <ActionForm action={criarUsuario} className="cartao mb-6" botao="Criar usuário">
        <div className="grid gap-4 sm:grid-cols-4">
          <Campo rotulo="Nome"><input name="nome" className="campo" required /></Campo>
          <Campo rotulo="E-mail"><input name="email" type="email" className="campo" required /></Campo>
          <Campo rotulo="Senha provisória (8+, letras e números)"><input name="senha" type="password" minLength={8} className="campo" required autoComplete="new-password" /></Campo>
          <Campo rotulo="Perfil">
            <select name="perfil" className="campo">
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
        </div>
      </ActionForm>
      <div className="cartao overflow-x-auto p-0">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.perfil === "admin" ? "Administrador" : "Operador"}</td>
                <td>{u.ativo ? <Selo tipo="realizado">Ativo</Selo> : <Selo tipo="cancelado">Inativo</Selo>}</td>
                <td className="text-right">
                  {u.id !== admin.uid && (
                    <form action={alternarUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="ativo" value={String(!u.ativo)} />
                      <button className="text-xs text-teal-700 hover:underline">{u.ativo ? "Desativar" : "Ativar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
