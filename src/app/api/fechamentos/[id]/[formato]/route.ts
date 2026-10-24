import { getDb } from "@/db";
import { auditar } from "@/lib/auditoria";
import { usuarioAutorizado } from "@/lib/auth";
import { relatorioDoFechamento } from "@/lib/fechamento";
import { gerarExcel } from "@/lib/relatorio/excel";
import { nomeArquivoRelatorio } from "@/lib/relatorio/modelo";
import { gerarPdf } from "@/lib/relatorio/pdf";

export async function GET(_: Request, ctx: RouteContext<"/api/fechamentos/[id]/[formato]">) {
  const sessao = await usuarioAutorizado();
  if (!sessao) return new Response("Não autorizado", { status: 401 });

  const { id, formato } = await ctx.params;
  if (formato !== "excel" && formato !== "pdf") return new Response("Formato inválido", { status: 404 });

  const db = await getDb();
  const relatorio = await relatorioDoFechamento(db, Number(id));
  if (!relatorio) return new Response("Fechamento não encontrado", { status: 404 });

  const excel = formato === "excel";
  const corpo = excel ? await gerarExcel(relatorio) : gerarPdf(relatorio);
  const nome = nomeArquivoRelatorio(relatorio.cabecalho, excel ? "xlsx" : "pdf");
  await auditar(db, sessao.uid, `baixar:${formato}`, "fechamento", Number(id));

  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type": excel
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
