import Link from "next/link";
import { and, asc, eq, ilike, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { Cabecalho, Selo, Vazio } from "@/components/ui";

export default async function PacientesPage({ searchParams }: PageProps<"/pacientes">) {
  await exigirUsuario();
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q : "";
  const empresaId = Number(sp.empresa) || undefined;

  const db = await getDb();
  const filtros: SQL[] = [];
  if (busca) filtros.push(ilike(schema.pacientes.nome, `%${busca}%`));
  if (empresaId) filtros.push(eq(schema.pacientes.empresaId, empresaId));

  const [pacientes, empresas] = await Promise.all([
    db
      .select({
        id: schema.pacientes.id,
        nome: schema.pacientes.nome,
        ativo: schema.pacientes.ativo,
        empresa: schema.empresas.nome,
        regiao: schema.regioes.nome,
      })
      .from(schema.pacientes)
      .innerJoin(schema.empresas, eq(schema.empresas.id, schema.pacientes.empresaId))
      .leftJoin(schema.regioes, eq(schema.regioes.id, schema.pacientes.regiaoId))
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(asc(schema.pacientes.nome)),
    db.select({ id: schema.empresas.id, nome: schema.empresas.nome }).from(schema.empresas).orderBy(asc(schema.empresas.nome)),
  ]);

  return (
    <>
      <Cabecalho titulo="Pacientes" acoes={<Link href="/pacientes/novo" className="botao">Novo paciente</Link>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={busca} placeholder="Buscar por nome" className="campo max-w-xs" />
        <select name="empresa" defaultValue={empresaId ?? ""} className="campo max-w-xs">
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <button className="botao-sec">Filtrar</button>
      </form>
      <div className="cartao overflow-x-auto p-0">
        {pacientes.length === 0 ? (
          <Vazio>Nenhum paciente encontrado.</Vazio>
        ) : (
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Empresa</th><th>Região</th><th>Situação</th></tr></thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/pacientes/${p.id}`} className="link">{p.nome}</Link></td>
                  <td>{p.empresa}</td>
                  <td>{p.regiao ?? "—"}</td>
                  <td>{p.ativo ? <Selo tipo="realizado">Ativo</Selo> : <Selo tipo="cancelado">Inativo</Selo>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
