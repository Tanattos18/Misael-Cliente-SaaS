import { competenciaExtenso, moeda } from "@/lib/formato";

export type PontoMes = { competencia: string; receita: number; despesa: number };

const COR_RECEITA = "#0d9488";
const COR_DESPESA = "#ea580c";

const mesCurto = (c: string) => competenciaExtenso(c).slice(0, 3) + "/" + c.slice(2, 4);

/**
 * Receita × despesa por mês (barras agrupadas, um eixo em R$).
 * Hover: tooltip nativo por barra. A tabela ao lado/abaixo é a visão acessível dos mesmos números.
 */
export function GraficoMeses({ dados }: { dados: PontoMes[] }) {
  const largura = 640;
  const altura = 220;
  const margem = { topo: 16, base: 28, esq: 8, dir: 8 };
  const max = Math.max(1, ...dados.flatMap((d) => [d.receita, d.despesa]));
  const grupo = (largura - margem.esq - margem.dir) / dados.length;
  const barra = Math.min(28, (grupo - 16) / 2);
  const y = (v: number) => margem.topo + (altura - margem.topo - margem.base) * (1 - v / max);
  const base = altura - margem.base;

  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_RECEITA }} /> Receita</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_DESPESA }} /> Despesa</span>
      </div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full" role="img" aria-label="Receita e despesa por mês">
        {[0.5, 1].map((f) => (
          <line key={f} x1={margem.esq} x2={largura - margem.dir} y1={y(max * f)} y2={y(max * f)} stroke="#e5e7eb" strokeDasharray="2 4" />
        ))}
        <line x1={margem.esq} x2={largura - margem.dir} y1={base} y2={base} stroke="#d1d5db" />
        {dados.map((d, i) => {
          const cx = margem.esq + grupo * i + grupo / 2;
          const barras = [
            { v: d.receita, cor: COR_RECEITA, x: cx - barra - 1, rotulo: "Receita" },
            { v: d.despesa, cor: COR_DESPESA, x: cx + 1, rotulo: "Despesa" },
          ];
          return (
            <g key={d.competencia}>
              {barras.map((b) => {
                const h = Math.max(0, base - y(b.v));
                return (
                  <g key={b.rotulo}>
                    {/* Área de hover maior que a barra */}
                    <rect x={b.x} y={margem.topo} width={barra} height={base - margem.topo} fill="transparent">
                      <title>{`${competenciaExtenso(d.competencia)} — ${b.rotulo}: ${moeda(b.v)}`}</title>
                    </rect>
                    {h > 0 && (
                      <path
                        d={`M${b.x},${base} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, barra / 2)},${-Math.min(4, h)} h${barra - 2 * Math.min(4, barra / 2)} q${Math.min(4, barra / 2)},0 ${Math.min(4, barra / 2)},${Math.min(4, h)} v${h - Math.min(4, h)} z`}
                        fill={b.cor}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}
              <text x={cx} y={altura - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{mesCurto(d.competencia)}</text>
            </g>
          );
        })}
        <text x={margem.esq + 2} y={y(max) - 4} fontSize="10" fill="#9ca3af">{moeda(max)}</text>
      </svg>
    </figure>
  );
}
