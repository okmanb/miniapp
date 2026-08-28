import type { PersonalCashFlowMonth } from "@/lib/debt-engine/personal-cashflow";

/**
 * Gráfico de barras en SVG puro, sin librerías externas — evita
 * sumar una dependencia nueva (recharts, chart.js, etc.) solo para
 * esto, así no hay que volver a correr npm install.
 */

function formatMonthShort(monthStr: string) {
  const [, month] = monthStr.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return names[Number(month) - 1];
}

function formatCompactCurrency(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(Math.round(amount));
}

export default function CashFlowChart({ data }: { data: PersonalCashFlowMonth[] }) {
  if (data.length === 0) return null;

  const width = 640;
  const height = 240;
  // La franja inferior reserva dos líneas de texto (monto + mes) con
  // aire entre ellas — con solo 28px la etiqueta de un mes en rojo al
  // tope de la escala quedaba pisando el nombre del mes debajo.
  const paddingBottom = 48;
  const paddingTop = 16;
  const barGap = 12;
  const barWidth = (width - barGap * (data.length + 1)) / data.length;

  const maxAbs = Math.max(...data.map((m) => Math.abs(m.netAvailable)), 1);

  // Si todos los meses caen del mismo lado (todo negativo, como acá
  // arriba con déficit fijo), la mitad del gráfico reservada para el
  // signo que no aparece queda vacía — la línea de cero se movía al
  // centro y dejaba un bloque de aire muerto antes de la primera
  // barra. La línea de cero se ancla arriba o abajo según el signo
  // real de los datos, y solo se centra cuando hay meses de los dos
  // signos.
  const hasPositive = data.some((m) => m.netAvailable > 0);
  const hasNegative = data.some((m) => m.netAvailable < 0);
  const usableHeight = height - paddingTop - paddingBottom;
  let zeroY: number;
  let halfHeight: number;
  if (hasPositive && hasNegative) {
    halfHeight = usableHeight / 2;
    zeroY = paddingTop + halfHeight;
  } else if (hasNegative) {
    zeroY = paddingTop + 6;
    halfHeight = usableHeight - 6;
  } else {
    zeroY = height - paddingBottom;
    halfHeight = usableHeight;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", marginTop: 16 }}
      role="img"
      aria-label="Gráfico de neto disponible por mes"
    >
      {/* Línea de referencia en cero */}
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#bbcac3" strokeWidth={1} />

      {data.map((month, i) => {
        const x = barGap + i * (barWidth + barGap);
        const cx = x + barWidth / 2;
        const barHeight = (Math.abs(month.netAvailable) / maxAbs) * halfHeight;
        const isPositive = month.netAvailable >= 0;
        const y = isPositive ? zeroY - barHeight : zeroY;
        const color = isPositive ? "#004538" : "#93000a";
        // Barra fina tipo cápsula (línea con punta redondeada en vez
        // de un rectángulo grueso) — más aire entre columnas, el dato
        // sigue siendo el protagonista.
        const barThickness = 12;

        return (
          <g key={month.month}>
            <line
              x1={cx}
              y1={isPositive ? zeroY : zeroY}
              x2={cx}
              y2={isPositive ? zeroY - Math.max(barHeight, 2) : zeroY + Math.max(barHeight, 2)}
              stroke={color}
              strokeWidth={barThickness}
              strokeLinecap="round"
            />
            <text
              x={x + barWidth / 2}
              y={isPositive ? y - 6 : y + barHeight + 16}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fontFamily="var(--font-mono)"
              fill={color}
            >
              {formatCompactCurrency(month.netAvailable)}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 14}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-ui)"
              fill="#6c7a75"
            >
              {formatMonthShort(month.month)}
              {month.isBonusMonth ? " •" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
