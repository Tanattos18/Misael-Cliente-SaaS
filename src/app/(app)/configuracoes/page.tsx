import { getDb } from "@/db";
import { exigirUsuario } from "@/lib/auth";
import { acrescimoTerceirizado } from "@/lib/lancamentos";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { salvarConfiguracoes, trocarSenha } from "../usuarios/actions";

export default async function ConfiguracoesPage() {
  const usuario = await exigirUsuario();
  const acrescimo = await acrescimoTerceirizado(await getDb());

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        {usuario.perfil === "admin" && (
          <ActionForm action={salvarConfiguracoes} className="cartao">
            <h2 className="mb-1 font-semibold">Transportador terceirizado</h2>
            <p className="mb-3 text-sm text-gray-500">
              Acréscimo padrão sobre o custo da transportadora (hoje: 25% administrativo + 5% pelo adiantamento).
            </p>
            <Campo rotulo="Acréscimo (%)">
              <input name="acrescimo" className="campo" inputMode="decimal" defaultValue={String(acrescimo).replace(".", ",")} />
            </Campo>
          </ActionForm>
        )}
        <ActionForm action={trocarSenha} className="cartao" botao="Alterar senha">
          <h2 className="mb-3 font-semibold">Minha senha</h2>
          <div className="space-y-3">
            <Campo rotulo="Senha atual"><input name="atual" type="password" className="campo" required autoComplete="current-password" /></Campo>
            <Campo rotulo="Nova senha"><input name="nova" type="password" minLength={8} className="campo" required autoComplete="new-password" /></Campo>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
