import { redirect } from "next/navigation";
import { exigirLogin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { trocarSenhaObrigatoria } from "./actions";

export default async function TrocarSenhaPage() {
  const usuario = await exigirLogin();
  if (!usuario.trocarSenha) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="cartao w-full max-w-sm">
        <h1 className="text-xl font-semibold text-teal-800">Crie sua senha</h1>
        <p className="mb-6 text-sm text-gray-500">
          Olá, {usuario.nome}. Sua senha atual é provisória: defina uma senha pessoal para continuar.
        </p>
        <ActionForm action={trocarSenhaObrigatoria} botao="Salvar e entrar" botaoClasse="botao w-full">
          <div className="space-y-4">
            <Campo rotulo="Senha provisória">
              <input name="atual" type="password" className="campo" autoComplete="current-password" required />
            </Campo>
            <Campo rotulo="Nova senha (mín. 8, com letras e números)">
              <input name="nova" type="password" minLength={8} className="campo" autoComplete="new-password" required />
            </Campo>
            <Campo rotulo="Confirme a nova senha">
              <input name="confirmacao" type="password" minLength={8} className="campo" autoComplete="new-password" required />
            </Campo>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
