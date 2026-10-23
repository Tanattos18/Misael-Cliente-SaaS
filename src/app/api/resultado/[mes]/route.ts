import { and, asc, between, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";
import { auditar } from "@/lib/auditoria";
import { periodoDaCompetencia } from "@/lib/formato";
import { gerarExcelResultado } from "@/lib/relatorio/resultado-excel";
import { resultadoDoMes } from "@/lib/resultado";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

export async function GET(_: Request, ctx: RouteContext<"/api/resultado/[mes]">) {
  const sessao = await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  if (!sessao) return new Response("Não autorizado", { status: 401 });

  const { mes } = await ctx.params;
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Mês inválido", { status: 400 });

  const db = await getDb();
  const { inicio, fim } = periodoDaCompetencia(mes);
  const D = schema.despesas;
  const [resultado, despesas] = await Promise.all([
    resultadoDoMes(db, mes),
    db
      .select({
        data: D.data,
        categoria: D.categoria,
        descricao: D.descricao,
        area: D.area,
        modal: D.modal,
        veiculo: schema.veiculos.descricao,
        litros: D.litros,
        valor: D.valor,
      })
      .from(D)
      .leftJoin(schema.veiculos, eq(schema.veiculos.id, D.veiculoId))
      .where(and(eq(D.status, "ativa"), between(D.data, inicio, fim)))
      .orderBy(asc(D.data), asc(D.id)),
  ]);

  const corpo = await gerarExcelResultado(mes, resultado, despesas);
  await auditar(db, sessao.uid, "baixar:resultado", "resultado", null, { mes });
  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CuraLog_Resultado_${mes}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
