import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { alternarRegiao, criarRegiao } from "../tarifas/actions";

export default async function RegioesPage() {
  await exigirUsuario();
  const db = await getDb();
  const regioes = await db.select().from(schema.regioes).orderBy(asc(schema.regioes.nome));

  return (
    <>
      <Cabecalho titulo="Regiões / cidades" descricao="Usadas para definir a tarifa das corridas (cadastre os valores em Tarifas)." />
      <ActionForm action={criarRegiao} className="cartao mb-6 max-w-lg" botao="Adicionar">
        <Campo rotulo="Nome da cidade ou região">
          <input name="nome" className="campo" required />
        </Campo>
      </ActionForm>
      <div className="cartao max-w-lg p-0">
        <table className="tabela">
          <tbody>
            {regioes.map((r) => (
              <tr key={r.id}>
                <td>{r.nome}</td>
                <td>{r.ativo ? <Selo tipo="realizado">Ativa</Selo> : <Selo tipo="cancelado">Inativa</Selo>}</td>
                <td className="text-right">
                  <form action={alternarRegiao}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="ativo" value={String(!r.ativo)} />
                    <button className="text-xs text-teal-700 hover:underline">{r.ativo ? "Desativar" : "Ativar"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
