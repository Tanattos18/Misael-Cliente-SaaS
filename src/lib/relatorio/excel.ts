import ExcelJS from "exceljs";
import { competenciaExtenso, dataBR } from "../formato";
import { ROTULO_AREA } from "../dominio";
import type { Relatorio } from "./modelo";

const MOEDA = '"R$" #,##0.00';
const COR_TITULO = "FF0F766E";
const COR_CABECALHO = "FFE6F4F1";
const COR_SUBTOTAL = "FFF3F4F6";

type Coluna = { titulo: string; largura: number; moeda?: boolean };

function escreverCabecalho(ws: ExcelJS.Worksheet, rel: Relatorio, titulo: string, ncol: number) {
  const c = rel.cabecalho;
  ws.mergeCells(1, 1, 1, ncol);
  const t = ws.getCell(1, 1);
  t.value = `CuraLog — ${titulo}`;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TITULO } };
  ws.getRow(1).height = 24;

  const linhas: [string, string][] = [
    ["Empresa", c.cnpj ? `${c.empresa} — CNPJ ${c.cnpj}` : c.empresa],
    ["Área", ROTULO_AREA[c.area]],
    ["Competência", `${competenciaExtenso(c.competencia)} (${dataBR(c.periodoInicio)} a ${dataBR(c.periodoFim)})`],
    ["Fechamento nº", `${c.numero} — emitido em ${dataBR(c.emitidoEm)}`],
  ];
  linhas.forEach(([rotulo, valor], i) => {
    const row = ws.getRow(2 + i);
    row.getCell(1).value = rotulo;
    row.getCell(1).font = { bold: true };
    ws.mergeCells(2 + i, 2, 2 + i, ncol);
    row.getCell(2).value = valor;
  });
  return 2 + linhas.length + 1;
}

function linhaTitulos(ws: ExcelJS.Worksheet, linha: number, colunas: Coluna[]) {
  const row = ws.getRow(linha);
  colunas.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    cell.value = col.titulo;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    cell.border = { bottom: { style: "thin" } };
    ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width ?? 0, col.largura);
  });
}

function destacar(row: ExcelJS.Row, ncol: number, cor = COR_SUBTOTAL) {
  for (let i = 1; i <= ncol; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } };
  }
}

export async function gerarExcel(rel: Relatorio): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CuraLog";
  wb.created = new Date();

  // --- Resumo ---
  const resumo = wb.addWorksheet("Resumo");
  let l = escreverCabecalho(resumo, rel, "Resumo do fechamento", 3);
  const colResumo: Coluna[] = [
    { titulo: "Serviço", largura: 34 },
    { titulo: "Quantidade", largura: 14 },
    { titulo: "Total", largura: 18, moeda: true },
  ];
  linhaTitulos(resumo, l++, colResumo);
  for (const s of rel.secoes) {
    const row = resumo.getRow(l++);
    row.values = [s.titulo, s.quantidade, s.total];
    row.getCell(3).numFmt = MOEDA;
  }
  const totalRow = resumo.getRow(l++);
  totalRow.values = ["TOTAL A PAGAR", rel.quantidade, rel.total];
  totalRow.getCell(3).numFmt = MOEDA;
  destacar(totalRow, 3, COR_CABECALHO);

  l++;
  linhaTitulos(resumo, l++, [
    { titulo: "Paciente", largura: 34 },
    { titulo: "Atendimentos", largura: 14 },
    { titulo: "Total", largura: 18 },
  ]);
  for (const p of rel.porPaciente) {
    const row = resumo.getRow(l++);
    row.values = [p.paciente, p.quantidade, p.total];
    row.getCell(3).numFmt = MOEDA;
  }

  // --- Uma aba por serviço / modal ---
  const logistica = rel.cabecalho.area === "logistica";
  const colunas: Coluna[] = [
    { titulo: "Paciente", largura: 30 },
    { titulo: "Data", largura: 12 },
    ...(logistica
      ? [
          { titulo: "Origem", largura: 24 },
          { titulo: "Destino", largura: 24 },
        ]
      : [{ titulo: "Horário", largura: 10 }]),
    { titulo: "Qtd", largura: 8 },
    { titulo: "Valor unitário", largura: 15, moeda: true },
    { titulo: "Total", largura: 15, moeda: true },
    { titulo: "Observações", largura: 30 },
  ];
  const n = colunas.length;

  for (const secao of rel.secoes) {
    const ws = wb.addWorksheet(secao.titulo.replace(/[\\/*?:[\]]/g, "").slice(0, 31));
    let linha = escreverCabecalho(ws, rel, secao.titulo, n);
    linhaTitulos(ws, linha++, colunas);
    ws.views = [{ state: "frozen", ySplit: linha - 1 }];

    for (const grupo of secao.pacientes) {
      for (const item of grupo.itens) {
        const row = ws.getRow(linha++);
        row.values = [
          grupo.paciente,
          dataBR(item.data),
          ...(logistica ? [item.origem ?? "", item.destino ?? ""] : [item.hora ?? ""]),
          item.quantidade,
          item.valorUnitario,
          item.valorTotal,
          item.observacoes ?? "",
        ];
        row.getCell(n - 2).numFmt = MOEDA;
        row.getCell(n - 1).numFmt = MOEDA;
      }
      const sub = ws.getRow(linha++);
      const vals: (string | number)[] = new Array(n).fill("");
      vals[0] = `Subtotal — ${grupo.paciente}`;
      vals[n - 4] = grupo.quantidade;
      vals[n - 2] = grupo.total;
      sub.values = vals;
      sub.getCell(n - 1).numFmt = MOEDA;
      destacar(sub, n);
    }
    const tot = ws.getRow(linha++);
    const vals: (string | number)[] = new Array(n).fill("");
    vals[0] = `TOTAL — ${secao.titulo}`;
    vals[n - 4] = secao.quantidade;
    vals[n - 2] = secao.total;
    tot.values = vals;
    tot.getCell(n - 1).numFmt = MOEDA;
    destacar(tot, n, COR_CABECALHO);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
