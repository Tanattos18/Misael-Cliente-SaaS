import { centavos } from "./formato";
import type { Modal, Tipo } from "./dominio";

export type TarifaRegra = {
  id: number;
  tipo: Tipo;
  modal: "moto" | "carro" | null;
  pacienteId: number | null;
  empresaId: number | null;
  regiaoId: number | null;
  valor: number;
  ativo: boolean;
};

export type ContextoTarifa = {
  tipo: Tipo;
  modal?: Modal | null;
  pacienteId: number;
  empresaId: number;
  regiaoId: number | null;
};

/**
 * Escolhe a tarifa mais específica que se aplica ao contexto:
 * paciente > empresa > região > padrão. Corridas exigem o mesmo modal
 * (tarifa sem modal vale para qualquer um). Terceirizado não usa tabela.
 */
export function resolverTarifa(regras: TarifaRegra[], ctx: ContextoTarifa): TarifaRegra | null {
  if (ctx.tipo === "corrida" && ctx.modal === "terceirizado") return null;

  let melhor: TarifaRegra | null = null;
  let melhorPeso = -1;

  for (const r of regras) {
    if (!r.ativo || r.tipo !== ctx.tipo) continue;
    if (r.pacienteId !== null && r.pacienteId !== ctx.pacienteId) continue;
    if (r.empresaId !== null && r.empresaId !== ctx.empresaId) continue;
    if (r.regiaoId !== null && r.regiaoId !== ctx.regiaoId) continue;
    if (ctx.tipo === "corrida" && r.modal !== null && r.modal !== ctx.modal) continue;

    const peso =
      (r.pacienteId !== null ? 8 : 0) +
      (r.empresaId !== null ? 4 : 0) +
      (r.regiaoId !== null ? 2 : 0) +
      (r.modal !== null ? 1 : 0);
    if (peso > melhorPeso) {
      melhor = r;
      melhorPeso = peso;
    }
  }
  return melhor;
}

/** Valor cobrado de uma corrida terceirizada: custo + acréscimo percentual. */
export function valorTerceirizado(custo: number, percentual: number): number {
  return centavos(custo * (1 + percentual / 100));
}
