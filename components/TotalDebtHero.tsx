/**
 * Tarjeta principal del dashboard. Todos los valores están medidos sobre el
 * prototipo renderizado, no derivados de DESIGN.md.
 *
 * Dos cosas se apartan de DESIGN.md a propósito, porque el prototipo manda:
 *  - el radio es 16px, y no uno de los tres niveles del sistema (10-14px);
 *  - tiene sombra propia (más profunda, con un hairline interior arriba) en
 *    vez de la única sombra del sistema.
 *
 * El tamaño de la cifra se achica de 28px a 20px cuando no entra, igual que
 * el `_fs` del prototipo: el saldo no se trunca ni se parte en dos líneas.
 */

import { formatMoney } from "@/lib/calc/money";

/** Capas de fondo, copiadas del computed style del prototipo. */
const HERO_BACKGROUND = [
  "radial-gradient(120% 90% at 88% -10%, rgba(167,117,48,.35) 0%, rgba(167,117,48,0) 55%)",
  "radial-gradient(85% 70% at 8% 110%, rgba(37,131,93,.4) 0%, rgba(37,131,93,0) 60%)",
  "linear-gradient(160deg, #0E3A31 0%, #134A3E 100%)",
].join(", ");

const HERO_SHADOW =
  "0 18px 34px -14px rgba(14,58,49,.55), inset 0 1px 0 0 rgba(255,255,255,.08)";

/** Mismo criterio que `_fs` del prototipo: bajar de 28 a 20 según el largo. */
function heroFontSize(text: string): number {
  if (text.length <= 13) return 28;
  if (text.length <= 15) return 25;
  if (text.length <= 17) return 22;
  return 20;
}

export interface TotalDebtHeroProps {
  /** Saldo total, ya derivado de las deudas del escenario activo. */
  total: number;
  /** Cuánto se movió el saldo este mes. Negativo = bajó. */
  delta: number;
  /** Serie para la chispa, del mes más viejo al más nuevo. */
  series: number[];
  debtCount: number;
  /** Texto del estado: "todas al día", "1 vencida", etc. */
  statusLabel: string;
  /** true cuando algo está vencido: el punto y el texto pasan a brick. */
  hasOverdue?: boolean;
}

export function TotalDebtHero({
  total,
  delta,
  series,
  debtCount,
  statusLabel,
  hasOverdue = false,
}: TotalDebtHeroProps) {
  const totalText = formatMoney(total);
  const fontSize = heroFontSize(totalText);

  // El delta baja el saldo cuando es negativo: eso es progreso, y va en mint.
  const isProgress = delta <= 0;
  const pct = total > 0 ? Math.abs(delta / total) * 100 : 0;
  const deltaText =
    `${isProgress ? "↘ −" : "↗ +"}${formatMoney(Math.abs(delta)).replace("$ ", "$ ")}` +
    ` este mes · ${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

  return (
    <section
      data-motion
      data-ondark
      className="animate-card-in relative overflow-hidden rounded-[16px] px-[18px] pb-[17px] pt-[19px]"
      style={{ backgroundImage: HERO_BACKGROUND, boxShadow: HERO_SHADOW }}
    >
      <div
        className="font-mono text-[10px] uppercase"
        style={{ color: "rgba(255,255,255,.62)", letterSpacing: "1px" }}
      >
        Saldo total de deuda
      </div>

      <div
        className="mt-1 font-mono font-semibold text-white"
        style={{ fontSize: `${fontSize}px`, letterSpacing: "-.02em" }}
      >
        <span>{totalText}</span>
      </div>

      <Sparkline values={series} />

      <div
        className="mt-1 inline-flex items-center rounded-pill px-[13px] py-2 font-mono text-[11.5px] font-semibold"
        style={{
          backgroundColor: isProgress ? "rgba(37,131,93,.3)" : "rgba(177,77,59,.3)",
          color: isProgress ? "#97DCBA" : "#F0B0A0",
        }}
      >
        <span>{deltaText}</span>
      </div>

      <div
        className="mt-3 flex items-center gap-2 text-[12px] font-medium"
        style={{ color: "rgba(255,255,255,.8)" }}
      >
        <span
          className="inline-block h-[7px] w-[7px] rounded-full"
          style={{ backgroundColor: hasOverdue ? "#F0B0A0" : "#97DCBA" }}
          aria-hidden
        />
        <span>
          {debtCount} {debtCount === 1 ? "deuda" : "deudas"} · {statusLabel}
        </span>
      </div>
    </section>
  );
}

/**
 * Chispa del saldo. Es decorativa respecto del dato —el número exacto está
 * arriba— así que va oculta a lectores de pantalla en vez de intentar
 * describir una tendencia que la cifra y el delta ya dicen en palabras.
 */
function Sparkline({ values }: { values: number[] }) {
  const height = 32;
  const width = 321;

  if (values.length < 2) return <div style={{ height }} aria-hidden />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  // 3px de aire arriba y abajo para que el punto final no se corte.
  const points = values
    .map((v, i) => `${i * stepX},${3 + (1 - (v - min) / span) * (height - 12)}`)
    .join(" ");
  const [lastX, lastY] = points.split(" ").slice(-1)[0].split(",");

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-1 block"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#97DCBA" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
