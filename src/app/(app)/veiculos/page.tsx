import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Selo } from "@/components/ui";
import { alternarVeiculo, criarVeiculo } from "../despesas/actions";

export default async function VeiculosPage() {
  await exigirUsuario();
  const db = await getDb();
  const D = schema.despesas;
  const veiculos = await db
    .select({
      v: schema.veiculos,
      gasto: sql<number>`coalesce(sum(${D.valor}) filter (where ${D.status} = 'ativa'), 0)::float`,
      litros: sql<number>`coalesce(sum(${D.litros}) filter (where ${D.status} = 'ativa' and ${D.categoria} = 'combustivel'), 0)::float`,
      combustivel: sql<number>`coalesce(sum(${D.valor}) filter (where ${D.status} = 'ativa' and ${D.categoria} = 'combustivel'), 0)::float`,
    })
    .from(schema.veiculos)
    .leftJoin(D, eq(D.veiculoId, schema.veiculos.id))
    .groupBy(schema.veiculos.id)
    .orderBy(asc(schema.veiculos.descricao));

  return (
    <>
      <Cabecalho titulo="Veículos" descricao="Despesas lançadas com veículo vão para a área que usa o veículo (na logística, também para o modal dele)." />
      <ActionForm action={criarVeiculo} className="cartao mb-6 max-w-4xl" botao="Cadastrar veículo">
        <div className="grid gap-4 sm:grid-cols-4">
          <Campo rotulo="Descrição"><input name="descricao" className="campo" placeholder="Ex.: Moto Honda CG 160" required /></Campo>
          <Campo rotulo="Placa"><input name="placa" className="campo" /></Campo>
          <Campo rotulo="Modal">
            <select name="modal" className="campo">
              <option value="moto">Moto</option>
              <option value="carro">Carro</option>
            </select>
          </Campo>
          <Campo rotulo="Usado por">
            <select name="uso" className="campo">
              <option value="logistica">Logística (corridas)</option>
              <option value="enfermagem">Enfermagem (visitas)</option>
            </select>
          </Campo>
        </div>
      </ActionForm>
      <div className="cartao overflow-x-auto p-0">
        <table className="tabela">
          <thead>
            <tr><th>Veículo</th><th>Placa</th><th>Modal</th><th>Usado por</th><th className="text-right">Gasto total</th><th className="text-right">Combustível</th><th className="text-right">Preço médio/L</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {veiculos.map(({ v, gasto, litros, combustivel }) => (
              <tr key={v.id}>
                <td>{v.descricao}</td>
                <td>{v.placa}</td>
                <td>{v.modal === "moto" ? "Moto" : "Carro"}</td>
                <td>{v.uso === "logistica" ? "Logística" : "Enfermagem"}</td>
                <td className="text-right">{moeda(gasto)}</td>
                <td className="text-right">{moeda(combustivel)}{litros ? ` · ${litros.toLocaleString("pt-BR")} L` : ""}</td>
                <td className="text-right">{litros ? moeda(combustivel / litros) : "—"}</td>
                <td>{v.ativo ? <Selo tipo="realizado">Ativo</Selo> : <Selo tipo="cancelado">Inativo</Selo>}</td>
                <td className="text-right">
                  <form action={alternarVeiculo}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="ativo" value={String(!v.ativo)} />
                    <button className="text-xs text-teal-700 hover:underline">{v.ativo ? "Desativar" : "Ativar"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
