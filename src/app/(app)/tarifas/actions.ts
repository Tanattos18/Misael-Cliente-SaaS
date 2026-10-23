"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { TIPOS } from "@/lib/dominio";
import { lerForm, zIdOpcional, zValor, type EstadoAcao } from "@/lib/form";

const Tarifa = z.object({
  tipo: z.enum(TIPOS),
  modal: z.enum(["moto", "carro"]).optional(),
  regiaoId: zIdOpcional,
  empresaId: zIdOpcional,
  pacienteId: zIdOpcional,
  valor: zValor,
});

export async function criarTarifa(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Tarifa);
  if (!dados) return { erro };
  if (dados.tipo !== "corrida" && (dados.modal || dados.regiaoId)) {
    return { erro: "Modal e região só se aplicam a corridas." };
  }

  const registro = {
    tipo: dados.tipo,
    modal: dados.modal ?? null,
    regiaoId: dados.regiaoId ?? null,
    empresaId: dados.empresaId ?? null,
    pacienteId: dados.pacienteId ?? null,
    valor: dados.valor,
  };
  const db = await getDb();
  const [nova] = await db.insert(schema.tarifas).values(registro).returning();
  await auditar(db, usuario.uid, "criar", "tarifa", nova.id, registro);
  revalidatePath("/tarifas");
  return { ok: "Tarifa cadastrada." };
}

export async function desativarTarifa(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.update(schema.tarifas).set({ ativo: false }).where(eq(schema.tarifas.id, id));
  await auditar(db, usuario.uid, "desativar", "tarifa", id);
  revalidatePath("/tarifas");
}

const Regiao = z.object({ nome: z.string().min(2, "informe o nome") });

export async function criarRegiao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Regiao);
  if (!dados) return { erro };
  const db = await getDb();
  const [nova] = await db.insert(schema.regioes).values({ nome: dados.nome }).onConflictDoNothing().returning();
  if (!nova) return { erro: "Já existe uma região com esse nome." };
  await auditar(db, usuario.uid, "criar", "regiao", nova.id, dados);
  revalidatePath("/regioes");
  return { ok: `Região "${dados.nome}" cadastrada.` };
}

export async function alternarRegiao(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.regioes).set({ ativo }).where(eq(schema.regioes.id, id));
  await auditar(db, usuario.uid, ativo ? "ativar" : "desativar", "regiao", id);
  revalidatePath("/regioes");
}
