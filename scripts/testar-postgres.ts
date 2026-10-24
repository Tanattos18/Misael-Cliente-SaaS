import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { assinarSessao } from "../src/lib/sessao";

/**
 * Valida o sistema num PostgreSQL de verdade (o mesmo motor da produção), sem instalar nada:
 *  1. sobe um Postgres temporário;
 *  2. roda todos os testes contra ele;
 *  3. aplica migrações + carga inicial + demonstração num banco novo;
 *  4. com --paginas, sobe o Next.js apontando para esse banco e abre todas as telas e downloads.
 * Uso: npm run test:pg   (ou: npm run test:pg -- --paginas)
 */
const PORTA_PG = 54329;
const PORTA_APP = 3200;
const SENHA = "teste-local";

function rodar(cmd: string, args: string[], env: Record<string, string>): Promise<number> {
  return new Promise((ok) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: "inherit", shell: true });
    p.on("exit", (c) => ok(c ?? 1));
  });
}

async function esperarServidor(url: string, ms: number) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function testarPaginas(databaseUrl: string): Promise<string[]> {
  const app = spawn("npx", ["next", "dev", "-p", String(PORTA_APP)], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
    shell: true,
  });
  const falhas: string[] = [];
  try {
    const base = `http://localhost:${PORTA_APP}`;
    await esperarServidor(base, 120_000);
    const cookie = `curalog_sessao=${await assinarSessao({ uid: 1, nome: "Administrador", perfil: "admin" })}`;
    const rotas = [
      "/", "/lancamentos", "/lancamentos/novo?area=enfermagem", "/lancamentos/novo?area=logistica", "/lancamentos/1",
      "/tratamentos", "/tratamentos/1", "/tratamentos/1/conferencia", "/tratamentos/novo",
      "/fechamentos", "/fechamentos/1", "/fechamentos/novo?mes=2026-10&empresa=1&area=enfermagem",
      "/despesas", "/despesas/novo", "/despesas/1", "/resultado?mes=2026-09", "/veiculos",
      "/pacientes", "/pacientes/1", "/empresas", "/empresas/1", "/regioes", "/tarifas",
      "/configuracoes", "/usuarios", "/auditoria",
      "/api/fechamentos/1/excel", "/api/fechamentos/1/pdf", "/api/resultado/2026-09",
    ];
    for (const rota of rotas) {
      const r = await fetch(base + rota, { headers: { cookie }, redirect: "manual" });
      const corpo = r.headers.get("content-type")?.includes("html") ? await r.text() : "";
      const ok = r.status === 200 && !/Internal Server Error|Application error|__next_error__/.test(corpo);
      console.log(`${ok ? "OK  " : "FALHA"} ${r.status} ${rota}`);
      if (!ok) falhas.push(rota);
    }
  } finally {
    app.kill();
    if (process.platform === "win32" && app.pid) await rodar("taskkill", ["/PID", String(app.pid), "/T", "/F"], {});
  }
  return falhas;
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), "curalog-pg-")),
    port: PORTA_PG,
    user: "postgres",
    password: SENHA,
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  const admin = `postgres://postgres:${SENHA}@localhost:${PORTA_PG}/postgres`;
  const demo = `postgres://postgres:${SENHA}@localhost:${PORTA_PG}/curalog_demo`;
  let codigo = 0;

  try {
    console.log("\n== 1. Testes automáticos no PostgreSQL ==");
    if ((await rodar("npx", ["vitest", "run"], { TEST_PG_URL: admin })) !== 0) codigo = 1;

    console.log("\n== 2. Migrações, carga inicial e demonstração ==");
    await pg.createDatabase("curalog_demo");
    for (const script of ["db:migrate", "db:seed", "db:demo"]) {
      if ((await rodar("npm", ["run", script], { DATABASE_URL: demo })) !== 0) {
        codigo = 1;
        throw new Error(`${script} falhou`);
      }
    }

    if (process.argv.includes("--paginas")) {
      console.log("\n== 3. Telas e downloads ==");
      const falhas = await testarPaginas(demo);
      if (falhas.length) {
        codigo = 1;
        console.log(`Falharam: ${falhas.join(", ")}`);
      }
    }
  } finally {
    await pg.stop();
  }
  console.log(codigo === 0 ? "\nTudo certo no PostgreSQL." : "\nHouve falhas (veja acima).");
  process.exit(codigo);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
