import Link from "next/link";
import { and, asc, between, desc, eq, ilike, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesEmpresas } from "@/lib/consultas";
import { AREAS, ROTULO_AREA, ROTULO_MODAL, ROTULO_TIPO, TIPOS, type Area, type Tipo } from "@/lib/dominio";
import { centavos, competenciaAtual, dataBR, moeda, periodoDaCompetencia } from "@/lib/formato";
import { Cabecalho, Selo, Vazio } from "@/components/ui";

export default async function LancamentosPage({ searchParams }: PageProps<"/lancamentos">) {
  await exigirUsuario();
  const sp = await searchParams;
  const texto = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const competencia = /^\d{4}-\d{2}$/.test(texto("mes")) ? texto("mes") : competenciaAtual();
  const empresaId = Number(texto("empresa")) || undefined;
  const area = (AREAS as readonly string[]).includes(texto("area")) ? (texto("area") as Area) : undefined;
  const tipo = (TIPOS as readonly string[]).includes(texto("tipo")) ? (texto("tipo") as Tipo) : undefined;
  const paciente = texto("paciente");
  const verCancelados = texto("cancelados") === "1";

  const { inicio, fim } = periodoDaCompetencia(competencia);
  const L = schema.lancamentos;
  const filtros: SQL[] = [between(L.data, inicio, fim)];
  if (empresaId) filtros.push(eq(L.empresaId, empresaId));
  if (area) filtros.push(eq(L.area, area));
  if (tipo) filtros.push(eq(L.tipo, tipo));
  if (paciente) filtros.push(ilike(schema.pacientes.nome, `%${paciente}%`));
  if (!verCancelados) filtros.push(eq(L.status, "realizado"));

  const db = await getDb();
  const [linhas, empresas] = await Promise.all([
    db
      .select({
        id: L.id,
        data: L.data,
        hora: L.hora,
        tipo: L.tipo,
        modal: L.modal,
        quantidade: L.quantidade,
        valorUnitario: L.valorUnitario,
        valorTotal: L.valorTotal,
        status: L.status,
        fechamentoId: L.fechamentoId,
        paciente: schema.pacientes.nome,
        empresa: schema.empresas.nome,
      })
      .from(L)
      .innerJoin(schema.pacientes, eq(schema.pacientes.id, L.pacienteId))
      .innerJoin(schema.empresas, eq(schema.empresas.id, L.empresaId))
      .where(and(...filtros))
      .orderBy(desc(L.data), asc(schema.pacientes.nome))
      .limit(1000),
    opcoesEmpresas(db),
  ]);

  const validos = linhas.filter((l) => l.status === "realizado");
  const total = centavos(validos.reduce((s, l) => s + l.valorTotal, 0));
  const qtd = validos.reduce((s, l) => s + l.quantidade, 0);

  return (
    <>
      <Cabecalho
        titulo="Lançamentos"
        acoes={
          <>
            <Link href="/lancamentos/novo?area=enfermagem" className="botao">+ Enfermagem</Link>
            <Link href="/lancamentos/novo?area=logistica" className="botao">+ Corrida</Link>
          </>
        }
      />
      <form className="cartao mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <input type="month" name="mes" defaultValue={competencia} className="campo" />
        <select name="empresa" defaultValue={empresaId ?? ""} className="campo">
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select name="area" defaultValue={area ?? ""} className="campo">
          <option value="">Todas as áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="campo">
          <option value="">Todos os serviços</option>
          {TIPOS.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
        </select>
        <input name="paciente" defaultValue={paciente} placeholder="Paciente" className="campo" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="cancelados" value="1" defaultChecked={verCancelados} /> Ver cancelados
        </label>
        <button className="botao-sec">Filtrar</button>
      </form>

      <div className="cartao overflow-x-auto p-0">
        {linhas.length === 0 ? (
          <Vazio>Nenhum lançamento no período.</Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th><th>Paciente</th><th>Empresa</th><th>Serviço</th>
                <th className="text-right">Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className={l.status === "cancelado" ? "text-gray-400 line-through" : ""}>
                  <td className="whitespace-nowrap">{dataBR(l.data)}{l.hora ? ` ${l.hora}` : ""}</td>
                  <td><Link href={`/lancamentos/${l.id}`} className="link">{l.paciente}</Link></td>
                  <td>{l.empresa}</td>
                  <td>{ROTULO_TIPO[l.tipo]}{l.modal ? ` · ${ROTULO_MODAL[l.modal]}` : ""}</td>
                  <td className="text-right">{l.quantidade}</td>
                  <td className="text-right">{moeda(l.valorUnitario)}</td>
                  <td className="text-right font-medium">{moeda(l.valorTotal)}</td>
                  <td>
                    {l.status === "cancelado" ? (
                      <Selo tipo="cancelado">Cancelado</Selo>
                    ) : l.fechamentoId ? (
                      <Link href={`/fechamentos/${l.fechamentoId}`}><Selo tipo="fechado">Fechado nº {l.fechamentoId}</Selo></Link>
                    ) : (
                      <Selo tipo="realizado">Em aberto</Selo>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={4} className="px-3 py-3">Total do filtro (sem cancelados)</td>
                <td className="px-3 text-right">{qtd}</td>
                <td />
                <td className="px-3 text-right">{moeda(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
