"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { encerrarSessao, iniciarSessao } from "@/lib/auth";
import { lerForm, type EstadoAcao } from "@/lib/form";

const Login = z.object({ email: z.email("e-mail inválido"), senha: z.string().min(1) });

export async function entrar(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { dados } = lerForm(formData, Login);
  if (!dados) return { erro: "Informe e-mail e senha." };

  const db = await getDb();
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, dados.email.toLowerCase()));
  const valido = u?.ativo && (await bcrypt.compare(dados.senha, u.senhaHash));
  if (!u || !valido) return { erro: "E-mail ou senha incorretos." };

  await iniciarSessao({ uid: u.id, nome: u.nome, perfil: u.perfil });
  await auditar(db, u.id, "login", "usuario", u.id);
  redirect("/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
