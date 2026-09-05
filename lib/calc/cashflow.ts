/**
 * Proyección de caja mes a mes. Portado de `_proj` del prototipo.
 *
 *   neto[i]    = ingresos[i] − gastos en efectivo − obligaciones de deuda[i]
 *   acumulado  = suma corrida de los netos, arrancando del saldo inicial
 *
 * El alcance ("te alcanza hasta fin de octubre") es el ÚLTIMO mes con
 * acumulado ≥ 0, no el primero en rojo. No es lo mismo cuando un mes se
 * recupera después de uno malo, y el prototipo muestra el último bueno.
 *
 * Los gastos que entran acá son solo los que salen del efectivo: un gasto
 * cargado a una tarjeta ya está adentro del saldo de esa tarjeta, y la
 * tarjeta ya aparece en el flujo por su pago mensual. Sumarlo sería el doble
 * conteo que la app tiene que avisar, no cometer.
 */

import { expenseAppliesTo, type ExpenseLike } from "./balance";

export interface IncomeLike {
  amount: number;
  kind: "mensual" | "aguinaldo" | "bono";
  /** Meses del año (1-12) en que entra. Vacío = todos. */
  eligible_months: number[];
  period: string;
  ended_period: string | null;
}

export interface CashflowMonth {
  period: string;
  income: number;
  expenses: number;
  debtDue: number;
  net: number;
  cumulative: number;
  severity: Severity;
}

export type Severity = "ok" | "justo" | "rojo1" | "rojo2" | "rojo3";

/** Umbrales del prototipo sobre el saldo acumulado. */
export function severityOf(value: number): Severity {
  if (value >= 1_000_000) return "ok";
  if (value >= 0) return "justo";
  if (value > -1_000_000) return "rojo1";
  if (value > -2_000_000) return "rojo2";
  return "rojo3";
}

export function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Si un ingreso entra en un período dado. */
export function incomeAppliesTo(income: IncomeLike, period: string): boolean {
  if (period < income.period) return false;
  if (income.ended_period && period >= income.ended_period) return false;
  // Aguinaldo y bono caen solo en su mes: no se prorratean.
  if (income.eligible_months.length === 0) return true;
  const month = Number(period.split("-")[1]);
  return income.eligible_months.includes(month);
}

export interface CashflowResult {
  months: CashflowMonth[];
  /** Índice del último mes con acumulado ≥ 0. -1 = no alcanza ni el primero. */
  runwayIndex: number;
  /** Índice del primer mes en rojo. -1 = ninguno. */
  firstGapIndex: number;
  /** Plata que queda al final del último mes que todavía da positivo. */
  remainingAtRunway: number;
}

export function projectCashflow(params: {
  startBalance: number;
  startPeriod: string;
  months: number;
  incomes: IncomeLike[];
  expenses: ExpenseLike[];
  /** Obligación de deuda por período: mínimos, cuotas y pagos comprometidos. */
  debtDueFor: (period: string) => number;
}): CashflowResult {
  const months: CashflowMonth[] = [];
  let cumulative = params.startBalance;

  for (let i = 0; i < params.months; i++) {
    const period = addMonths(params.startPeriod, i);

    const income = params.incomes
      .filter((inc) => incomeAppliesTo(inc, period))
      .reduce((sum, inc) => sum + Number(inc.amount), 0);

    const expenses = params.expenses
      .filter((e) => e.debt_id === null && expenseAppliesTo(e, period))
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const debtDue = params.debtDueFor(period);
    const net = income - expenses - debtDue;
    cumulative += net;

    months.push({
      period,
      income,
      expenses,
      debtDue,
      net,
      cumulative,
      severity: severityOf(cumulative),
    });
  }

  let runwayIndex = -1;
  months.forEach((m, i) => {
    if (m.cumulative >= 0) runwayIndex = i;
  });

  return {
    months,
    runwayIndex,
    firstGapIndex: months.findIndex((m) => m.cumulative < 0),
    remainingAtRunway: runwayIndex >= 0 ? months[runwayIndex].cumulative : months[0]?.cumulative ?? 0,
  };
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function monthName(period: string): string {
  return MONTHS_ES[Number(period.split("-")[1]) - 1];
}
