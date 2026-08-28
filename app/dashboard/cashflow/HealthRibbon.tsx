import type { PersonalCashFlowMonth } from "@/lib/debt-engine/personal-cashflow";
import { AlertTriangleIcon, CheckIcon, DotIcon } from "@/lib/icons";

/**
 * "¿En qué mes me quedo sin plata?" (spec §2.1) — una tira de tiles de
 * vidrio, uno por mes. Nunca una sola señal de color: cada tile lleva
 * también un glifo y una etiqueta de texto, así que sigue siendo
 * legible sin depender del color.
 */

function formatMonthShort(monthStr: string) {
  const [, month] = monthStr.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return names[Number(month) - 1];
}

function formatCompactCurrency(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export default function HealthRibbon({ months }: { months: PersonalCashFlowMonth[] }) {
  if (months.length === 0) return null;

  const balances = months.map((m) => m.cumulativeBalance);
  const span = Math.max(...balances) - Math.min(...balances, 0) || 1;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {months.map((m, i) => {
          const isNegative = m.cumulativeBalance < 0;
          const isTight = !isNegative && m.cumulativeBalance < span * 0.15;
          const color = isNegative ? "var(--on-error-container)" : isTight ? "var(--on-secondary-container)" : "var(--on-primary-container)";
          const Glyph = isNegative ? AlertTriangleIcon : isTight ? DotIcon : CheckIcon;

          return (
            <div
              key={m.month}
              className="board-module paper-card"
              style={{
                flex: "1 0 116px",
                padding: "16px 14px 14px",
                ["--module-index" as string]: i,
              }}
            >
              <Glyph width={22} height={22} style={{ color, marginBottom: 12, display: "block" }} />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 18,
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatCompactCurrency(m.cumulativeBalance)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--on-surface-variant)",
                  marginTop: 4,
                  textTransform: "capitalize",
                }}
              >
                {formatMonthShort(m.month)}
                {m.isBonusMonth ? " •" : ""}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginTop: 12, marginBottom: 0 }}>
        Saldo acumulado proyectado, encadenado desde tu saldo real de partida. Rojo = te quedás sin
        plata ese mes, gris = queda muy justo.
      </p>
    </div>
  );
}
