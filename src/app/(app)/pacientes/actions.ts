"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { lerForm, zId, zIdOpcional, zTexto, type EstadoAcao } from "@/lib/form";

const Paciente = z.object({
  id: zIdOpcional,
  nome: z.string().min(2, "informe o nome"),
  empresaId: zId,
  regiaoId: zIdOpcional,
  endereco: zTexto,
  observacoes: zTexto,
  ativo: z.string().optional(),
});

export async function salvarPaciente(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Paciente);
  if (!dados) return { erro };

  const registro = {
    nome: dados.nome,
    empresaId: dados.empresaId,
    regiaoId: dados.regiaoId ?? null,
    endereco: dados.endereco ?? null,
    observacoes: dados.observacoes ?? null,
    ativo: dados.id ? dados.ativo === "on" : true,
  };
  const db = await getDb();
  if (dados.id) {
    const [antes] = await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, dados.id));
    await db.update(schema.pacientes).set(registro).where(eq(schema.pacientes.id, dados.id));
    await auditar(db, usuario.uid, "editar", "paciente", dados.id, { antes, depois: registro });
  } else {
    const [novo] = await db.insert(schema.pacientes).values(registro).returning();
    await auditar(db, usuario.uid, "criar", "paciente", novo.id, registro);
  }
  revalidatePath("/pacientes");
  redirect("/pacientes");
}
