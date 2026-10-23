const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function moeda(valor: number | null | undefined): string {
  return moedaFmt.format(valor ?? 0);
}

/** Arredonda para centavos evitando erros de ponto flutuante (ex.: 0,1 + 0,2). */
export function centavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** "2026-10-05" → "05/10/2026" */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Hoje no fuso de Brasília, no formato AAAA-MM-DD. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function competenciaAtual(): string {
  return hojeISO().slice(0, 7);
}

/** "2026-10" → { inicio: "2026-10-01", fim: "2026-10-31" } */
export function periodoDaCompetencia(competencia: string): { inicio: string; fim: string } {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error(`Competência inválida: ${competencia}`);
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${competencia}-01`, fim: `${competencia}-${String(ultimoDia).padStart(2, "0")}` };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-10" → "Outubro/2026" */
export function competenciaExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

/** Primeiro dia do mês anterior: "2026-03-15" → "2026-02-01" */
export function inicioMesAnterior(iso: string): string {
  return `${somarDias(`${iso.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
