import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { fecharDb, getDb, schema } from "../src/db";

/**
 * Redefine a senha de um usuário e o reativa.
 * Uso: npm run db:senha -- <email> <nova-senha>
 */
async function main() {
  const [email, senha] = process.argv.slice(2);
  if (!email || !senha) {
    console.error("Uso: npm run db:senha -- <email> <nova-senha>");
    process.exit(1);
  }
  const db = await getDb();
  const atualizados = await db
    .update(schema.usuarios)
    .set({ senhaHash: await bcrypt.hash(senha, 10), ativo: true })
    .where(eq(schema.usuarios.email, email.toLowerCase()))
    .returning({ id: schema.usuarios.id });
  if (atualizados.length === 0) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }
  console.log(`Senha redefinida para ${email}.`);
  await fecharDb();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
