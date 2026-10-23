import { describe, expect, it } from "vitest";
import { dosesPrevistas, horariosPorFrequencia, lerHorarios, type PlanoDoses } from "./doses";

const plano = (p: Partial<PlanoDoses>): PlanoDoses => ({
  inicioData: "2026-10-10",
  inicioHora: "06:00",
  fimData: null,
  fimHora: null,
  itens: [{ descricao: "Antibiótico", horarios: ["06:00", "14:00", "22:00"] }],
  ...p,
});

const total = (dias: ReturnType<typeof dosesPrevistas>) => dias.reduce((s, d) => s + d.doses.length, 0);

describe("horariosPorFrequencia", () => {
  it("distribui as doses no dia a partir do primeiro horário", () => {
    expect(horariosPorFrequencia("06:00", 3)).toEqual(["06:00", "14:00", "22:00"]);
    expect(horariosPorFrequencia("08:00", 2)).toEqual(["08:00", "20:00"]);
    expect(horariosPorFrequencia("22:00", 2)).toEqual(["10:00", "22:00"]);
    expect(horariosPorFrequencia("09:30", 1)).toEqual(["09:30"]);
    expect(horariosPorFrequencia("00:00", 4)).toEqual(["00:00", "06:00", "12:00", "18:00"]);
  });
});

describe("lerHorarios", () => {
  it("aceita formatos comuns e ordena", () => {
    expect(lerHorarios("22:00, 6, 14:00")).toEqual(["06:00", "14:00", "22:00"]);
    expect(lerHorarios("8:00;20:00")).toEqual(["08:00", "20:00"]);
  });
  it("rejeita horário inválido", () => {
    expect(() => lerHorarios("25:00")).toThrow();
  });
});

describe("dosesPrevistas", () => {
  it("exemplo do cliente: 6h de um dia até 6h do outro = 3 doses (término exclusivo)", () => {
    const p = plano({ fimData: "2026-10-11", fimHora: "06:00" });
    const dias = dosesPrevistas(p, "2026-10-01", "2026-10-31");
    expect(total(dias)).toBe(3);
    expect(dias).toHaveLength(1);
  });

  it("com término inclusivo, a dose do horário final também conta", () => {
    const p = plano({ fimData: "2026-10-11", fimHora: "06:00" });
    expect(total(dosesPrevistas(p, "2026-10-01", "2026-10-31", true))).toBe(4);
  });

  it("não conta doses anteriores ao horário de início", () => {
    const p = plano({ inicioHora: "10:00", fimData: "2026-10-10", fimHora: "23:59" });
    expect(dosesPrevistas(p, "2026-10-01", "2026-10-31")[0].doses.map((d) => d.hora)).toEqual(["14:00", "22:00"]);
  });

  it("termina no meio do ciclo sem incluir doses posteriores", () => {
    const p = plano({ fimData: "2026-10-12", fimHora: "15:00" });
    // dia 10: 3, dia 11: 3, dia 12: 06h e 14h
    expect(total(dosesPrevistas(p, "2026-10-01", "2026-10-31"))).toBe(8);
  });

  it("soma medicações diferentes: 12/12h + 8/8h = 5 por dia", () => {
    const p = plano({
      itens: [
        { descricao: "Antibiótico", horarios: ["06:00", "14:00", "22:00"] },
        { descricao: "Analgésico", horarios: ["06:00", "18:00"] },
      ],
    });
    const dias = dosesPrevistas(p, "2026-10-10", "2026-10-12");
    expect(dias.map((d) => d.doses.length)).toEqual([5, 5, 5]);
  });

  it("tratamento sem término é limitado pelo período consultado", () => {
    const p = plano({ itens: [{ descricao: "Curativo", horarios: ["08:00"] }] });
    expect(total(dosesPrevistas(p, "2026-10-01", "2026-10-31"))).toBe(22); // 10 a 31
    expect(total(dosesPrevistas(p, "2026-11-01", "2026-11-30"))).toBe(30);
  });

  it("período antes do início não tem doses", () => {
    expect(dosesPrevistas(plano({}), "2026-09-01", "2026-09-30")).toEqual([]);
  });
});
