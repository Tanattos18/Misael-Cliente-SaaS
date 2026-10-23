import { fecharDb, getDb } from "../src/db";

// Aplica as migrações da pasta ./drizzle no banco configurado (DATABASE_URL ou PGlite).
async function main() {
  const db = await getDb();
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
  console.log("Migrações aplicadas.");
  await fecharDb();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
