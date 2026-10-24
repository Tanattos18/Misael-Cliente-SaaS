import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { COOKIE_SESSAO, DURACAO_SESSAO_HORAS, assinarSessao, lerSessao, type Sessao } from "./sessao";

type UsuarioSessao = Sessao & { trocarSenha: boolean };

/** Sessão válida + usuário ainda ativo no banco; null em qualquer outro caso. */
async function usuarioDaSessao(): Promise<UsuarioSessao | null> {
  const sessao = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;
  const db = await getDb();
  const [u] = await db
    .select({ ativo: schema.usuarios.ativo, perfil: schema.usuarios.perfil, nome: schema.usuarios.nome, trocarSenha: schema.usuarios.trocarSenha })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, sessao.uid));
  if (!u?.ativo) return null;
  return { uid: sessao.uid, nome: u.nome, perfil: u.perfil, trocarSenha: u.trocarSenha };
}

/**
 * Toda página e Server Action protegida passa por aqui (não confiar só no proxy):
 * sessão válida, usuário ativo e senha provisória já trocada.
 */
export async function exigirUsuario(): Promise<Sessao> {
  const u = await usuarioDaSessao();
  if (!u) redirect("/login");
  if (u.trocarSenha) redirect("/trocar-senha");
  return { uid: u.uid, nome: u.nome, perfil: u.perfil };
}

/** Para a tela de troca obrigatória de senha: exige login, mas aceita senha provisória. */
export async function exigirLogin(): Promise<UsuarioSessao> {
  const u = await usuarioDaSessao();
  if (!u) redirect("/login");
  return u;
}

/** Para rotas de API (downloads): mesmas regras de exigirUsuario, sem redirecionar. */
export async function usuarioAutorizado(): Promise<Sessao | null> {
  const u = await usuarioDaSessao();
  return u && !u.trocarSenha ? { uid: u.uid, nome: u.nome, perfil: u.perfil } : null;
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
