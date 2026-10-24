"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import type { EstadoAcao } from "@/lib/form";

type Acao = (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;

/**
 * Como useActionState, mas sem o reset automático do React 19 no fim de cada ação:
 * com ele, um erro de validação apagava o que o usuário tinha digitado.
 *
 * Espalhe as props no <form {...props}>. O `onSubmit` faz o envio (e cancela o padrão);
 * o `action` continua lá para o React nunca deixar o navegador fazer um envio comum (GET),
 * que colocaria os campos — inclusive senha — na URL se alguém enviar antes de a página hidratar.
 */
export function useAcao(acao: Acao) {
  const [estado, despachar, pendente] = useActionState<EstadoAcao, FormData>(acao, {});
  const [, iniciar] = useTransition();
  const props = {
    action: despachar,
    onSubmit: (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
      const dados = new FormData(e.currentTarget, submitter);
      iniciar(() => despachar(dados));
    },
  };
  return [estado, props, pendente] as const;
}
