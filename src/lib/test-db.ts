import { getDb, type DB } from "@/db";

/**
 * Banco limpo, com as migrações reais, para um arquivo de teste.
 * Com TEST_PG_URL (ver scripts/testar-postgres.ts) usa um PostgreSQL de verdade,
 * criando um banco próprio por arquivo; sem ela, PGlite em memória.
 */
export async function bancoDeTeste(nome: string): Promise<DB> {
  const admin = process.env.TEST_PG_URL;
  if (admin) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(admin, { max: 1, onnotice: () => {} });
    await sql.unsafe(`drop database if exists "${nome}" with (force)`);
    await sql.unsafe(`create database "${nome}"`);
    await sql.end();
    const url = new URL(admin);
    url.pathname = `/${nome}`;
    process.env.DATABASE_URL = url.toString();
    const db = await getDb();
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
    return db;
  }

  process.env.PGLITE_DIR = "memory://";
  delete process.env.DATABASE_URL;
  const db = await getDb();
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle" });
  return db;
}
