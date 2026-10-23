"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { AREAS_DESPESA, CATEGORIAS_DESPESA, MODAIS } from "@/lib/dominio";
import { lerForm, zData, zId, zIdOpcional, zTexto, zValor, type EstadoAcao } from "@/lib/form";

const Despesa = z.object({
  id: zIdOpcional,
  data: zData,
  categoria: z.enum(CATEGORIAS_DESPESA),
  descricao: zTexto,
  valor: zValor.pipe(z.number().positive("informe o valor")),
  area: z.enum(AREAS_DESPESA),
  modal: z.enum(MODAIS).optional(),
  veiculoId: zIdOpcional,
  litros: zValor.optional(),
  km: z.coerce.number().int().min(0).optional(),
  continuar: z.string().optional(),
});

export async function salvarDespesa(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Despesa);
  if (!dados) return { erro };

  const db = await getDb();
  let { area, modal } = dados;
  if (dados.veiculoId) {
    const [v] = await db.select().from(schema.veiculos).where(eq(schema.veiculos.id, dados.veiculoId));
    if (!v) return { erro: "Veículo não encontrado." };
    // Custo de veículo é sempre da logística, no modal do veículo.
    area = "logistica";
    modal = v.modal;
  }
  if (area !== "logistica") modal = undefined;

  const registro = {
    data: dados.data,
    categoria: dados.categoria,
    descricao: dados.descricao ?? null,
    valor: dados.valor,
    area,
    modal: modal ?? null,
    veiculoId: dados.veiculoId ?? null,
    litros: dados.categoria === "combustivel" ? (dados.litros ?? null) : null,
    km: dados.km ?? null,
  };

  if (dados.id) {
    const [antes] = await db.select().from(schema.despesas).where(eq(schema.despesas.id, dados.id));
    if (!antes) return { erro: "Despesa não encontrada." };
    if (antes.status === "cancelada") return { erro: "Despesa cancelada não pode ser alterada." };
    await db.transaction(async (tx) => {
      await tx.update(schema.despesas).set(registro).where(eq(schema.despesas.id, antes.id));
      await auditar(tx, usuario.uid, "editar", "despesa", antes.id, { antes, depois: registro });
    });
    revalidatePath("/despesas");
    redirect("/despesas");
  }

  await db.transaction(async (tx) => {
    const [nova] = await tx.insert(schema.despesas).values({ ...registro, criadoPor: usuario.uid }).returning();
    await auditar(tx, usuario.uid, "criar", "despesa", nova.id, registro);
  });
  revalidatePath("/despesas");
  if (!dados.continuar) redirect("/despesas");
  return { ok: "Despesa lançada." };
}

const Cancelamento = z.object({ id: zId, motivo: z.string().min(3, "informe o motivo") });

export async function cancelarDespesa(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Cancelamento);
  if (!dados) return { erro };
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.despesas)
      .set({ status: "cancelada", motivoCancelamento: dados.motivo })
      .where(eq(schema.despesas.id, dados.id));
    await auditar(tx, usuario.uid, "cancelar", "despesa", dados.id, { motivo: dados.motivo });
  });
  revalidatePath("/despesas");
  redirect("/despesas");
}

const Veiculo = z.object({ descricao: z.string().min(2, "informe a descrição"), placa: zTexto, modal: z.enum(["moto", "carro"]) });

export async function criarVeiculo(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Veiculo);
  if (!dados) return { erro };
  const db = await getDb();
  const registro = { descricao: dados.descricao, placa: dados.placa?.toUpperCase() ?? null, modal: dados.modal };
  const [v] = await db.insert(schema.veiculos).values(registro).returning();
  await auditar(db, usuario.uid, "criar", "veiculo", v.id, registro);
  revalidatePath("/veiculos");
  return { ok: "Veículo cadastrado." };
}

export async function alternarVeiculo(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  const db = await getDb();
  await db.update(schema.veiculos).set({ ativo }).where(eq(schema.veiculos.id, id));
  await auditar(db, usuario.uid, ativo ? "ativar" : "desativar", "veiculo", id);
  revalidatePath("/veiculos");
}
