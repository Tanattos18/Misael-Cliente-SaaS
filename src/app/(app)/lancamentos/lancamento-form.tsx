"use client";

import { useState, useTransition } from "react";
import { useAcao } from "@/components/use-acao";
import { ROTULO_MODAL, ROTULO_TIPO, TIPOS_ENFERMAGEM, type Area, type Modal, type Tipo } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { valorTerceirizado } from "@/lib/tarifas";
import { salvarLancamento, sugerirValor } from "./actions";

export type PacienteOpcao = { id: number; nome: string; empresa: string; regiao: string | null };

export type LancamentoInicial = {
  id: number;
  tipo: Tipo;
  pacienteId: number;
  data: string;
  hora: string | null;
  quantidade: number;
  valorUnitario: number;
  modal: Modal | null;
  origem: string | null;
  destino: string | null;
  custoTerceiro: number | null;
  percentualAcrescimo: number | null;
  observacoes: string | null;
};

type Props = {
  area: Area;
  pacientes: PacienteOpcao[];
  hoje: string;
  acrescimoPadrao: number;
  inicial?: LancamentoInicial;
  bloqueado?: boolean;
};

const brl = (n: number) => n.toFixed(2).replace(".", ",");
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

export function LancamentoForm({ area, pacientes, hoje, acrescimoPadrao, inicial, bloqueado }: Props) {
  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? (area === "logistica" ? "corrida" : "medicacao"));
  const [modal, setModal] = useState<Modal>(inicial?.modal ?? "moto");
  const [pacienteId, setPacienteId] = useState(inicial ? String(inicial.pacienteId) : "");
  const [data, setData] = useState(inicial?.data ?? hoje);
  const [hora, setHora] = useState(inicial?.hora ?? "");
  const [quantidade, setQuantidade] = useState(String(inicial?.quantidade ?? 1));
  const [valor, setValor] = useState(inicial ? brl(inicial.valorUnitario) : "");
  const [origemTarifa, setOrigemTarifa] = useState("");
  const [custo, setCusto] = useState(inicial?.custoTerceiro != null ? brl(inicial.custoTerceiro) : "");
  const [pct, setPct] = useState(String(inicial?.percentualAcrescimo ?? acrescimoPadrao));
  const [origem, setOrigem] = useState(inicial?.origem ?? "");
  const [destino, setDestino] = useState(inicial?.destino ?? "");
  const [obs, setObs] = useState(inicial?.observacoes ?? "");

  const [estado, enviar, pendente] = useAcao(async (anterior, formData) => {
    const r = await salvarLancamento(anterior, formData);
    // Depois de lançar, limpa o paciente e mantém data/serviço para o próximo lançamento.
    if (r.ok && !inicial) {
      setPacienteId("");
      setValor("");
      setOrigemTarifa("");
      setObs("");
      setOrigem("");
      setDestino("");
      setCusto("");
      setQuantidade("1");
    }
    return r;
  });
  const [, iniciar] = useTransition();

  const terceirizado = tipo === "corrida" && modal === "terceirizado";
  const paciente = pacientes.find((p) => String(p.id) === pacienteId);

  function buscarTarifa(novoPaciente: string, novoTipo: Tipo, novoModal: Modal) {
    if (!novoPaciente || (novoTipo === "corrida" && novoModal === "terceirizado")) return;
    iniciar(async () => {
      const t = await sugerirValor(Number(novoPaciente), novoTipo, novoTipo === "corrida" ? novoModal : null);
      setValor(t ? brl(t.valor) : "");
      setOrigemTarifa(t ? t.origem : "sem tarifa cadastrada — informe o valor");
    });
  }

  const unitario = terceirizado ? valorTerceirizado(num(custo), num(pct)) : num(valor);
  const total = unitario * (Number(quantidade) || 0);

  return (
    <form {...enviar} className="cartao max-w-4xl">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {area === "enfermagem" ? (
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="rotulo">Serviço</span>
            <div className="flex flex-wrap gap-2">
              {TIPOS_ENFERMAGEM.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => { setTipo(t); buscarTarifa(pacienteId, t, modal); }}
                  className={tipo === t ? "botao" : "botao-sec"}
                >
                  {ROTULO_TIPO[t]}
                </button>
              ))}
            </div>
          </label>
        ) : (
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="rotulo">Modal</span>
            <div className="flex flex-wrap gap-2">
              {(["moto", "carro", "terceirizado"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => { setModal(m); buscarTarifa(pacienteId, "corrida", m); }}
                  className={modal === m ? "botao" : "botao-sec"}
                >
                  {ROTULO_MODAL[m]}
                </button>
              ))}
            </div>
            <input type="hidden" name="modal" value={modal} />
          </label>
        )}

        <label className="sm:col-span-2">
          <span className="rotulo">Paciente</span>
          <select
            name="pacienteId"
            className="campo"
            required
            value={pacienteId}
            onChange={(e) => { setPacienteId(e.target.value); buscarTarifa(e.target.value, tipo, modal); }}
          >
            <option value="">Selecione…</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          {paciente && (
            <span className="mt-1 block text-xs text-gray-500">
              {paciente.empresa}{paciente.regiao ? ` · ${paciente.regiao}` : ""}
            </span>
          )}
        </label>
        <label>
          <span className="rotulo">Data</span>
          <input type="date" name="data" className="campo" required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        {area === "enfermagem" ? (
          <label>
            <span className="rotulo">Horário (opcional)</span>
            <input type="time" name="hora" className="campo" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        ) : (
          <label>
            <span className="rotulo">Quantidade de corridas</span>
            <input type="number" min={1} name="quantidade" className="campo" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
        )}

        {area === "logistica" && (
          <>
            <label className="sm:col-span-2">
              <span className="rotulo">Origem</span>
              <input name="origem" className="campo" value={origem} onChange={(e) => setOrigem(e.target.value)} />
            </label>
            <label className="sm:col-span-2">
              <span className="rotulo">Destino</span>
              <input name="destino" className="campo" value={destino} onChange={(e) => setDestino(e.target.value)} />
            </label>
          </>
        )}

        {area === "enfermagem" && (
          <label>
            <span className="rotulo">Quantidade</span>
            <input type="number" min={1} name="quantidade" className="campo" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
        )}

        {terceirizado ? (
          <>
            <label>
              <span className="rotulo">Custo da transportadora (R$)</span>
              <input name="custoTerceiro" className="campo" inputMode="decimal" required value={custo} onChange={(e) => setCusto(e.target.value)} />
            </label>
            <label>
              <span className="rotulo">Acréscimo (%)</span>
              <input name="percentualAcrescimo" className="campo" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            </label>
          </>
        ) : (
          <label>
            <span className="rotulo">Valor unitário (R$)</span>
            <input name="valorUnitario" className="campo" inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setOrigemTarifa("alterado manualmente"); }} />
            {origemTarifa && <span className="mt-1 block text-xs text-gray-500">{origemTarifa}</span>}
          </label>
        )}

        <label className="sm:col-span-2 lg:col-span-4">
          <span className="rotulo">Observações</span>
          <input name="observacoes" className="campo" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-600">
          {terceirizado && <>Cobrado por corrida: <strong>{moeda(unitario)}</strong> · </>}
          Total: <strong className="text-lg text-gray-900">{moeda(total)}</strong>
        </p>
        {!bloqueado && (
          <button className="botao ml-auto" disabled={pendente}>
            {pendente ? "Salvando…" : inicial ? "Salvar alterações" : "Lançar"}
          </button>
        )}
      </div>
      {estado.erro && (
        <p className="mt-3 text-sm text-red-700">
          {estado.erro}{" "}
          {estado.link && <a href={estado.link} className="link">Abrir a conferência do tratamento</a>}
        </p>
      )}
      {estado.confirmar === "extra" && (
        <label className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" name="confirmarExtra" value="1" />
          Confirmo que é um atendimento extra, fora da prescrição do tratamento.
        </label>
      )}
      {estado.ok && <p className="mt-3 text-sm text-teal-700">✓ {estado.ok}</p>}
    </form>
  );
}
