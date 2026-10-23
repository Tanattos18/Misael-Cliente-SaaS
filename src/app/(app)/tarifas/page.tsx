import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { ROTULO_MODAL, ROTULO_TIPO, TIPOS } from "@/lib/dominio";
import { moeda } from "@/lib/formato";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo, Vazio } from "@/components/ui";
import { criarTarifa, desativarTarifa } from "./actions";

export default async function TarifasPage({ searchParams }: PageProps<"/tarifas">) {
  await exigirUsuario();
  const sp = await searchParams;
  const pacienteFiltro = Number(sp.paciente) || undefined;
  const db = await getDb();

  const p = alias(schema.pacientes, "p");
  const [tarifas, regioes, empresas, pacientes] = await Promise.all([
    db
      .select({
        id: schema.tarifas.id,
        tipo: schema.tarifas.tipo,
        modal: schema.tarifas.modal,
        valor: schema.tarifas.valor,
        pacienteId: schema.tarifas.pacienteId,
        regiao: schema.regioes.nome,
        empresa: schema.empresas.nome,
        paciente: p.nome,
      })
      .from(schema.tarifas)
      .leftJoin(schema.regioes, eq(schema.regioes.id, schema.tarifas.regiaoId))
      .leftJoin(schema.empresas, eq(schema.empresas.id, schema.tarifas.empresaId))
      .leftJoin(p, eq(p.id, schema.tarifas.pacienteId))
      .where(eq(schema.tarifas.ativo, true))
      .orderBy(asc(schema.tarifas.tipo), asc(schema.regioes.nome), asc(schema.tarifas.modal)),
    db.select().from(schema.regioes).where(eq(schema.regioes.ativo, true)).orderBy(asc(schema.regioes.nome)),
    db.select().from(schema.empresas).where(eq(schema.empresas.ativo, true)).orderBy(asc(schema.empresas.nome)),
    db.select().from(schema.pacientes).where(eq(schema.pacientes.ativo, true)).orderBy(asc(schema.pacientes.nome)),
  ]);
  const lista = pacienteFiltro ? tarifas.filter((t) => t.pacienteId === pacienteFiltro) : tarifas;

  return (
    <>
      <Cabecalho
        titulo="Tarifas"
        descricao="Ao lançar, vale a tarifa mais específica: paciente › empresa › região › padrão. O valor pode ser alterado no lançamento."
      />

      <ActionForm action={criarTarifa} className="cartao mb-6" botao="Adicionar tarifa">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Campo rotulo="Serviço">
            <select name="tipo" className="campo" required>
              {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Modal (corrida)">
            <select name="modal" className="campo">
              <option value="">Qualquer</option>
              <option value="moto">Moto</option>
              <option value="carro">Carro</option>
            </select>
          </Campo>
          <Campo rotulo="Região (corrida)">
            <select name="regiaoId" className="campo">
              <option value="">Todas</option>
              {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Empresa">
            <select name="empresaId" className="campo">
              <option value="">Todas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Paciente">
            <select name="pacienteId" className="campo" defaultValue={pacienteFiltro ?? ""}>
              <option value="">Todos</option>
              {pacientes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor (R$)">
            <input name="valor" className="campo" inputMode="decimal" placeholder="0,00" required />
          </Campo>
        </div>
      </ActionForm>

      <div className="cartao overflow-x-auto p-0">
        {lista.length === 0 ? (
          <Vazio>Nenhuma tarifa.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Serviço</th><th>Modal</th><th>Região</th><th>Empresa</th><th>Paciente</th><th className="text-right">Valor</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td>{ROTULO_TIPO[t.tipo]}</td>
                  <td>{t.modal ? ROTULO_MODAL[t.modal] : "—"}</td>
                  <td>{t.regiao ?? "—"}</td>
                  <td>{t.empresa ?? "—"}</td>
                  <td>{t.paciente ?? "—"}</td>
                  <td className="text-right font-medium">{moeda(t.valor)}</td>
                  <td className="text-right">
                    <form action={desativarTarifa}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-xs text-red-700 hover:underline">Remover</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
