import type { ReactNode } from "react";

export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-gray-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Campo({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-gray-500">{children}</p>;
}

const CORES_SELO: Record<string, string> = {
  calculado: "bg-gray-100 text-gray-700",
  enviado: "bg-blue-100 text-blue-800",
  aprovado: "bg-indigo-100 text-indigo-800",
  nf_emitida: "bg-amber-100 text-amber-800",
  pago: "bg-green-100 text-green-800",
  reaberto: "bg-gray-100 text-gray-400 line-through",
  em_atraso: "bg-red-100 text-red-800",
  realizado: "bg-green-100 text-green-800",
  previsto: "bg-blue-100 text-blue-800",
  cancelado: "bg-red-100 text-red-700",
  fechado: "bg-gray-200 text-gray-700",
};

export function Selo({ tipo, children }: { tipo: string; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CORES_SELO[tipo] ?? "bg-gray-100"}`}>
      {children}
    </span>
  );
}

export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}
