"use client";

import { useState } from "react";
import { useAcao } from "@/components/use-acao";
import { dosesPrevistas, FREQUENCIAS, horariosPorFrequencia, lerHorarios } from "@/lib/doses";
import type { PacienteOpcao } from "../lancamentos/lancamento-form";
import { salvarPlano } from "./actions";

type Item = { descricao: string; vezes: number; primeiro: string; horarios: string };

export type PlanoInicial = {
  id: number;
  pacienteId: number;
  tipo: "medicacao" | "curativo";
  inicioData: string;
  inicioHora: string;
  fimData: string | null;
  fimHora: string | null;
  valorUnitario: number | null;
  observacoes: string | null;
  ativo: boolean;
  itens: { descricao: string; horarios: string[] }[];
};

const novoItem = (tipo: "medicacao" | "curativo"): Item =>
  tipo === "curativo"
    ? { descricao: "Curativo", vezes: 1, primeiro: "08:00", horarios: "08:00" }
    : { descricao: "", vezes: 3, primeiro: "06:00", horarios: horariosPorFrequencia("06:00", 3).join(", ") };

function horariosValidos(texto: string): string[] | null {
  try {
    return lerHorarios(texto);
  } catch {
    return null;
  }
}

export function PlanoForm({ pacientes, hoje, inicial }: { pacientes: PacienteOpcao[]; hoje: string; inicial?: PlanoInicial }) {
  const [estado, enviar, pendente] = useAcao(salvarPlano);
  const [tipo, setTipo] = useState<"medicacao" | "curativo">(inicial?.tipo ?? "medicacao");
  const [inicioData, setInicioData] = useState(inicial?.inicioData ?? hoje);
  const [inicioHora, setInicioHora] = useState(inicial?.inicioHora ?? "06:00");
  const [fimData, setFimData] = useState(inicial?.fimData ?? "");
  const [fimHora, setFimHora] = useState(inicial?.fimHora ?? "06:00");
  const [itens, setItens] = useState<Item[]>(
    inicial?.itens.map((i) => ({ descricao: i.descricao, vezes: i.horarios.length, primeiro: i.horarios[0], horarios: i.horarios.join(", ") })) ?? [novoItem("medicacao")],
  );

  const alterar = (idx: number, mudanca: Partial<Item>) =>
    setItens((lista) =>
      lista.map((it, i) => {
        if (i !== idx) return it;
        const novo = { ...it, ...mudanca };
        if ((mudanca.vezes || mudanca.primeiro) && /^\d{2}:\d{2}$/.test(novo.primeiro)) {
          novo.horarios = horariosPorFrequencia(novo.primeiro, novo.vezes).join(", ");
        }
        return novo;
      }),
    );

  // Prévia: atendimentos por dia e total previsto até o término (ou nos próximos 30 dias).
  const itensValidos = itens.map((i) => ({ descricao: i.descricao, horarios: horariosValidos(i.horarios) ?? [] }));
  const porDia = itensValidos.reduce((s, i) => s + i.horarios.length, 0);
  let totalPrevisto: number | null = null;
  if (fimData && /^\d{2}:\d{2}$/.test(inicioHora)) {
    totalPrevisto = dosesPrevistas({ inicioData, inicioHora, fimData, fimHora, itens: itensValidos }, inicioData, fimData)
      .reduce((s, d) => s + d.doses.length, 0);
  }

  return (
    <form {...enviar} className="cartao max-w-4xl">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="itens" value={JSON.stringify(itens.map(({ descricao, horarios }) => ({ descricao, horarios })))} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="rotulo">Tipo de tratamento</span>
          <div className="flex gap-2">
            {(["medicacao", "curativo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={tipo === t ? "botao" : "botao-sec"}
                onClick={() => {
                  setTipo(t);
                  if (!inicial) setItens([novoItem(t)]);
                }}
              >
                {t === "medicacao" ? "Medicação" : "Curativo"}
              </button>
            ))}
          </div>
        </div>

        <label className="sm:col-span-2">
          <span className="rotulo">Paciente</span>
          <select name="pacienteId" className="campo" required defaultValue={inicial?.pacienteId ?? ""}>
            <option value="">Selecione…</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.empresa}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="rotulo">Valor por atendimento (vazio = tarifa do paciente)</span>
          <input name="valorUnitario" className="campo" inputMode="decimal" placeholder="usar tarifa"
            defaultValue={inicial?.valorUnitario != null ? inicial.valorUnitario.toFixed(2).replace(".", ",") : ""} />
        </label>

        <label>
          <span className="rotulo">Início — data</span>
          <input type="date" name="inicioData" className="campo" required value={inicioData} onChange={(e) => setInicioData(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Início — hora</span>
          <input type="time" name="inicioHora" className="campo" required value={inicioHora} onChange={(e) => setInicioHora(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Término — data (vazio = contínuo)</span>
          <input type="date" name="fimData" className="campo" value={fimData} onChange={(e) => setFimData(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Término — hora</span>
          <input type="time" name="fimHora" className="campo" value={fimHora} disabled={!fimData} onChange={(e) => setFimHora(e.target.value)} />
        </label>
      </div>

      <div className="mt-6">
        <p className="rotulo">{tipo === "medicacao" ? "Medicações e horários" : "Frequência do curativo"}</p>
        <div className="space-y-3">
          {itens.map((it, idx) => {
            const invalido = horariosValidos(it.horarios) === null;
            return (
              <div key={idx} className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-12">
                <input className="campo sm:col-span-3" placeholder={tipo === "medicacao" ? "Medicação (ex.: Ceftriaxona)" : "Descrição"}
                  value={it.descricao} onChange={(e) => alterar(idx, { descricao: e.target.value })} />
                <select className="campo sm:col-span-3" value={it.vezes} onChange={(e) => alterar(idx, { vezes: Number(e.target.value) })}>
                  {FREQUENCIAS.map((f) => <option key={f.vezes} value={f.vezes}>{f.rotulo}</option>)}
                </select>
                <input type="time" className="campo sm:col-span-2" title="Primeiro horário" value={it.primeiro}
                  onChange={(e) => alterar(idx, { primeiro: e.target.value })} />
                <input className={`campo sm:col-span-3 ${invalido ? "border-red-400" : ""}`} title="Horários (pode editar)"
                  value={it.horarios} onChange={(e) => alterar(idx, { horarios: e.target.value })} />
                <button type="button" className="text-sm text-red-700 hover:underline sm:col-span-1 disabled:opacity-30"
                  disabled={itens.length === 1} onClick={() => setItens((l) => l.filter((_, i) => i !== idx))}>
                  Remover
                </button>
              </div>
            );
          })}
        </div>
        {tipo === "medicacao" && (
          <button type="button" className="botao-sec mt-3" onClick={() => setItens((l) => [...l, novoItem("medicacao")])}>
            + Medicação
          </button>
        )}
      </div>

      <label className="mt-4 block">
        <span className="rotulo">Observações</span>
        <input name="observacoes" className="campo" defaultValue={inicial?.observacoes ?? ""} />
      </label>
      {inicial && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={inicial.ativo} /> Ativo (desmarque para encerrar e esconder das pendências)
        </label>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-600">
          <strong className="text-lg text-gray-900">{porDia}</strong> atendimento(s) por dia
          {totalPrevisto !== null && <> · <strong>{totalPrevisto}</strong> previstos no total</>}
        </p>
        <button className="botao ml-auto" disabled={pendente}>{pendente ? "Salvando…" : "Salvar tratamento"}</button>
      </div>
      {estado.erro && <p className="mt-3 text-sm text-red-700">{estado.erro}</p>}
    </form>
  );
}
