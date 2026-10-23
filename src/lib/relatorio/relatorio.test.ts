import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { periodoDaCompetencia, somarDias } from "../formato";
import { gerarExcel } from "./excel";
import { montarRelatorio, nomeArquivoRelatorio, type CabecalhoRelatorio, type ItemRelatorio } from "./modelo";
import { gerarPdf } from "./pdf";

const item = (i: Partial<ItemRelatorio> & Pick<ItemRelatorio, "pacienteNome" | "tipo" | "data">): ItemRelatorio => ({
  modal: null,
  hora: null,
  origem: null,
  destino: null,
  quantidade: 1,
  valorUnitario: 55,
  valorTotal: 55,
  observacoes: null,
  ...i,
});

const cab = (area: "enfermagem" | "logistica"): CabecalhoRelatorio => ({
  empresa: "Saúde & Cia Ltda",
  cnpj: "00.000.000/0001-00",
  area,
  competencia: "2026-10",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-10-31",
  numero: 12,
  emitidoEm: "2026-11-01",
});

const enfermagem = [
  item({ pacienteNome: "Maria", tipo: "medicacao", data: "2026-10-02", quantidade: 5, valorTotal: 275 }),
  item({ pacienteNome: "Maria", tipo: "medicacao", data: "2026-10-01", quantidade: 5, valorTotal: 275 }),
  item({ pacienteNome: "João", tipo: "curativo", data: "2026-10-03", valorUnitario: 45, valorTotal: 45 }),
  item({ pacienteNome: "Ana", tipo: "coleta", data: "2026-10-20" }),
  item({ pacienteNome: "Bruno", tipo: "coleta", data: "2026-10-20" }),
  item({ pacienteNome: "Carla", tipo: "coleta", data: "2026-10-20", valorUnitario: 60, valorTotal: 60 }),
];

describe("montarRelatorio", () => {
  it("separa enfermagem por serviço e soma por paciente", () => {
    const r = montarRelatorio(cab("enfermagem"), enfermagem);
    expect(r.secoes.map((s) => s.chave)).toEqual(["medicacao", "curativo", "coleta"]);
    const med = r.secoes[0];
    expect(med.pacientes[0].paciente).toBe("Maria");
    expect(med.pacientes[0].quantidade).toBe(10);
    expect(med.pacientes[0].total).toBe(550);
    expect(med.pacientes[0].itens.map((i) => i.data)).toEqual(["2026-10-01", "2026-10-02"]);
    const coletas = r.secoes[2];
    expect(coletas.quantidade).toBe(3);
    expect(coletas.total).toBe(170);
    expect(r.total).toBe(765);
    expect(r.quantidade).toBe(14);
    expect(r.porPaciente.map((p) => p.paciente)).toEqual(["Ana", "Bruno", "Carla", "João", "Maria"]);
  });

  it("separa logística por modal", () => {
    const r = montarRelatorio(cab("logistica"), [
      item({ pacienteNome: "Maria", tipo: "corrida", modal: "carro", data: "2026-10-05", valorUnitario: 45, valorTotal: 45 }),
      item({ pacienteNome: "Maria", tipo: "corrida", modal: "moto", data: "2026-10-05", valorUnitario: 25, valorTotal: 25 }),
      item({ pacienteNome: "José", tipo: "corrida", modal: "terceirizado", data: "2026-10-06", valorUnitario: 130, valorTotal: 130 }),
    ]);
    expect(r.secoes.map((s) => s.chave)).toEqual(["moto", "carro", "terceirizado"]);
    expect(r.total).toBe(200);
  });

  it("gera nome de arquivo sem acentos ou símbolos", () => {
    expect(nomeArquivoRelatorio(cab("enfermagem"), "xlsx")).toBe("CuraLog_2026-10_Saude-Cia-Ltda_Enfermagem.xlsx");
  });
});

describe("arquivos", () => {
  it("gera Excel com aba de resumo e uma aba por serviço", async () => {
    const buf = await gerarExcel(montarRelatorio(cab("enfermagem"), enfermagem));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Medicações", "Curativos", "Coletas de exames"]);
    const resumo = wb.getWorksheet("Resumo")!;
    const linhaTotal = resumo.getSheetValues().find((r) => Array.isArray(r) && r[1] === "TOTAL A PAGAR") as unknown[];
    expect(linhaTotal[3]).toBe(765);
  });

  it("gera PDF válido", () => {
    const buf = gerarPdf(montarRelatorio(cab("logistica"), [
      item({ pacienteNome: "Maria", tipo: "corrida", modal: "moto", data: "2026-10-05", origem: "Casa", destino: "Hospital", valorUnitario: 25, valorTotal: 25 }),
    ]));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe("datas", () => {
  it("calcula período do mês, inclusive fevereiro bissexto", () => {
    expect(periodoDaCompetencia("2026-10")).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(periodoDaCompetencia("2028-02").fim).toBe("2028-02-29");
  });

  it("soma dias para o vencimento", () => {
    expect(somarDias("2026-10-15", 30)).toBe("2026-11-14");
  });
});
