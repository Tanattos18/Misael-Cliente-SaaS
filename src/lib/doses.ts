import { somarDias } from "./formato";

/** Frequências oferecidas no cadastro: vezes ao dia → intervalo em horas. */
export const FREQUENCIAS = [
  { vezes: 1, rotulo: "1x ao dia (24/24h)" },
  { vezes: 2, rotulo: "2x ao dia (12/12h)" },
  { vezes: 3, rotulo: "3x ao dia (8/8h)" },
  { vezes: 4, rotulo: "4x ao dia (6/6h)" },
  { vezes: 6, rotulo: "6x ao dia (4/4h)" },
] as const;

export type ItemPlano = { descricao: string; horarios: string[] };

export type PlanoDoses = {
  inicioData: string; // AAAA-MM-DD
  inicioHora: string; // HH:MM
  fimData: string | null;
  fimHora: string | null;
  itens: ItemPlano[];
};

export type DiaPrevisto = { data: string; doses: { hora: string; item: string }[] };

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "06:00" + 3x ao dia → ["06:00", "14:00", "22:00"] */
export function horariosPorFrequencia(primeiro: string, vezes: number): string[] {
  if (!RE_HORA.test(primeiro)) throw new Error(`Horário inválido: ${primeiro}`);
  const [h, m] = primeiro.split(":").map(Number);
  const intervalo = (24 * 60) / vezes;
  const lista = Array.from({ length: vezes }, (_, i) => {
    const minutos = (h * 60 + m + Math.round(i * intervalo)) % (24 * 60);
    return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  });
  return [...new Set(lista)].sort();
}

/** "06:00, 14:00,22:00" → ["06:00","14:00","22:00"] (validado, sem repetidos, ordenado) */
export function lerHorarios(texto: string): string[] {
  const lista = texto
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^\d{1,2}$/.test(s) ? `${s.padStart(2, "0")}:00` : s.length === 4 ? `0${s}` : s));
  for (const h of lista) if (!RE_HORA.test(h)) throw new Error(`Horário inválido: ${h}`);
  return [...new Set(lista)].sort();
}

/**
 * Doses previstas de um tratamento, dia a dia, dentro de [de, ate].
 *
 * Regras:
 * - Cada horário de cada medicação conta como um atendimento
 *   (12/12h + 8/8h = 5 atendimentos/dia, mesmo que dois caiam na mesma hora).
 * - Só contam doses a partir do início (data + hora).
 * - O término é exclusivo por padrão: tratamento de 6h do dia 10 até 6h do dia 11
 *   com doses às 6h, 14h e 22h = 3 doses. Com `fimInclusivo`, a dose das 6h do dia 11 também conta.
 */
export function dosesPrevistas(plano: PlanoDoses, de: string, ate: string, fimInclusivo = false): DiaPrevisto[] {
  const inicio = `${plano.inicioData}T${plano.inicioHora}`;
  const fim = plano.fimData ? `${plano.fimData}T${plano.fimHora ?? "00:00"}` : null;

  const primeiroDia = plano.inicioData > de ? plano.inicioData : de;
  const ultimoDia = plano.fimData && plano.fimData < ate ? plano.fimData : ate;

  const dias: DiaPrevisto[] = [];
  for (let d = primeiroDia; d <= ultimoDia; d = somarDias(d, 1)) {
    const doses: DiaPrevisto["doses"] = [];
    for (const item of plano.itens) {
      for (const hora of item.horarios) {
        const t = `${d}T${hora}`;
        if (t < inicio) continue;
        if (fim && (fimInclusivo ? t > fim : t >= fim)) continue;
        doses.push({ hora, item: item.descricao });
      }
    }
    if (doses.length) {
      doses.sort((a, b) => a.hora.localeCompare(b.hora));
      dias.push({ data: d, doses });
    }
  }
  return dias;
}
