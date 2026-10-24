"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin, exigirLogin } from "@/lib/auth";
import { CHAVE_ACRESCIMO_TERCEIRIZADO } from "@/lib/dominio";
import { lerForm, zSenha, zValor, type EstadoAcao } from "@/lib/form";
import { CHAVE_FIM_INCLUSIVO } from "@/lib/planos";

const NovoUsuario = z.object({
  nome: z.string().min(2, "informe o nome"),
  email: z.email("e-mail inválido"),
  senha: zSenha,
  perfil: z.enum(["admin", "operador"]),
});

export async function criarUsuario(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, NovoUsuario);
  if (!dados) return { erro };
  const db = await getDb();
  const [novo] = await db
    .insert(schema.usuarios)
    .values({ nome: dados.nome, email: dados.email.toLowerCase(), perfil: dados.perfil, senhaHash: await bcrypt.hash(dados.senha, 10), trocarSenha: true })
    .onConflictDoNothing()
    .returning();
  if (!novo) return { erro: "Já existe um usuário com esse e-mail." };
  await auditar(db, admin.uid, "criar", "usuario", novo.id, { nome: dados.nome, email: dados.email, perfil: dados.perfil });
  revalidatePath("/usuarios");
  return { ok: "Usuário criado. Ele vai trocar a senha no primeiro acesso." };
}

export async function alternarUsuario(formData: FormData) {
  const admin = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (id === admin.uid) return;
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.usuarios).set({ ativo }).where(eq(schema.usuarios.id, id));
  await auditar(db, admin.uid, ativo ? "ativar" : "desativar", "usuario", id);
  revalidatePath("/usuarios");
}

const TrocaSenha = z.object({ atual: z.string().min(1), nova: zSenha });

export async function trocarSenha(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  // exigirLogin: precisa funcionar também com a senha provisória pendente de troca.
  const usuario = await exigirLogin();
  const { dados, erro } = lerForm(formData, TrocaSenha);
  if (!dados) return { erro };
  const db = await getDb();
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, usuario.uid));
  if (!u || !(await bcrypt.compare(dados.atual, u.senhaHash))) return { erro: "Senha atual incorreta." };
  if (dados.atual === dados.nova) return { erro: "A nova senha precisa ser diferente da atual." };
  await db.update(schema.usuarios).set({ senhaHash: await bcrypt.hash(dados.nova, 10), trocarSenha: false }).where(eq(schema.usuarios.id, u.id));
  await auditar(db, u.id, "trocar_senha", "usuario", u.id);
  return { ok: "Senha alterada." };
}

const Config = z.object({ acrescimo: zValor.pipe(z.number().max(500)), fimInclusivo: z.string().optional() });

export async function salvarConfiguracoes(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Config);
  if (!dados) return { erro };
  const db = await getDb();
  await db
    .insert(schema.configuracoes)
    .values({ chave: CHAVE_ACRESCIMO_TERCEIRIZADO, valor: String(dados.acrescimo) })
    .onConflictDoUpdate({ target: schema.configuracoes.chave, set: { valor: String(dados.acrescimo) } });
  const inclusivo = String(dados.fimInclusivo === "on");
  await db
    .insert(schema.configuracoes)
    .values({ chave: CHAVE_FIM_INCLUSIVO, valor: inclusivo })
    .onConflictDoUpdate({ target: schema.configuracoes.chave, set: { valor: inclusivo } });
  await auditar(db, admin.uid, "editar", "configuracao", null, dados);
  revalidatePath("/configuracoes");
  return { ok: "Configurações salvas." };
}
