import Link from "next/link";
import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { opcoesPacientes } from "@/lib/consultas";
import { hojeISO } from "@/lib/formato";
import { acrescimoTerceirizado } from "@/lib/lancamentos";
import { Cabecalho } from "@/components/ui";
import { LancamentoForm } from "../lancamento-form";

export default async function NovoLancamentoPage({ searchParams }: PageProps<"/lancamentos/novo">) {
  await exigirUsuario();
  const area = (await searchParams).area === "logistica" ? "logistica" : "enfermagem";
  const db = await getDb();
  const [pacientes, acrescimo] = await Promise.all([opcoesPacientes(db), acrescimoTerceirizado(db)]);

  return (
    <>
      <Cabecalho
        titulo={area === "enfermagem" ? "Lançar atendimento de enfermagem" : "Lançar corrida"}
        descricao="Selecione o paciente: empresa e tarifa são preenchidas automaticamente. Após lançar, a data e o serviço ficam mantidos para o próximo."
        acoes={
          <Link href={`/lancamentos/novo?area=${area === "enfermagem" ? "logistica" : "enfermagem"}`} className="botao-sec">
            {area === "enfermagem" ? "Ir para corridas" : "Ir para enfermagem"}
          </Link>
        }
      />
      {pacientes.length === 0 ? (
        <p className="cartao text-sm">Nenhum paciente ativo. <Link href="/pacientes/novo" className="link">Cadastrar paciente</Link>.</p>
      ) : (
        <LancamentoForm key={area} area={area} pacientes={pacientes} hoje={hojeISO()} acrescimoPadrao={acrescimo} />
      )}
    </>
  );
}
