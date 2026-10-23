import type { DB } from "@/db";
import { schema } from "@/db";

type Executor = Pick<DB, "insert">;

/** Registra quem fez o quê. Use dentro da mesma transação da alteração quando houver uma. */
export async function auditar(
  db: Executor,
  usuarioId: number | null,
  acao: string,
  entidade: string,
  entidadeId: number | null,
  dados?: unknown,
) {
  await db.insert(schema.auditoria).values({
    usuarioId,
    acao,
    entidade,
    entidadeId,
    dados: dados === undefined ? null : (dados as object),
  });
}
