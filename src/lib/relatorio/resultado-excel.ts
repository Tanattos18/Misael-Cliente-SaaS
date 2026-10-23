import ExcelJS from "exceljs";
import { CATEGORIAS_DESPESA, ROTULO_AREA_DESPESA, ROTULO_CATEGORIA, ROTULO_MODAL, ROTULO_TIPO_PLURAL, TIPOS, type AreaDespesa, type CategoriaDespesa, type Modal } from "../dominio";
import { competenciaExtenso, dataBR } from "../formato";
import type { Resultado } from "../resultado";

const MOEDA = '"R$" #,##0.00';

export type DespesaPlanilha = {
  data: string;
  categoria: CategoriaDespesa;
  descricao: string | null;
  area: AreaDespesa;
  modal: Modal | null;
  veiculo: string | null;
  litros: number | null;
  valor: number;
};

function titulos(ws: ExcelJS.Worksheet, linha: number, nomes: string[]) {
  const row = ws.getRow(linha);
  nomes.forEach((n, i) => {
    const c = row.getCell(i + 1);
    c.value = n;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4F1" } };
  });
}

function linha(ws: ExcelJS.Worksheet, n: number, valores: (string | number)[], moedaDe = 1, negrito = false) {
  const row = ws.getRow(n);
  row.values = valores;
  for (let i = moedaDe + 1; i <= valores.length; i++) if (typeof valores[i - 1] === "number") row.getCell(i).numFmt = MOEDA;
  if (negrito) row.font = { bold: true };
}

/** Planilha do resultado mensal: resumo por área/modal, receita por serviço e despesas detalhadas. */
export async function gerarExcelResultado(competencia: string, r: Resultado, despesas: DespesaPlanilha[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CuraLog";

  const ws = wb.addWorksheet("Resultado");
  ws.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }];
  ws.getCell("A1").value = `CuraLog — Resultado de ${competenciaExtenso(competencia)}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

  let l = 3;
  titulos(ws, l++, ["Área", "Receita", "Despesa", "Resultado"]);
  linha(ws, l++, ["Enfermagem", r.enfermagem.receita, r.enfermagem.despesa, r.enfermagem.resultado]);
  linha(ws, l++, ["Logística / home care", r.logistica.receita, r.logistica.despesa, r.logistica.resultado]);
  for (const m of ["moto", "carro", "terceirizado"] as const) {
    linha(ws, l++, [`   ${ROTULO_MODAL[m]} (${r.modais[m].corridas} corridas)`, r.modais[m].receita, r.modais[m].despesa, r.modais[m].resultado]);
  }
  linha(ws, l++, ["Despesas gerais", 0, r.geral, -r.geral]);
  linha(ws, l++, ["RESULTADO GERAL", r.total.receita, r.total.despesa, r.total.resultado], 1, true);
  ws.getCell(`A${l++}`).value = `Margem: ${r.total.margem === null ? "—" : (r.total.margem * 100).toFixed(1).replace(".", ",") + "%"}`;

  l++;
  titulos(ws, l++, ["Receita por serviço", "Quantidade", "Receita"]);
  for (const t of TIPOS) {
    const row = ws.getRow(l++);
    row.values = [ROTULO_TIPO_PLURAL[t], r.receitaPorTipo[t].quantidade, r.receitaPorTipo[t].total];
    row.getCell(3).numFmt = MOEDA;
  }

  l++;
  titulos(ws, l++, ["Despesas por categoria", "Valor"]);
  for (const c of CATEGORIAS_DESPESA) linha(ws, l++, [ROTULO_CATEGORIA[c], r.despesasPorCategoria[c]]);

  const wd = wb.addWorksheet("Despesas");
  wd.columns = [{ width: 12 }, { width: 28 }, { width: 40 }, { width: 26 }, { width: 24 }, { width: 10 }, { width: 14 }];
  titulos(wd, 1, ["Data", "Categoria", "Descrição", "Apropriação", "Veículo", "Litros", "Valor"]);
  despesas.forEach((d, i) => {
    const row = wd.getRow(i + 2);
    row.values = [
      dataBR(d.data),
      ROTULO_CATEGORIA[d.categoria],
      d.descricao ?? "",
      ROTULO_AREA_DESPESA[d.area] + (d.modal ? ` · ${ROTULO_MODAL[d.modal]}` : ""),
      d.veiculo ?? "",
      d.litros ?? "",
      d.valor,
    ];
    row.getCell(7).numFmt = MOEDA;
  });
  const total = wd.getRow(despesas.length + 2);
  total.values = ["TOTAL", "", "", "", "", "", despesas.reduce((s, d) => s + d.valor, 0)];
  total.font = { bold: true };
  total.getCell(7).numFmt = MOEDA;
  if (r.despesasPorCategoria.terceirizado) {
    wd.getRow(despesas.length + 4).getCell(1).value =
      "Obs.: o custo das corridas terceirizadas (aba Resultado) é apurado automaticamente dos lançamentos e não aparece nesta lista.";
  }

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
