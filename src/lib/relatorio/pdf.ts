import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { competenciaExtenso, dataBR, moeda } from "../formato";
import { ROTULO_AREA } from "../dominio";
import type { Relatorio } from "./modelo";

const COR_TITULO: [number, number, number] = [15, 118, 110];
const COR_SUBTOTAL: [number, number, number] = [243, 244, 246];

// As fontes padrão do PDF não têm travessão; trocamos por hífen.
const txt = (s: string) => s.replace(/—/g, "-");

type DocComTabela = jsPDF & { lastAutoTable?: { finalY: number } };

export function gerarPdf(rel: Relatorio): Buffer {
  const doc: DocComTabela = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const c = rel.cabecalho;
  const largura = doc.internal.pageSize.getWidth();
  const logistica = c.area === "logistica";

  doc.setFillColor(...COR_TITULO);
  doc.rect(0, 0, largura, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`CuraLog - Relatório de serviços (${ROTULO_AREA[c.area]})`, 12, 12);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  const info = [
    `Empresa: ${c.empresa}${c.cnpj ? ` - CNPJ ${c.cnpj}` : ""}`,
    `Competência: ${competenciaExtenso(c.competencia)} (${dataBR(c.periodoInicio)} a ${dataBR(c.periodoFim)})`,
    `Fechamento nº ${c.numero} - emitido em ${dataBR(c.emitidoEm)}`,
  ];
  doc.setFont("helvetica", "normal");
  info.forEach((linha, i) => doc.text(txt(linha), 12, 26 + i * 5));

  // Resumo
  autoTable(doc, {
    startY: 42,
    head: [["Serviço", "Quantidade", "Total"]],
    body: [
      ...rel.secoes.map((s) => [txt(s.titulo), String(s.quantidade), moeda(s.total)]),
      [
        { content: "TOTAL A PAGAR", styles: { fontStyle: "bold" } },
        { content: String(rel.quantidade), styles: { fontStyle: "bold" } },
        { content: moeda(rel.total), styles: { fontStyle: "bold" } },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: COR_TITULO },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    tableWidth: 140,
    margin: { left: 12 },
  });

  for (const secao of rel.secoes) {
    const head = [
      "Paciente",
      "Data",
      ...(logistica ? ["Origem", "Destino"] : ["Horário"]),
      "Qtd",
      "Valor unit.",
      "Total",
      "Observações",
    ];
    const ncol = head.length;
    const body: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
    for (const g of secao.pacientes) {
      for (const i of g.itens) {
        body.push([
          g.paciente,
          dataBR(i.data),
          ...(logistica ? [i.origem ?? "", i.destino ?? ""] : [i.hora ?? ""]),
          String(i.quantidade),
          moeda(i.valorUnitario),
          moeda(i.valorTotal),
          i.observacoes ?? "",
        ]);
      }
      const estilo = { fontStyle: "bold", fillColor: COR_SUBTOTAL };
      body.push([
        { content: `Subtotal - ${g.paciente}`, colSpan: ncol - 4, styles: estilo },
        { content: String(g.quantidade), styles: { ...estilo, halign: "right" } },
        { content: "", styles: estilo },
        { content: moeda(g.total), styles: { ...estilo, halign: "right" } },
        { content: "", styles: estilo },
      ]);
    }

    const y = (doc.lastAutoTable?.finalY ?? 60) + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(txt(`${secao.titulo} - ${secao.quantidade} atendimento(s) - ${moeda(secao.total)}`), 12, y);

    autoTable(doc, {
      startY: y + 3,
      head: [head],
      body,
      theme: "striped",
      headStyles: { fillColor: COR_TITULO },
      styles: { fontSize: 8.5 },
      columnStyles: {
        [ncol - 4]: { halign: "right" },
        [ncol - 3]: { halign: "right" },
        [ncol - 2]: { halign: "right" },
      },
      margin: { left: 12, right: 12 },
    });
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${p} de ${paginas}`, largura - 12, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
