import { asc, eq } from "drizzle-orm";
import { schema, type DB } from "@/db";

export async function opcoesPacientes(db: DB, incluirId?: number) {
  const linhas = await db
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
    .orderBy(asc(schema.pacientes.nome));
  return linhas
    .filter((p) => p.ativo || p.id === incluirId)
    .map(({ id, nome, empresa, regiao }) => ({ id, nome, empresa, regiao }));
}

export async function opcoesEmpresas(db: DB) {
  return db
    .select({ id: schema.empresas.id, nome: schema.empresas.nome })
    .from(schema.empresas)
    .orderBy(asc(schema.empresas.nome));
}
