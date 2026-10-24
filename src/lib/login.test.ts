import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { loginBloqueado, registrarTentativa } from "./login";
import { bancoDeTeste } from "./test-db";

let db: DB;
const t0 = new Date("2026-10-24T12:00:00Z");
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

beforeAll(async () => {
  db = await bancoDeTeste("curalog_teste_login");
}, 60_000);

describe("bloqueio de login", () => {
  it("bloqueia o e-mail após 5 erros em 15 minutos", async () => {
    for (let i = 0; i < 4; i++) await registrarTentativa(db, "a@x", "1.1.1.1", false, min(i));
    expect(await loginBloqueado(db, "a@x", "1.1.1.1", min(5))).toBe(false);
    await registrarTentativa(db, "a@x", "1.1.1.1", false, min(5));
    expect(await loginBloqueado(db, "a@x", "1.1.1.1", min(6))).toBe(true);
    // Outro e-mail, de outro IP, não é afetado.
    expect(await loginBloqueado(db, "b@x", "2.2.2.2", min(6))).toBe(false);
  });

  it("libera depois que a janela passa", async () => {
    // Falhas em 0, 1, 2, 3 e 5 min: aos 15 min ainda são 5; aos 21 min nenhuma.
    expect(await loginBloqueado(db, "a@x", "1.1.1.1", min(15))).toBe(true);
    expect(await loginBloqueado(db, "a@x", "1.1.1.1", min(21))).toBe(false);
  });

  it("bloqueia o IP que tenta muitos e-mails diferentes", async () => {
    for (let i = 0; i < 20; i++) await registrarTentativa(db, `u${i}@x`, "9.9.9.9", false, min(100));
    expect(await loginBloqueado(db, "novo@x", "9.9.9.9", min(101))).toBe(true);
  });

  it("tentativas com sucesso não contam como falha", async () => {
    for (let i = 0; i < 6; i++) await registrarTentativa(db, "c@x", "3.3.3.3", true, min(200 + i));
    expect(await loginBloqueado(db, "c@x", "3.3.3.3", min(207))).toBe(false);
  });
});
