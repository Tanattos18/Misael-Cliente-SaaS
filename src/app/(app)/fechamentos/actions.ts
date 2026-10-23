"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { AREAS } from "@/lib/dominio";
import { gerarFechamento, pendenciasDoMes, reabrirFechamento } from "@/lib/fechamento";
import { hojeISO, somarDias } from "@/lib/formato";
import { lerForm, zData, zId, zTexto, zValor, type EstadoAcao } from "@/lib/form";

const zCompetencia = z.string().regex(/^\d{4}-\d{2}$/, "mês inválido");

const Gerar = z.object({ empresaId: zId, area: z.enum(AREAS), competencia: zCompetencia });

export async function gerar(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Gerar);
  if (!dados) return { erro };
  let id: number;
  try {
    id = await gerarFechamento(await getDb(), usuario.uid, dados.empresaId, dados.area, dados.competencia);
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath("/fechamentos");
  redirect(`/fechamentos/${id}`);
}

export async function gerarTodos(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, z.object({ competencia: zCompetencia }));
  if (!dados) return { erro };
  const db = await getDb();
  const pendentes = (await pendenciasDoMes(db, dados.competencia)).filter((p) => !p.existenteId);
  let gerados = 0;
  const falhas: string[] = [];
  for (const p of pendentes) {
    try {
      await gerarFechamento(db, usuario.uid, p.empresaId, p.area, dados.competencia);
      gerados++;
    } catch (e) {
      falhas.push(`${p.empresa}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/fechamentos");
  if (falhas.length) return { erro: `${gerados} gerado(s). Falhas: ${falhas.join("; ")}` };
  return { ok: gerados ? `${gerados} fechamento(s) gerado(s).` : "Nada pendente para fechar." };
}

const Reabrir = z.object({ id: zId, motivo: z.string().min(3, "informe o motivo") });

export async function reabrir(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirAdmin();
  const { dados, erro } = lerForm(formData, Reabrir);
  if (!dados) return { erro };
  try {
    await reabrirFechamento(await getDb(), usuario.uid, dados.id, dados.motivo);
  } catch (e) {
    return { erro: (e as Error).message };
  }
  revalidatePath("/fechamentos");
  redirect(`/fechamentos/${dados.id}`);
}

const Status = z.object({
  id: zId,
  etapa: z.enum(["enviado", "aprovado", "nf_emitida", "pago"]),
  data: zData.optional(),
  dataVencimento: zData.optional(),
  numeroNf: zTexto,
  valorPago: zValor.optional(),
  observacoes: zTexto,
});

const ORDEM = ["calculado", "enviado", "aprovado", "nf_emitida", "pago"] as const;

/** Avança o fechamento no fluxo de recebimento, registrando a data de cada etapa. */
export async function atualizarStatus(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Status);
  if (!dados) return { erro };
  const db = await getDb();
  const [f] = await db
    .select({ f: schema.fechamentos, prazo: schema.empresas.prazoPagamentoDias })
    .from(schema.fechamentos)
    .innerJoin(schema.empresas, eq(schema.empresas.id, schema.fechamentos.empresaId))
    .where(eq(schema.fechamentos.id, dados.id));
  if (!f) return { erro: "Fechamento não encontrado." };
  if (f.f.status === "reaberto") return { erro: "Fechamento reaberto não pode mudar de status." };
  if (ORDEM.indexOf(dados.etapa) <= ORDEM.indexOf(f.f.status as (typeof ORDEM)[number]) && dados.etapa !== f.f.status) {
    return { erro: "Etapa já concluída." };
  }

  const data = dados.data ?? hojeISO();
  const mudancas: Partial<typeof schema.fechamentos.$inferInsert> = { status: dados.etapa };
  if (dados.observacoes) mudancas.observacoes = dados.observacoes;
  switch (dados.etapa) {
    case "enviado":
      mudancas.dataEnvio = data;
      mudancas.dataVencimento = dados.dataVencimento ?? somarDias(data, f.prazo);
      break;
    case "aprovado":
      mudancas.dataAprovacao = data;
      break;
    case "nf_emitida":
      if (!dados.numeroNf) return { erro: "Informe o número da nota fiscal." };
      mudancas.numeroNf = dados.numeroNf;
      mudancas.dataNf = data;
      if (dados.dataVencimento) mudancas.dataVencimento = dados.dataVencimento;
      break;
    case "pago":
      mudancas.dataPagamento = data;
      mudancas.valorPago = dados.valorPago ?? f.f.total;
      break;
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.fechamentos).set(mudancas).where(eq(schema.fechamentos.id, dados.id));
    await auditar(tx, usuario.uid, `status:${dados.etapa}`, "fechamento", dados.id, mudancas);
  });
  revalidatePath(`/fechamentos/${dados.id}`);
  revalidatePath("/fechamentos");
  return { ok: "Status atualizado." };
}
