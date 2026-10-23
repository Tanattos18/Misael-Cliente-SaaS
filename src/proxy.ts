import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

// Primeira barreira: sem sessão válida, vai para o login.
// A checagem definitiva (usuário ativo, perfil) acontece em exigirUsuario().
export async function proxy(request: NextRequest) {
  const sessao = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);
  if (!sessao) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
