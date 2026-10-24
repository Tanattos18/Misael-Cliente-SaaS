"use client";

import { useState } from "react";
import { useAcao } from "@/components/use-acao";
import {
  AREAS_DESPESA,
  CATEGORIAS_DESPESA,
  ROTULO_AREA_DESPESA,
  ROTULO_CATEGORIA,
  ROTULO_MODAL,
  type AreaDespesa,
  type CategoriaDespesa,
} from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { salvarDespesa } from "./actions";

type VeiculoOpcao = { id: number; descricao: string; modal: "moto" | "carro"; uso: "logistica" | "enfermagem" };

export type DespesaInicial = {
  id: number;
  data: string;
  categoria: CategoriaDespesa;
  descricao: string | null;
  valor: number;
  area: AreaDespesa;
  modal: "moto" | "carro" | "terceirizado" | null;
  veiculoId: number | null;
  litros: number | null;
  km: number | null;
};

const brl = (n: number) => n.toFixed(2).replace(".", ",");
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const VEICULARES: CategoriaDespesa[] = ["combustivel", "manutencao", "oleo_pneus_pecas"];

export function DespesaForm({ veiculos, hoje, inicial, bloqueado }: { veiculos: VeiculoOpcao[]; hoje: string; inicial?: DespesaInicial; bloqueado?: boolean }) {
  const [categoria, setCategoria] = useState<CategoriaDespesa>(inicial?.categoria ?? "combustivel");
  const [veiculoId, setVeiculoId] = useState(inicial?.veiculoId ? String(inicial.veiculoId) : "");
  const [area, setArea] = useState<AreaDespesa>(inicial?.area ?? "logistica");
  const [modal, setModal] = useState(inicial?.modal ?? "");
  const [data, setData] = useState(inicial?.data ?? hoje);
  const [valor, setValor] = useState(inicial ? brl(inicial.valor) : "");
  const [litros, setLitros] = useState(inicial?.litros != null ? brl(inicial.litros) : "");
  const [km, setKm] = useState(inicial?.km != null ? String(inicial.km) : "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");

  const [estado, enviar, pendente] = useAcao(async (anterior, formData) => {
    const r = await salvarDespesa(anterior, formData);
    if (r.ok) {
      setValor("");
      setLitros("");
      setKm("");
      setDescricao("");
    }
    return r;
  });

  const veiculo = VEICULARES.includes(categoria) ? veiculos.find((v) => String(v.id) === veiculoId) : undefined;
  const precoLitro = categoria === "combustivel" && num(litros) > 0 ? num(valor) / num(litros) : null;

  return (
    <form {...enviar} className="cartao max-w-4xl">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="rotulo">Categoria</span>
          <select
            name="categoria"
            className="campo"
            value={categoria}
            onChange={(e) => {
              const c = e.target.value as CategoriaDespesa;
              setCategoria(c);
              if (c === "terceirizado") { setArea("logistica"); setModal("terceirizado"); setVeiculoId(""); }
              if (c === "outras" && !veiculoId) setArea("geral");
            }}
          >
            {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}
          </select>
        </label>
        <label>
          <span className="rotulo">Data</span>
          <input type="date" name="data" className="campo" required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          <span className="rotulo">Valor (R$)</span>
          <input name="valor" className="campo" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>

        {VEICULARES.includes(categoria) && (
          <label className="sm:col-span-2">
            <span className="rotulo">Veículo</span>
            <select name="veiculoId" className="campo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
              <option value="">— sem veículo —</option>
              {veiculos.map((v) => <option key={v.id} value={v.id}>{v.descricao}</option>)}
            </select>
          </label>
        )}
        {categoria === "combustivel" && (
          <>
            <label>
              <span className="rotulo">Litros</span>
              <input name="litros" className="campo" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} />
              {precoLitro && <span className="mt-1 block text-xs text-gray-500">{moeda(precoLitro)} por litro</span>}
            </label>
            <label>
              <span className="rotulo">Km (hodômetro)</span>
              <input name="km" type="number" min={0} className="campo" value={km} onChange={(e) => setKm(e.target.value)} />
            </label>
          </>
        )}

        {veiculo ? (
          <p className="text-sm text-gray-600 sm:col-span-2 lg:col-span-4">
            Custo apropriado em{" "}
            <strong>{veiculo.uso === "logistica" ? `Logística · ${ROTULO_MODAL[veiculo.modal]}` : "Enfermagem"}</strong> (pelo uso do veículo).
          </p>
        ) : (
          <>
            <label>
              <span className="rotulo">Área do custo</span>
              <select name="area" className="campo" value={area} onChange={(e) => setArea(e.target.value as AreaDespesa)}>
                {AREAS_DESPESA.map((a) => <option key={a} value={a}>{ROTULO_AREA_DESPESA[a]}</option>)}
              </select>
            </label>
            {area === "logistica" && (
              <label>
                <span className="rotulo">Modal</span>
                <select name="modal" className="campo" value={modal} onChange={(e) => setModal(e.target.value as typeof modal)}>
                  <option value="">Todos / não se aplica</option>
                  <option value="moto">Moto</option>
                  <option value="carro">Carro</option>
                  <option value="terceirizado">Terceirizado</option>
                </select>
              </label>
            )}
          </>
        )}
        {veiculo && <input type="hidden" name="area" value={veiculo.uso} />}

        <label className="sm:col-span-2 lg:col-span-4">
          <span className="rotulo">Descrição</span>
          <input name="descricao" className="campo" placeholder="Ex.: Posto BR — gasolina comum" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </fieldset>

      {!bloqueado && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          {inicial ? (
            <button className="botao" disabled={pendente}>{pendente ? "Salvando…" : "Salvar alterações"}</button>
          ) : (
            <>
              <button className="botao" name="continuar" value="1" disabled={pendente}>{pendente ? "Salvando…" : "Lançar e continuar"}</button>
              <button className="botao-sec" disabled={pendente}>Lançar e voltar à lista</button>
            </>
          )}
          {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
          {estado.ok && <p className="text-sm text-teal-700">✓ {estado.ok}</p>}
        </div>
      )}
    </form>
  );
}
