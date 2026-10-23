"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { dosesPrevistas, lerHorarios } from "@/lib/doses";
import { hojeISO, inicioMesAnterior } from "@/lib/formato";
import { lerForm, zData, zId, zIdOpcional, zTexto, zValor, type EstadoAcao } from "@/lib/form";
import { carregarPlano, fimInclusivo, pendenciasPorPlano, registrarRealizados } from "@/lib/planos";

const zHora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário inválido");

const Plano = z.object({
  id: zIdOpcional,
  pacienteId: zId,
  tipo: z.enum(["medicacao", "curativo"]),
  inicioData: zData,
  inicioHora: zHora,
  fimData: zData.optional(),
  fimHora: zHora.optional(),
  valorUnitario: zValor.optional(),
  observacoes: zTexto,
  ativo: z.string().optional(),
  itens: z.string(),
});

const Itens = z
  .array(z.object({ descricao: z.string().trim().min(1, "descreva cada item"), horarios: z.string() }))
  .min(1, "inclua ao menos um item");

export async function salvarPlano(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const { dados, erro } = lerForm(formData, Plano);
  if (!dados) return { erro };

  let itens: { descricao: string; horarios: string[] }[];
  try {
    const brutos = Itens.parse(JSON.parse(dados.itens));
    itens = brutos.map((i) => ({ descricao: i.descricao, horarios: lerHorarios(i.horarios) }));
    if (itens.some((i) => i.horarios.length === 0)) return { erro: "Informe os horários de cada item." };
  } catch (e) {
    return { erro: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message };
  }
  if (dados.fimData && `${dados.fimData}T${dados.fimHora ?? "00:00"}` <= `${dados.inicioData}T${dados.inicioHora}`) {
    return { erro: "O término precisa ser depois do início." };
  }

  const registro = {
    pacienteId: dados.pacienteId,
    tipo: dados.tipo,
    inicioData: dados.inicioData,
    inicioHora: dados.inicioHora,
    fimData: dados.fimData ?? null,
    fimHora: dados.fimData ? (dados.fimHora ?? "00:00") : null,
    valorUnitario: dados.valorUnitario ?? null,
    observacoes: dados.observacoes ?? null,
    ativo: dados.id ? dados.ativo === "on" : true,
  };

  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    let planoId = dados.id;
    if (planoId) {
      await tx.update(schema.planos).set(registro).where(eq(schema.planos.id, planoId));
      await tx.delete(schema.planoItens).where(eq(schema.planoItens.planoId, planoId));
    } else {
      [{ id: planoId }] = await tx.insert(schema.planos).values({ ...registro, criadoPor: usuario.uid }).returning();
    }
    await tx.insert(schema.planoItens).values(itens.map((i) => ({ planoId: planoId!, descricao: i.descricao, horarios: i.horarios.join(",") })));
    await auditar(tx, usuario.uid, dados.id ? "editar" : "criar", "plano", planoId!, { ...registro, itens });
    return planoId!;
  });
  revalidatePath("/tratamentos");
  redirect(`/tratamentos/${id}/conferencia`);
}

export async function salvarConferencia(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const planoId = Number(formData.get("planoId"));
  const db = await getDb();
  const plano = await carregarPlano(db, planoId);
  if (!plano) return { erro: "Tratamento não encontrado." };

  const quantidades: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    const m = /^q_(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (!m || typeof v !== "string" || v.trim() === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { erro: `Quantidade inválida em ${m[1]}.` };
    quantidades[m[1]] = n;
  }

  try {
    const r = await registrarRealizados(db, usuario.uid, plano, quantidades);
    revalidatePath(`/tratamentos/${planoId}/conferencia`);
    revalidatePath("/tratamentos");
    const aviso = r.ignorados.length ? ` Não alterados: ${r.ignorados.join(", ")}.` : "";
    return { ok: `${r.gravados} dia(s) gravado(s).${aviso}` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Marca como realizados, exatamente como previsto, todos os dias pendentes até hoje (mês atual e anterior). */
export async function confirmarPendentes(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const planoId = Number(formData.get("planoId"));
  const db = await getDb();
  const plano = await carregarPlano(db, planoId);
  if (!plano) return { erro: "Tratamento não encontrado." };

  const hoje = hojeISO();
  const de = inicioMesAnterior(hoje);
  const pend = (await pendenciasPorPlano(db, [plano], de, hoje)).get(plano.id)!;
  if (pend.dias.length === 0) return { ok: "Nada pendente." };

  const previstos = dosesPrevistas(plano, de, hoje, await fimInclusivo(db));
  const quantidades = Object.fromEntries(
    pend.dias.map((d) => [d, previstos.find((p) => p.data === d)!.doses.length]),
  );
  try {
    const r = await registrarRealizados(db, usuario.uid, plano, quantidades);
    revalidatePath(`/tratamentos/${planoId}/conferencia`);
    revalidatePath("/tratamentos");
    return { ok: `${r.gravados} dia(s) confirmados conforme o previsto.` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
