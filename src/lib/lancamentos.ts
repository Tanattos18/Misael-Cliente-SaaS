import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { ACRESCIMO_TERCEIRIZADO_PADRAO, CHAVE_ACRESCIMO_TERCEIRIZADO, type Modal, type Tipo } from "./dominio";
import { resolverTarifa, type TarifaRegra } from "./tarifas";

export async function acrescimoTerceirizado(db: DB): Promise<number> {
  const [c] = await db
    .select()
    .from(schema.configuracoes)
    .where(eq(schema.configuracoes.chave, CHAVE_ACRESCIMO_TERCEIRIZADO));
  const n = Number(c?.valor);
  return Number.isFinite(n) ? n : ACRESCIMO_TERCEIRIZADO_PADRAO;
}

const ROTULO_ORIGEM = (r: TarifaRegra) =>
  r.pacienteId ? "tarifa do paciente" : r.empresaId ? "tarifa da empresa" : r.regiaoId ? "tarifa da região" : "tarifa padrão";

/** Busca a tarifa aplicável ao paciente para o serviço/modal informado. */
export async function tarifaPara(
  db: DB,
  pacienteId: number,
  tipo: Tipo,
  modal: Modal | null,
): Promise<{ valor: number; origem: string } | null> {
  const [paciente] = await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, pacienteId));
  if (!paciente) return null;
  const regras = await db.select().from(schema.tarifas).where(eq(schema.tarifas.tipo, tipo));
  const r = resolverTarifa(regras, {
    tipo,
    modal,
    pacienteId,
    empresaId: paciente.empresaId,
    regiaoId: paciente.regiaoId,
  });
  return r ? { valor: r.valor, origem: ROTULO_ORIGEM(r) } : null;
}

/** Um lançamento só pode ser alterado se não estiver em um fechamento ativo. */
export async function lancamentoBloqueado(db: DB, fechamentoId: number | null): Promise<boolean> {
  if (!fechamentoId) return false;
  const [f] = await db
    .select({ status: schema.fechamentos.status })
    .from(schema.fechamentos)
    .where(eq(schema.fechamentos.id, fechamentoId));
  return !!f && f.status !== "reaberto";
}
