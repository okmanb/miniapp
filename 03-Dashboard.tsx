"use client";

/**
 * Dashboard principal del simulador de deudas y flujo de caja.
 *
 * Reglas de diseño de esta pantalla (ver 01-SPEC.md §2.1 y §4):
 * - El "ribbon de salud financiera" es el elemento hero: responde de un vistazo
 *   "¿en qué mes me quedo sin plata?" — es lo que más se volvió a mirar en la
 *   sesión real que dio origen a este spec.
 * - Las deudas se agrupan por URGENCIA (estado), no por entidad/banco.
 * - Todo dato estimado (is_estimate=true) se distingue visualmente SIEMPRE
 *   (acá con el punto ámbar + el label "estimado"), nunca se mezcla con dato duro.
 *
 * Tipografía esperada (cargar en globals.css / next/font):
 *   --font-display: "Fraunces"   (headers)
 *   --font-body:    "Inter"      (texto de UI)
 *   --font-mono:    "IBM Plex Mono"  (todos los números)
 */

import { useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, CircleDot, ArrowRight } from "lucide-react";

// ---------- Tipos (mapean 1:1 a 02-schema.sql) ----------

type DebtStatus = "al_dia" | "mora" | "refinanciado" | "cancelado" | "regularizado";

interface Debt {
  id: string;
  name: string;
  entity: string;
  status: DebtStatus;
  balance: number;
  tna?: number;
  nextDueDate?: string;
  isEstimate?: boolean;
  note?: string;
}

interface MonthSnapshot {
  month: string; // "2026-09"
  label: string; // "Sep-26"
  cumulativeBalance: number;
  netResult: number;
  isActual: boolean;
}

type AlertSeverity = "info" | "atencion" | "critico";

interface AppAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

// ---------- Datos de ejemplo (reemplazar por fetch a Supabase) ----------

const MONTHS: MonthSnapshot[] = [
  { month: "2026-08", label: "Ago", cumulativeBalance: 8842, netResult: 2704666, isActual: true },
  { month: "2026-09", label: "Sep", cumulativeBalance: 105695, netResult: 96853, isActual: false },
  { month: "2026-10", label: "Oct", cumulativeBalance: -44417, netResult: -150112, isActual: false },
  { month: "2026-11", label: "Nov", cumulativeBalance: 1055050, netResult: 1099468, isActual: false },
  { month: "2026-12", label: "Dic", cumulativeBalance: 3415351, netResult: 2360301, isActual: false },
  { month: "2027-01", label: "Ene", cumulativeBalance: 2906314, netResult: -509037, isActual: false },
  { month: "2027-02", label: "Feb", cumulativeBalance: 2805077, netResult: -101238, isActual: false },
];

const DEBTS: Debt[] = [
  {
    id: "1",
    name: "Visa Signature ....6412",
    entity: "BBVA",
    status: "mora",
    balance: 7000000,
    tna: 0.6944,
    isEstimate: true,
    note: "Pago variable ~$500K/mes desde Nov",
  },
  {
    id: "2",
    name: "Mastercard Patagonia ....4139",
    entity: "Banco Patagonia",
    status: "al_dia",
    balance: 3212523,
    tna: 0.838,
    isEstimate: true,
    note: "Saldo creciendo — único medio de pago activo",
  },
  {
    id: "3",
    name: "Mastercard Black ....4845",
    entity: "BBVA",
    status: "refinanciado",
    balance: 2952659,
    tna: 0.6944,
    isEstimate: true,
    note: "Cuota real a confirmar (~$1M/mes)",
  },
  {
    id: "4",
    name: "Préstamo personal 220191",
    entity: "BBVA",
    status: "al_dia",
    balance: 1495397,
    tna: 0.6,
  },
  {
    id: "5",
    name: "Préstamo personal 247650",
    entity: "BBVA",
    status: "al_dia",
    balance: 5832941,
    tna: 0.72,
  },
  {
    id: "6",
    name: "Devolución préstamo a esposa",
    entity: "Brubank / MercadoPago",
    status: "al_dia",
    balance: 2280000,
  },
];

const ALERTS: AppAlert[] = [
  {
    id: "a1",
    severity: "critico",
    message: "Octubre es el mes más ajustado del año: el saldo acumulado proyectado es negativo.",
  },
  {
    id: "a2",
    severity: "atencion",
    message: "Mastercard Patagonia: el consumo mensual estimado supera lo que cubre el pago actual — el saldo sigue creciendo.",
  },
  {
    id: "a3",
    severity: "info",
    message: "Mastercard Black BBVA: confirmar el monto real de la cuota con la app (hoy es una estimación).",
  },
];

// ---------- Helpers ----------

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const STATUS_META: Record<DebtStatus, { label: string; dot: string; text: string }> = {
  mora: { label: "En mora", dot: "bg-[#A63D3D]", text: "text-[#A63D3D]" },
  al_dia: { label: "Al día", dot: "bg-[#3F7859]", text: "text-[#3F7859]" },
  refinanciado: { label: "Refinanciado", dot: "bg-[#B8802E]", text: "text-[#B8802E]" },
  cancelado: { label: "Cancelado", dot: "bg-slate-400", text: "text-slate-400" },
  regularizado: { label: "Regularizado", dot: "bg-[#3F7859]", text: "text-[#3F7859]" },
};

const SEVERITY_META: Record<AlertSeverity, { border: string; icon: string }> = {
  critico: { border: "border-l-[#A63D3D]", icon: "text-[#A63D3D]" },
  atencion: { border: "border-l-[#B8802E]", icon: "text-[#B8802E]" },
  info: { border: "border-l-[#1F6F78]", icon: "text-[#1F6F78]" },
};

// ---------- Ribbon de salud financiera (elemento firma de la pantalla) ----------

function HealthRibbon({ months }: { months: MonthSnapshot[] }) {
  const min = Math.min(...months.map((m) => m.cumulativeBalance));
  const max = Math.max(...months.map((m) => m.cumulativeBalance));
  const span = Math.max(max - min, 1);

  return (
    <div className="rounded-2xl border border-black/5 bg-white/60 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-[var(--font-display)] text-xl text-[#16213E]">Salud financiera, mes a mes</h2>
        <span className="font-[var(--font-mono)] text-xs text-[#16213E]/50">
          proyección a {months.length} meses
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {months.map((m) => {
          const isNegative = m.cumulativeBalance < 0;
          const isTight = !isNegative && m.cumulativeBalance < span * 0.15;
          const dotColor = isNegative ? "#A63D3D" : isTight ? "#B8802E" : "#3F7859";
          const heightPct = Math.max(6, ((m.cumulativeBalance - min) / span) * 100);
          return (
            <div key={m.month} className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-full items-end justify-center">
                <div
                  className="w-2 rounded-full transition-all"
                  style={{ height: `${heightPct}%`, backgroundColor: dotColor }}
                  title={`${m.label}: ${fmtCurrency(m.cumulativeBalance)}`}
                />
              </div>
              <span className="font-[var(--font-body)] text-[11px] font-medium uppercase tracking-wide text-[#16213E]/60">
                {m.label}
                {m.isActual && <span className="ml-1 text-[#1F6F78]">•</span>}
              </span>
              <span
                className="font-[var(--font-mono)] text-[11px] tabular-nums"
                style={{ color: dotColor }}
              >
                {isNegative ? "−" : ""}
                {fmtCurrency(Math.abs(m.cumulativeBalance)).replace("ARS", "").trim()}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-[var(--font-body)] text-xs text-[#16213E]/45">
        <span className="text-[#1F6F78]">•</span> = saldo real, ya sucedido. El resto es proyección
        encadenada desde ahí — nunca se le suma el mes actual dos veces.
      </p>
    </div>
  );
}

// ---------- Tarjeta de deuda ----------

function DebtCard({ debt }: { debt: Debt }) {
  const meta = STATUS_META[debt.status];
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <CircleDot className={`h-4 w-4 shrink-0 ${meta.text}`} />
        <div>
          <p className="font-[var(--font-body)] text-sm font-medium text-[#16213E]">{debt.name}</p>
          <p className="font-[var(--font-body)] text-xs text-[#16213E]/50">
            {debt.entity}
            {debt.tna !== undefined && ` · TNA ${(debt.tna * 100).toFixed(1)}%`}
          </p>
          {debt.note && (
            <p className="mt-0.5 font-[var(--font-body)] text-xs text-[#B8802E]">
              {debt.isEstimate && "≈ "}
              {debt.note}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-[var(--font-mono)] text-sm font-semibold tabular-nums text-[#16213E]">
          {fmtCurrency(debt.balance)}
        </p>
        <p className={`font-[var(--font-body)] text-[11px] font-medium ${meta.text}`}>{meta.label}</p>
      </div>
    </div>
  );
}

// ---------- Panel de alertas ----------

function AlertsPanel({ alerts }: { alerts: AppAlert[] }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/60 p-5">
      <h2 className="mb-4 font-[var(--font-display)] text-lg text-[#16213E]">Para revisar</h2>
      <div className="flex flex-col gap-2.5">
        {alerts.map((a) => {
          const meta = SEVERITY_META[a.severity];
          return (
            <div
              key={a.id}
              className={`flex items-start gap-2.5 rounded-lg border-l-2 bg-[#16213E]/[0.03] px-3 py-2.5 ${meta.border}`}
            >
              <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.icon}`} />
              <p className="font-[var(--font-body)] text-xs leading-relaxed text-[#16213E]/80">{a.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Pantalla ----------

export default function Dashboard() {
  const grouped = useMemo(() => {
    const order: DebtStatus[] = ["mora", "al_dia", "refinanciado", "regularizado", "cancelado"];
    return order
      .map((status) => ({ status, debts: DEBTS.filter((d) => d.status === status) }))
      .filter((g) => g.debts.length > 0);
  }, []);

  const worstMonth = useMemo(
    () => MONTHS.reduce((min, m) => (m.cumulativeBalance < min.cumulativeBalance ? m : min)),
    []
  );

  return (
    <div className="min-h-screen bg-[#F5F6F3] px-6 py-8 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl text-[#16213E]">Tu plan de salvataje</h1>
            <p className="font-[var(--font-body)] text-sm text-[#16213E]/55">
              {worstMonth.cumulativeBalance < 0 ? (
                <>
                  <TrendingDown className="mr-1 inline h-3.5 w-3.5 text-[#A63D3D]" />
                  El mes más ajustado es <strong className="text-[#A63D3D]">{worstMonth.label}</strong>,
                  con {fmtCurrency(worstMonth.cumulativeBalance)}
                </>
              ) : (
                <>
                  <TrendingUp className="mr-1 inline h-3.5 w-3.5 text-[#3F7859]" />
                  Todos los meses proyectados están en positivo
                </>
              )}
            </p>
          </div>
          <button className="flex items-center gap-1.5 rounded-full bg-[#16213E] px-4 py-2 font-[var(--font-body)] text-sm font-medium text-white transition hover:bg-[#1F6F78]">
            Ver flujo de caja completo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </header>

        <HealthRibbon months={MONTHS} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-5">
            {grouped.map((g) => (
              <div key={g.status}>
                <h3 className="mb-2 font-[var(--font-body)] text-xs font-semibold uppercase tracking-wide text-[#16213E]/45">
                  {STATUS_META[g.status].label} ({g.debts.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {g.debts.map((d) => (
                    <DebtCard key={d.id} debt={d} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <AlertsPanel alerts={ALERTS} />
        </div>
      </div>
    </div>
  );
}
