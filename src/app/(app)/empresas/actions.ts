"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zTexto, type EstadoAcao } from "@/lib/form";

const Empresa = z.object({
  id: z.coerce.number().int().optional(),
  nome: z.string().min(2, "informe o nome"),
  cnpj: zTexto,
  contato: zTexto,
  email: zTexto,
  telefone: zTexto,
  prazoPagamentoDias: z.coerce.number().int().min(0).max(365).default(30),
  ativo: z.string().optional(),
});

export async function salvarEmpresa(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Empresa);
  if (!dados) return { erro };

  const { id, ativo, ...valores } = dados;
  const registro = {
    nome: valores.nome,
    cnpj: valores.cnpj ?? null,
    contato: valores.contato ?? null,
    email: valores.email ?? null,
    telefone: valores.telefone ?? null,
    prazoPagamentoDias: valores.prazoPagamentoDias,
    ativo: id ? ativo === "on" : true,
  };
  const db = await getDb();
  if (id) {
    const [antes] = await db.select().from(schema.empresas).where(eq(schema.empresas.id, id));
    await db.update(schema.empresas).set(registro).where(eq(schema.empresas.id, id));
    await auditar(db, usuario.uid, "editar", "empresa", id, { antes, depois: registro });
  } else {
    const [nova] = await db.insert(schema.empresas).values(registro).returning();
    await auditar(db, usuario.uid, "criar", "empresa", nova.id, registro);
  }
  revalidatePath("/empresas");
  redirect("/empresas");
}
