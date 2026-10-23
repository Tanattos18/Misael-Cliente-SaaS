import { jwtVerify, SignJWT } from "jose";

export const COOKIE_SESSAO = "curalog_sessao";
export const DURACAO_SESSAO_HORAS = 12;

export type Sessao = {
  uid: number;
  nome: string;
  perfil: "admin" | "operador";
};

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET não configurado.");
    return new TextEncoder().encode("dev-somente-local-troque-em-producao-0000");
  }
  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(s: Sessao): Promise<string> {
  return new SignJWT({ nome: s.nome, perfil: s.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_HORAS}h`)
    .sign(chave());
}

export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return {
      uid: Number(payload.sub),
      nome: String(payload.nome),
      perfil: payload.perfil === "admin" ? "admin" : "operador",
    };
  } catch {
    return null;
  }
}
