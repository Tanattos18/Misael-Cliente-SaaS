"use server";

import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/lib/form";
import { trocarSenha } from "../(app)/usuarios/actions";

export async function trocarSenhaObrigatoria(estado: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  if (formData.get("nova") !== formData.get("confirmacao")) return { erro: "A confirmação não confere com a nova senha." };
  const r = await trocarSenha(estado, formData);
  if (r.erro) return r;
  redirect("/");
}
