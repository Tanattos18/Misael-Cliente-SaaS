"use client";

import { useActionState, useState } from "react";
import type { EstadoAcao } from "@/lib/form";
import { Selo } from "@/components/ui";
import { salvarConferencia } from "../../actions";

type Dia = {
  data: string;
  rotuloData: string;
  horarios: string[];
  realizadas: number | null;
  cancelado: boolean;
  bloqueado: boolean;
  futuro: boolean;
};

export function ConferenciaForm({ planoId, dias }: { planoId: number; dias: Dia[] }) {
  const [estado, formAction, pendente] = useActionState<EstadoAcao, FormData>(salvarConferencia, {});
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(dias.map((d) => [d.data, d.realizadas === null ? "" : String(d.realizadas)])),
  );

  const preencherPendentes = () =>
    setValores((v) => {
      const novo = { ...v };
      for (const d of dias) if (!d.futuro && !d.bloqueado && novo[d.data] === "") novo[d.data] = String(d.horarios.length);
      return novo;
    });

  return (
    <form action={formAction} className="cartao overflow-x-auto p-0">
      <input type="hidden" name="planoId" value={planoId} />
      <table className="tabela">
        <thead>
          <tr><th>Data</th><th>Horários previstos</th><th className="text-right">Previstos</th><th className="w-32">Realizados</th><th>Situação</th></tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const v = valores[d.data];
            const n = v === "" ? null : Number(v);
            const situacao = d.bloqueado ? <Selo tipo="fechado">Fechado</Selo>
              : d.futuro ? <Selo tipo="previsto">Futuro</Selo>
              : n === null ? <Selo tipo="em_atraso">Pendente</Selo>
              : n === 0 ? <Selo tipo="cancelado">Não realizado</Selo>
              : n < d.horarios.length ? <Selo tipo="nf_emitida">Parcial</Selo>
              : <Selo tipo="realizado">Realizado</Selo>;
            return (
              <tr key={d.data}>
                <td className="whitespace-nowrap">{d.rotuloData}</td>
                <td className="text-xs text-gray-600">{d.horarios.join(" · ") || "—"}</td>
                <td className="text-right">{d.horarios.length}</td>
                <td>
                  <input
                    name={`q_${d.data}`}
                    type="number"
                    min={0}
                    max={100}
                    className="campo py-1"
                    value={v}
                    disabled={d.bloqueado || d.futuro}
                    onChange={(e) => setValores((x) => ({ ...x, [d.data]: e.target.value }))}
                  />
                </td>
                <td>{situacao}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" className="botao-sec" onClick={preencherPendentes}>Preencher pendentes com o previsto</button>
        <button className="botao" disabled={pendente}>{pendente ? "Salvando…" : "Salvar conferência"}</button>
        {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
        {estado.ok && <p className="text-sm text-teal-700">{estado.ok}</p>}
      </div>
    </form>
  );
}
