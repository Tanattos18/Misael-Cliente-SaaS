import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __curalogDb: Promise<DB> | undefined;
  var __curalogFechar: (() => Promise<void>) | undefined;
}

/**
 * Produção: PostgreSQL via DATABASE_URL.
 * Desenvolvimento sem DATABASE_URL: PGlite (Postgres embutido) gravando em PGLITE_DIR.
 */
async function conectar(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, {
      max: Number(process.env.DB_POOL_MAX) || 5,
      // Poolers em modo transação (Supabase porta 6543, PgBouncer) não aceitam prepared statements.
      prepare: !/:6543\b|pgbouncer=true/.test(url),
    });
    globalThis.__curalogFechar = () => sql.end();
    return drizzlePostgres(sql, { schema });
  }
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_PGLITE !== "1") {
    // Sem isso, um deploy sem a variável gravaria dados num banco local que some a cada atualização.
    throw new Error("DATABASE_URL não configurada. Em produção o sistema precisa de um PostgreSQL.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { mkdirSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  // Fora da pasta do projeto por padrão, para não ser sincronizado pelo OneDrive/Dropbox.
  const dir = process.env.PGLITE_DIR ?? join(homedir(), ".curalog", "pglite");
  if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  globalThis.__curalogFechar = () => client.close();
  // A API de consulta é a mesma; o tipo de produção é usado em todo o código.
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalThis.__curalogDb ??= conectar();
  return globalThis.__curalogDb;
}

/** Fecha a conexão. Scripts devem chamar antes de sair: sem isso o Postgres pula a numeração dos IDs. */
export async function fecharDb() {
  await globalThis.__curalogFechar?.();
  globalThis.__curalogDb = undefined;
  globalThis.__curalogFechar = undefined;
}

export { schema };
