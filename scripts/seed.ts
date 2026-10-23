import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb, schema } from "../src/db";
import { ACRESCIMO_TERCEIRIZADO_PADRAO, CHAVE_ACRESCIMO_TERCEIRIZADO } from "../src/lib/dominio";

/**
 * Carga inicial: usuário administrador, tarifas padrão informadas pelo cliente
 * e regiões da logística. Pode ser executado mais de uma vez sem duplicar dados.
 */
async function main() {
  const db = await getDb();

  const usuarios = await db.select({ id: schema.usuarios.id }).from(schema.usuarios).limit(1);
  if (usuarios.length === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@curalog.local";
    const senha = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    await db.insert(schema.usuarios).values({
      nome: "Administrador",
      email,
      senhaHash: await bcrypt.hash(senha, 10),
      perfil: "admin",
    });
    console.log(`Administrador criado: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Senha gerada (troque após o primeiro acesso): ${senha}`);
  }

  await db
    .insert(schema.configuracoes)
    .values({ chave: CHAVE_ACRESCIMO_TERCEIRIZADO, valor: String(ACRESCIMO_TERCEIRIZADO_PADRAO) })
    .onConflictDoNothing();

  const existentes = await db.select({ id: schema.tarifas.id }).from(schema.tarifas).limit(1);
  if (existentes.length === 0) {
    await db.insert(schema.tarifas).values([
      { tipo: "medicacao", valor: 55 },
      { tipo: "curativo", valor: 45 },
      { tipo: "coleta", valor: 55 },
    ]);

    // Valores de moto citados pelo cliente. Carro: a confirmar.
    const regioes: [string, number][] = [
      ["Goiânia", 25],
      ["Aparecida de Goiânia", 30],
      ["Goianira", 40],
      ["Bela Vista de Goiás", 60],
    ];
    for (const [nome, valorMoto] of regioes) {
      const [r] = await db.insert(schema.regioes).values({ nome }).onConflictDoNothing().returning();
      if (r) await db.insert(schema.tarifas).values({ tipo: "corrida", modal: "moto", regiaoId: r.id, valor: valorMoto });
    }
  }

  console.log("Carga inicial concluída.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
