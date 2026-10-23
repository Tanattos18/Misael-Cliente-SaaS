import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { COOKIE_SESSAO, DURACAO_SESSAO_HORAS, assinarSessao, lerSessao, type Sessao } from "./sessao";

/**
 * Lê a sessão e confirma no banco que o usuário continua ativo.
 * Toda página e Server Action protegida passa por aqui (não confiar só no proxy).
 */
export async function exigirUsuario(): Promise<Sessao> {
  const sessao = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  if (!sessao) redirect("/login");
  const db = await getDb();
  const [u] = await db
    .select({ ativo: schema.usuarios.ativo, perfil: schema.usuarios.perfil, nome: schema.usuarios.nome })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, sessao.uid));
  if (!u?.ativo) redirect("/login");
  return { uid: sessao.uid, nome: u.nome, perfil: u.perfil };
}

export async function exigirAdmin(): Promise<Sessao> {
  const s = await exigirUsuario();
  if (s.perfil !== "admin") redirect("/");
  return s;
}

export async function iniciarSessao(s: Sessao) {
  (await cookies()).set(COOKIE_SESSAO, await assinarSessao(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_HORAS * 3600,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE_SESSAO);
}
