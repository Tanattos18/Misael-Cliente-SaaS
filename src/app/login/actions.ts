"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { encerrarSessao, iniciarSessao } from "@/lib/auth";
import { lerForm, type EstadoAcao } from "@/lib/form";
import { JANELA_MINUTOS, loginBloqueado, registrarTentativa } from "@/lib/login";

const Login = z.object({ email: z.email("e-mail inválido"), senha: z.string().min(1) });

// Hash qualquer, para o tempo de resposta não revelar se o e-mail existe.
const HASH_FICTICIO = "$2b$10$vV8.JfC6eaxZ488kgtakM.VPHgg2qXtvJ40dL/Zckec0tKROkxfTe";

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
}

export async function entrar(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { dados } = lerForm(formData, Login);
  if (!dados) return { erro: "Informe e-mail e senha." };

  const email = dados.email.toLowerCase();
  const ip = await ipDaRequisicao();
  const db = await getDb();
  if (await loginBloqueado(db, email, ip)) {
    return { erro: `Muitas tentativas sem sucesso. Aguarde ${JANELA_MINUTOS} minutos e tente de novo.` };
  }

  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, email));
  const senhaOk = await bcrypt.compare(dados.senha, u?.senhaHash ?? HASH_FICTICIO);
  if (!u || !u.ativo || !senhaOk) {
    await registrarTentativa(db, email, ip, false);
    return { erro: "E-mail ou senha incorretos." };
  }

  await registrarTentativa(db, email, ip, true);
  await iniciarSessao({ uid: u.id, nome: u.nome, perfil: u.perfil });
  await auditar(db, u.id, "login", "usuario", u.id, { ip });
  redirect(u.trocarSenha ? "/trocar-senha" : "/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
