import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { Cabecalho, Selo, Vazio } from "@/components/ui";

export default async function EmpresasPage() {
  await exigirUsuario();
  const db = await getDb();
  const empresas = await db.select().from(schema.empresas).orderBy(asc(schema.empresas.nome));

  return (
    <>
      <Cabecalho
        titulo="Empresas contratantes"
        acoes={<Link href="/empresas/novo" className="botao">Nova empresa</Link>}
      />
      <div className="cartao overflow-x-auto p-0">
        {empresas.length === 0 ? (
          <Vazio>Nenhuma empresa cadastrada.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Prazo pgto.</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/empresas/${e.id}`} className="link">{e.nome}</Link></td>
                  <td>{e.cnpj}</td>
                  <td>{[e.contato, e.email, e.telefone].filter(Boolean).join(" · ")}</td>
                  <td>{e.prazoPagamentoDias} dias</td>
                  <td>{e.ativo ? <Selo tipo="realizado">Ativa</Selo> : <Selo tipo="cancelado">Inativa</Selo>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
