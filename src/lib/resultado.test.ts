import { describe, expect, it } from "vitest";
import { apurarResultado, ultimosMeses } from "./resultado";

describe("apurarResultado", () => {
  const r = apurarResultado(
    [
      { tipo: "medicacao", modal: null, quantidade: 10, total: 550, custoTerceiro: 0 },
      { tipo: "curativo", modal: null, quantidade: 4, total: 180, custoTerceiro: 0 },
      { tipo: "coleta", modal: null, quantidade: 2, total: 110, custoTerceiro: 0 },
      { tipo: "corrida", modal: "moto", quantidade: 8, total: 200, custoTerceiro: 0 },
      { tipo: "corrida", modal: "carro", quantidade: 2, total: 90, custoTerceiro: 0 },
      { tipo: "corrida", modal: "terceirizado", quantidade: 2, total: 260, custoTerceiro: 200 },
    ],
    [
      { categoria: "combustivel", area: "logistica", modal: "moto", valor: 60, litros: 10 },
      { categoria: "combustivel", area: "logistica", modal: "carro", valor: 120.5, litros: 20 },
      { categoria: "manutencao", area: "logistica", modal: "moto", valor: 40, litros: null },
      { categoria: "outras", area: "enfermagem", modal: null, valor: 30, litros: null },
      { categoria: "outras", area: "geral", modal: null, valor: 100, litros: null },
    ],
  );

  it("receita por área", () => {
    expect(r.enfermagem.receita).toBe(840);
    expect(r.logistica.receita).toBe(550);
    expect(r.total.receita).toBe(1390);
  });

  it("custo do terceirizado entra automaticamente", () => {
    expect(r.despesasPorCategoria.terceirizado).toBe(200);
    expect(r.modais.terceirizado).toEqual({ receita: 260, despesa: 200, resultado: 60, corridas: 2 });
  });

  it("resultado por modal e por área", () => {
    expect(r.modais.moto).toEqual({ receita: 200, despesa: 100, resultado: 100, corridas: 8 });
    expect(r.modais.carro.resultado).toBe(-30.5);
    expect(r.logistica).toEqual({ receita: 550, despesa: 420.5, resultado: 129.5 });
    expect(r.enfermagem.resultado).toBe(810);
  });

  it("despesa geral só entra no total", () => {
    expect(r.geral).toBe(100);
    expect(r.total.despesa).toBe(550.5);
    expect(r.total.resultado).toBe(839.5);
    expect(r.total.margem).toBeCloseTo(0.604, 3);
    expect(r.combustivelLitros).toBe(30);
  });

  it("sem receita, margem é nula", () => {
    expect(apurarResultado([], []).total.margem).toBeNull();
  });
});

describe("ultimosMeses", () => {
  it("volta atravessando o ano", () => {
    expect(ultimosMeses("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
