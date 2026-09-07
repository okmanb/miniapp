"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/calc/money";
import type { CashflowMonth, Severity } from "@/lib/calc/cashflow";

/**
 * El tablero del flujo de caja: la tira de meses por severidad, el gráfico de
 * disponible y el desglose del mes elegido.
 *
 * Es un componente de cliente por una sola razón —elegir el mes— y recibe los
 * meses ya proyectados desde el servidor. Nada se recalcula acá: si el número
 * del gráfico y el del desglose salieran de dos cuentas distintas, tarde o
 * temprano dejarían de coincidir.
 */

const SEVERITY_BG: Record<Severity, string> = {
  ok: "#25835D",
  justo: "#A77530",
  rojo1: "#C9735B",
  rojo2: "#B05441",
  rojo3: "#94362A",
};

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function shortMonth(period: string): string {
  return MONTHS_SHORT[Number(period.split("-")[1]) - 1];
}

/** "+1.5M" / "−0.5M" — la tira prioriza la magnitud, no el peso exacto. */
function compact(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}${(Math.abs(value) / 1e6).toFixed(1)}M`;
}

export function CashflowBoard({
  months,
  scenarioName,
}: {
  months: CashflowMonth[];
  scenarioName: string;
}) {
  const [selected, setSelected] = useState(0);
  const month = months[selected];

  if (months.length === 0) return null;

  return (
    <>
      <h2 className="mt-6 text-[15px] font-semibold text-ink">¿En qué mes me quedo sin plata?</h2>
      <p className="help mt-1">
        Saldo acumulado proyectado, encadenado desde tu saldo real de partida.
      </p>

      {/* Tira de meses. Scrollea sola en horizontal: la pantalla no. */}
      <div className="-mx-[18px] mt-3 no-scrollbar overflow-x-auto px-[18px] pb-1">
        <ul className="flex gap-2">
          {months.map((m, i) => (
            <li key={m.period}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                className="w-[128px] rounded-surface-lg px-3 py-[13px] text-left transition-opacity duration-150 ease-sd hover:opacity-90"
                style={{
                  backgroundColor: SEVERITY_BG[m.severity],
                  outline: i === selected ? "2px solid #0E3A31" : undefined,
                  outlineOffset: i === selected ? "2px" : undefined,
                }}
              >
                <span className="flex items-center justify-between font-mono text-[10.5px] uppercase text-white opacity-85">
                  {shortMonth(m.period)}
                  <span aria-hidden>{m.cumulative < 0 ? "⚠" : "·"}</span>
                </span>
                <span className="mt-1 block font-mono text-[18px] font-semibold text-white">
                  {compact(m.cumulative)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/*
        Ojo con cuál de los dos números va acá. La tira de arriba muestra el
        saldo ACUMULADO (lo que hay en la cuenta al terminar ese mes) y esto
        muestra el NETO del mes (lo que sobra de ese mes solo). Son distintos
        y los dos están en esta pantalla: el acumulado puede estar en verde
        mientras el neto ya es negativo, que es justo el mes en que hay que
        prestar atención.
      */}
      <div className="mt-3 rounded-surface-lg bg-mint-wash px-4 py-3">
        <div className="text-label uppercase text-muted">
          {selected === 0 ? "Este mes te queda" : `En ${shortMonth(month.period).toLowerCase()} te queda`}
        </div>
        <div
          className="mt-1 font-mono text-[22px] font-semibold"
          style={{ color: month.net < 0 ? "#94362A" : "#175F42" }}
        >
          {formatMoney(month.net)}
        </div>
      </div>

      <NetChart months={months} scenarioName={scenarioName} selected={selected} />

      {/* Los mismos meses, ahora como selector del desglose. */}
      <div className="-mx-[18px] mt-4 no-scrollbar overflow-x-auto px-[18px]">
        <div className="flex gap-1">
          {months.map((m, i) => (
            <button
              key={m.period}
              type="button"
              onClick={() => setSelected(i)}
              aria-current={i === selected ? "true" : undefined}
              className="min-h-touch shrink-0 rounded-pill px-[15px] py-[10px] font-mono text-[12px] transition-colors duration-150 ease-sd"
              style={{
                backgroundColor: i === selected ? "#0E3A31" : "transparent",
                color: i === selected ? "#FFFFFF" : "#5C6B65",
                fontWeight: i === selected ? 600 : 400,
              }}
            >
              {shortMonth(m.period)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-surface-lg border border-border bg-surface px-4 py-1">
        <BreakdownRow label="Ingresos" value={month.income} />
        {/*
          El puente sale como línea propia el mes que entra —es plata que no
          es tuya y conviene que se note— pero la devolución vuelve adentro de
          "Deudas del mes": para el mes que la sufre es una obligación más.
        */}
        {month.bridgeIn > 0 && <BreakdownRow label="Préstamo puente" value={month.bridgeIn} />}
        <BreakdownRow label="Gastos fijos" value={-month.expenses} />
        <BreakdownRow label="Deudas del mes" value={-month.debtDue} />
        <BreakdownRow label="Te queda" value={month.net} emphasis />
      </div>
    </>
  );
}

function BreakdownRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  const positive = value >= 0;
  return (
    <div
      className={`flex items-center justify-between gap-3 py-3 ${
        emphasis ? "" : "border-b border-border-row"
      }`}
    >
      <span
        className="text-card"
        style={{ color: emphasis ? (positive ? "#175F42" : "#94362A") : "#12211D" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-[13.5px] font-semibold tabular-nums"
        style={{
          color: emphasis ? (positive ? "#175F42" : "#94362A") : positive ? "#12211D" : "#823123",
        }}
      >
        {positive ? "" : "−"}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}

/**
 * Disponible por mes. Barras desde una línea de cero: arriba lo que sobra,
 * abajo lo que falta. La altura es proporcional al mayor valor absoluto de la
 * serie, así que un mes malo no se ve igual que uno peor.
 */
function NetChart({
  months,
  scenarioName,
  selected,
}: {
  months: CashflowMonth[];
  scenarioName: string;
  selected: number;
}) {
  const max = Math.max(...months.map((m) => Math.abs(m.net)), 1);
  const positives = months.filter((m) => m.net > 0);
  const topLabel = positives.length ? compact(Math.max(...positives.map((m) => m.net))) : null;

  return (
    <div className="mt-3 rounded-surface-lg border border-border bg-surface px-4 py-4">
      <div className="text-label uppercase text-muted">
        Disponible por mes · {scenarioName}
      </div>

      {topLabel && (
        <div className="mt-2 font-mono text-[11px] text-leaf-deep">{topLabel}</div>
      )}

      <div className="mt-2 flex items-stretch gap-2" style={{ height: 150 }}>
        {months.map((m, i) => {
          const ratio = Math.abs(m.net) / max;
          const positive = m.net >= 0;
          return (
            <div key={m.period} className="flex flex-1 flex-col items-center">
              {/* Mitad de arriba: solo crecen las barras positivas. */}
              <div className="flex w-full flex-1 items-end justify-center">
                {positive && (
                  <span
                    className="w-[14px] rounded-t-[4px]"
                    style={{
                      height: `${Math.max(ratio * 100, 2)}%`,
                      backgroundColor: SEVERITY_BG[m.severity],
                      opacity: i === selected ? 1 : 0.75,
                    }}
                  />
                )}
              </div>

              <span className="h-px w-full bg-border-row" aria-hidden />

              <div className="flex w-full flex-1 flex-col items-center justify-start">
                {!positive && (
                  <span
                    className="w-[14px] rounded-b-[4px]"
                    style={{
                      height: `${Math.max(ratio * 100, 2)}%`,
                      backgroundColor: SEVERITY_BG[m.severity],
                      opacity: i === selected ? 1 : 0.75,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        El valor va debajo de su barra y no adentro: adentro de una barra de
        14px no entra, y una barra corta lo dejaría sin fondo suficiente para
        leerse. Solo se etiquetan los meses negativos, que son los que hay que
        poder leer sin tocar nada.
      */}
      <div className="mt-2 flex gap-2">
        {months.map((m) => (
          <div key={m.period} className="flex-1 text-center">
            <div
              className="font-mono text-[10px]"
              style={{ color: m.net < 0 ? SEVERITY_BG[m.severity] : "transparent" }}
            >
              {m.net < 0 ? compact(m.net) : "·"}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted">{shortMonth(m.period)}</div>
          </div>
        ))}
      </div>

      {/* La tabla es el dato accesible; las barras son su forma. */}
      <table className="sr-only">
        <caption>Disponible por mes en {scenarioName}</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.period}>
              <th scope="row">{m.period}</th>
              <td>{formatMoney(m.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
