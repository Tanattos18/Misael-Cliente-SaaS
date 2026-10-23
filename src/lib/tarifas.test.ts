import { describe, expect, it } from "vitest";
import { resolverTarifa, valorTerceirizado, type TarifaRegra } from "./tarifas";

let seq = 0;
const regra = (r: Partial<TarifaRegra> & Pick<TarifaRegra, "tipo" | "valor">): TarifaRegra => ({
  id: ++seq,
  modal: null,
  pacienteId: null,
  empresaId: null,
  regiaoId: null,
  ativo: true,
  ...r,
});

const GOIANIA = 1;
const GOIANIRA = 2;

const regras: TarifaRegra[] = [
  regra({ tipo: "medicacao", valor: 55 }),
  regra({ tipo: "curativo", valor: 45 }),
  regra({ tipo: "coleta", valor: 55 }),
  regra({ tipo: "medicacao", empresaId: 7, valor: 50 }),
  regra({ tipo: "medicacao", pacienteId: 99, valor: 60 }),
  regra({ tipo: "corrida", modal: "moto", regiaoId: GOIANIA, valor: 25 }),
  regra({ tipo: "corrida", modal: "carro", regiaoId: GOIANIA, valor: 45 }),
  regra({ tipo: "corrida", modal: "moto", regiaoId: GOIANIRA, valor: 40 }),
  regra({ tipo: "corrida", modal: "moto", pacienteId: 5, valor: 30 }),
  regra({ tipo: "coleta", valor: 999, ativo: false }),
];

const ctx = { pacienteId: 1, empresaId: 1, regiaoId: GOIANIA };

describe("resolverTarifa", () => {
  it("usa a tarifa padrão de enfermagem", () => {
    expect(resolverTarifa(regras, { ...ctx, tipo: "medicacao" })?.valor).toBe(55);
    expect(resolverTarifa(regras, { ...ctx, tipo: "curativo" })?.valor).toBe(45);
    expect(resolverTarifa(regras, { ...ctx, tipo: "coleta" })?.valor).toBe(55);
  });

  it("ignora tarifas inativas", () => {
    expect(resolverTarifa(regras, { ...ctx, tipo: "coleta" })?.valor).not.toBe(999);
  });

  it("prioriza paciente sobre empresa e empresa sobre padrão", () => {
    expect(resolverTarifa(regras, { ...ctx, empresaId: 7, tipo: "medicacao" })?.valor).toBe(50);
    expect(resolverTarifa(regras, { ...ctx, empresaId: 7, pacienteId: 99, tipo: "medicacao" })?.valor).toBe(60);
  });

  it("corrida usa região e modal", () => {
    expect(resolverTarifa(regras, { ...ctx, tipo: "corrida", modal: "moto" })?.valor).toBe(25);
    expect(resolverTarifa(regras, { ...ctx, tipo: "corrida", modal: "carro" })?.valor).toBe(45);
    expect(resolverTarifa(regras, { ...ctx, regiaoId: GOIANIRA, tipo: "corrida", modal: "moto" })?.valor).toBe(40);
  });

  it("tarifa do paciente vence a da região", () => {
    expect(resolverTarifa(regras, { ...ctx, pacienteId: 5, tipo: "corrida", modal: "moto" })?.valor).toBe(30);
  });

  it("sem tarifa para a combinação, retorna null", () => {
    expect(resolverTarifa(regras, { ...ctx, regiaoId: GOIANIRA, tipo: "corrida", modal: "carro" })).toBeNull();
    expect(resolverTarifa(regras, { ...ctx, regiaoId: null, tipo: "corrida", modal: "moto" })).toBeNull();
  });

  it("terceirizado não usa tabela", () => {
    expect(resolverTarifa(regras, { ...ctx, tipo: "corrida", modal: "terceirizado" })).toBeNull();
  });
});

describe("valorTerceirizado", () => {
  it("aplica 30% sobre o custo (25% administrativo + 5% adiantamento)", () => {
    expect(valorTerceirizado(100, 30)).toBe(130);
    expect(valorTerceirizado(87.5, 30)).toBe(113.75);
  });

  it("arredonda para centavos", () => {
    expect(valorTerceirizado(33.33, 30)).toBe(43.33);
  });
});
