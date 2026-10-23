import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { entrar } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="cartao w-full max-w-sm">
        <h1 className="text-xl font-semibold text-teal-800">CuraLog</h1>
        <p className="mb-6 text-sm text-gray-500">Gestão de enfermagem, logística e faturamento</p>
        <ActionForm action={entrar} botao="Entrar" botaoClasse="botao w-full">
          <div className="space-y-4">
            <Campo rotulo="E-mail">
              <input name="email" type="email" className="campo" autoComplete="username" required />
            </Campo>
            <Campo rotulo="Senha">
              <input name="senha" type="password" className="campo" autoComplete="current-password" required />
            </Campo>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
