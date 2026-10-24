"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { MODAIS, TIPOS, areaDoTipo, type Modal, type Tipo } from "@/lib/dominio";
import { centavos } from "@/lib/formato";
import { lerForm, zData, zId, zIdOpcional, zTexto, zValor, type EstadoAcao } from "@/lib/form";
import { acrescimoTerceirizado, lancamentoBloqueado, tarifaPara } from "@/lib/lancamentos";
import { tratamentoNaData } from "@/lib/planos";
import { valorTerceirizado } from "@/lib/tarifas";

export async function sugerirValor(
  pacienteId: number,
  tipo: Tipo,
  modal: Modal | null,
): Promise<{ valor: number; origem: string } | null> {
  await exigirUsuario();
  if (!pacienteId) return null;
  return tarifaPara(await getDb(), pacienteId, tipo, modal);
}

const Lancamento = z.object({
  id: zIdOpcional,
  tipo: z.enum(TIPOS),
  pacienteId: zId,
  data: zData,
  hora: z.string().regex(/^\d{2}:\d{2}$/, "horário inválido").optional(),
  quantidade: z.coerce.number().int().min(1, "mínimo 1").max(100).default(1),
  valorUnitario: zValor.optional(),
  modal: z.enum(MODAIS).optional(),
  origem: zTexto,
  destino: zTexto,
  custoTerceiro: zValor.optional(),
  percentualAcrescimo: zValor.optional(),
  observacoes: zTexto,
});

export async function salvarLancamento(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Lancamento);
  if (!dados) return { erro };

  const db = await getDb();
  const [paciente] = await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, dados.pacienteId));
  if (!paciente) return { erro: "Paciente não encontrado." };

  // Medicação/curativo de paciente em tratamento é lançado pela conferência; avulso só se for extra.
  if (dados.tipo === "medicacao" || dados.tipo === "curativo") {
    const [atual] = dados.id
      ? await db.select({ planoId: schema.lancamentos.planoId }).from(schema.lancamentos).where(eq(schema.lancamentos.id, dados.id))
      : [];
    const tratamento = atual?.planoId ? null : await tratamentoNaData(db, paciente.id, dados.tipo, dados.data);
    if (tratamento && formData.get("confirmarExtra") !== "1") {
      return {
        erro: `${paciente.nome} tem um tratamento ativo nesta data, e esses atendimentos já são cobrados pela conferência do tratamento. Se este é um atendimento extra, fora da prescrição, marque a confirmação e lance de novo.`,
        confirmar: "extra",
        link: `/tratamentos/${tratamento.id}/conferencia?mes=${dados.data.slice(0, 7)}`,
      };
    }
  }

  const corrida = dados.tipo === "corrida";
  if (corrida && !dados.modal) return { erro: "Informe o modal da corrida." };
  const modal = corrida ? dados.modal! : null;

  let valorUnitario: number;
  let custoTerceiro: number | null = null;
  let percentualAcrescimo: number | null = null;
  if (modal === "terceirizado") {
    if (dados.custoTerceiro === undefined) return { erro: "Informe o custo cobrado pela transportadora." };
    custoTerceiro = dados.custoTerceiro;
    percentualAcrescimo = dados.percentualAcrescimo ?? (await acrescimoTerceirizado(db));
    valorUnitario = valorTerceirizado(custoTerceiro, percentualAcrescimo);
  } else if (dados.valorUnitario !== undefined) {
    valorUnitario = dados.valorUnitario;
  } else {
    const t = await tarifaPara(db, paciente.id, dados.tipo, modal);
    if (!t) return { erro: "Não há tarifa cadastrada para este serviço. Informe o valor." };
    valorUnitario = t.valor;
  }

  const registro = {
    area: areaDoTipo(dados.tipo),
    tipo: dados.tipo,
    pacienteId: paciente.id,
    empresaId: paciente.empresaId,
    data: dados.data,
    hora: dados.hora ?? null,
    quantidade: dados.quantidade,
    valorUnitario,
    valorTotal: centavos(valorUnitario * dados.quantidade),
    modal,
    origem: corrida ? (dados.origem ?? null) : null,
    destino: corrida ? (dados.destino ?? null) : null,
    custoTerceiro,
    percentualAcrescimo,
    observacoes: dados.observacoes ?? null,
  };

  if (dados.id) {
    const [antes] = await db.select().from(schema.lancamentos).where(eq(schema.lancamentos.id, dados.id));
    if (!antes) return { erro: "Lançamento não encontrado." };
    if (await lancamentoBloqueado(db, antes.fechamentoId)) {
      return { erro: "Este lançamento já está em um fechamento. Reabra o fechamento para alterar." };
    }
    if (antes.status === "cancelado") return { erro: "Lançamento cancelado não pode ser alterado." };
    await db.transaction(async (tx) => {
      await tx.update(schema.lancamentos).set({ ...registro, atualizadoEm: new Date() }).where(eq(schema.lancamentos.id, antes.id));
      await auditar(tx, usuario.uid, "editar", "lancamento", antes.id, { antes, depois: registro });
    });
    revalidatePath("/lancamentos");
    redirect("/lancamentos");
  }

  await db.transaction(async (tx) => {
    const [novo] = await tx.insert(schema.lancamentos).values({ ...registro, criadoPor: usuario.uid }).returning();
    await auditar(tx, usuario.uid, "criar", "lancamento", novo.id, registro);
  });
  revalidatePath("/lancamentos");
  return { ok: `Lançado: ${paciente.nome} — ${registro.quantidade}× R$ ${valorUnitario.toFixed(2).replace(".", ",")}` };
}

const Cancelamento = z.object({ id: zId, motivo: z.string().min(3, "informe o motivo") });

export async function cancelarLancamento(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Cancelamento);
  if (!dados) return { erro };
  const db = await getDb();
  const [l] = await db.select().from(schema.lancamentos).where(eq(schema.lancamentos.id, dados.id));
  if (!l) return { erro: "Lançamento não encontrado." };
  if (await lancamentoBloqueado(db, l.fechamentoId)) {
    return { erro: "Este lançamento já está em um fechamento. Reabra o fechamento para cancelar." };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.lancamentos)
      .set({ status: "cancelado", motivoCancelamento: dados.motivo, atualizadoEm: new Date() })
      .where(eq(schema.lancamentos.id, l.id));
    await auditar(tx, usuario.uid, "cancelar", "lancamento", l.id, { motivo: dados.motivo });
  });
  revalidatePath("/lancamentos");
  redirect("/lancamentos");
}
