"use client";

import { useActionState, type ReactNode } from "react";
import type { EstadoAcao } from "@/lib/form";

type Props = {
  action: (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;
  children: ReactNode;
  className?: string;
  botao?: string;
  botaoClasse?: string;
  confirmar?: string;
};

/** Formulário ligado a uma Server Action, com mensagem de erro/sucesso e estado de envio. */
export function ActionForm({ action, children, className, botao = "Salvar", botaoClasse = "botao", confirmar }: Props) {
  const [estado, formAction, pendente] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className={botaoClasse} disabled={pendente}>
          {pendente ? "Salvando…" : botao}
        </button>
        {estado.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
        {estado.ok && <p className="text-sm text-teal-700">{estado.ok}</p>}
      </div>
    </form>
  );
}
