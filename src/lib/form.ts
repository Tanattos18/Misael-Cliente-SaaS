import { z } from "zod";

/** Resultado de uma Server Action. `confirmar` pede uma confirmação extra no formulário; `link` aponta para onde resolver. */
export type EstadoAcao = { erro?: string; ok?: string; confirmar?: string; link?: string };

/** Converte o FormData (campos vazios viram undefined) e valida com o schema. */
export function lerForm<T extends z.ZodType>(
  formData: FormData,
  schema: T,
): { dados: z.infer<T>; erro?: undefined } | { dados?: undefined; erro: string } {
  const bruto: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && v.trim() !== "") bruto[k] = v.trim();
  }
  const r = schema.safeParse(bruto);
  if (!r.success) {
    const p = r.error.issues[0];
    return { erro: `${p.path.join(".") || "Formulário"}: ${p.message}` };
  }
  return { dados: r.data };
}

// Números digitados no padrão brasileiro: "1.234,56" ou "55,00" ou "55".
export const zValor = z
  .string()
  .transform((s) => Number(s.replace(/\./g, "").replace(",", ".")))
  .pipe(z.number({ error: "valor inválido" }).min(0, "não pode ser negativo"));

export const zId = z.coerce.number().int().positive();
export const zIdOpcional = zId.optional();
export const zData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
export const zTexto = z.string().max(500).optional();

/** Senha: mínimo 8 caracteres, com letras e números. */
export const zSenha = z
  .string()
  .min(8, "a senha precisa ter pelo menos 8 caracteres")
  .regex(/[a-zA-Z]/, "a senha precisa ter letras")
  .regex(/\d/, "a senha precisa ter números");
