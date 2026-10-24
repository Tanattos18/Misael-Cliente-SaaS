import { and, count, eq, gte, lt } from "drizzle-orm";
import { schema, type DB } from "@/db";

export const JANELA_MINUTOS = 15;
export const MAX_FALHAS_EMAIL = 5;
export const MAX_FALHAS_IP = 20;

/**
 * true quando o e-mail (5 erros) ou o IP (20 erros) passou do limite de falhas
 * nos últimos 15 minutos. Um login certo não zera o contador de propósito:
 * quem errou 5 vezes espera a janela passar.
 */
export async function loginBloqueado(db: DB, email: string, ip: string, agora = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - JANELA_MINUTOS * 60_000);
  const T = schema.tentativasLogin;
  const contar = async (filtro: ReturnType<typeof eq>) =>
    (await db.select({ n: count() }).from(T).where(and(filtro, eq(T.sucesso, false), gte(T.criadoEm, desde))))[0].n;
  const [porEmail, porIp] = await Promise.all([contar(eq(T.email, email)), contar(eq(T.ip, ip))]);
  return porEmail >= MAX_FALHAS_EMAIL || porIp >= MAX_FALHAS_IP;
}

export async function registrarTentativa(db: DB, email: string, ip: string, sucesso: boolean, agora = new Date()) {
  await db.insert(schema.tentativasLogin).values({ email, ip, sucesso, criadoEm: agora });
  if (sucesso) {
    // Mantém só os últimos 90 dias.
    const limite = new Date(agora.getTime() - 90 * 24 * 3600_000);
    await db.delete(schema.tentativasLogin).where(lt(schema.tentativasLogin.criadoEm, limite));
  }
}
