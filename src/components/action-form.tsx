"use client";

import { useRef, type ReactNode } from "react";
import type { EstadoAcao } from "@/lib/form";
import { useAcao } from "./use-acao";

type Props = {
  action: (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;
  children: ReactNode;
  className?: string;
  botao?: string;
  botaoClasse?: string;
  confirmar?: string;
};

/**
 * Formulário ligado a uma Server Action, com mensagem de erro/sucesso e estado de envio.
 * Em caso de erro mantém o que foi digitado; limpa só quando a ação dá certo.
 */
export function ActionForm({ action, children, className, botao = "Salvar", botaoClasse = "botao", confirmar }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendente] = useAcao(async (anterior, formData) => {
    const r = await action(anterior, formData);
    if (r.ok) ref.current?.reset();
    return r;
  });
  return (
    <form
      ref={ref}
      className={className}
      action={enviar.action}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) {
          e.preventDefault();
          return;
        }
        enviar.onSubmit(e);
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
