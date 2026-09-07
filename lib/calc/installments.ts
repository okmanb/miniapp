/**
 * Compras en cuotas y refinanciaciones.
 *
 * Cada una es su propia deuda ligada a una tarjeta: se amortiza sola, con su
 * plazo y su tasa, y no sigue el ritmo del saldo de la tarjeta.
 *
 * El dato que guardamos es la cuota mensual, porque es lo que dice el resumen
 * del banco. El saldo de la compra es lo que se deriva: el valor presente de
 * las cuotas que faltan. El prototipo va al revés —guarda el saldo y deriva la
 * cuota— y da el mismo número; la diferencia es cuál de los dos es el dato y
 * cuál la cuenta, y acá el dato tiene que ser el que trae el PDF.
 */

/** Valor presente de `count` cuotas de `amount` a la tasa mensual dada. */
export function presentValue(amount: number, count: number, monthlyRate: number): number {
  if (count <= 0) return 0;
  // Una cuota sin interés no se descuenta: lo que falta es lo que falta.
  if (monthlyRate <= 0) return amount * count;
  return (amount * (1 - Math.pow(1 + monthlyRate, -count))) / monthlyRate;
}

/** Cuota francesa: cuánto por mes amortiza `total` en `count` cuotas. */
export function installmentFor(total: number, count: number, monthlyRate: number): number {
  if (count <= 0) return 0;
  if (monthlyRate <= 0) return total / count;
  return (total * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -count));
}

export interface InstallmentPlanRow {
  id: string;
  description: string | null;
  cupon: string | null;
  first_period: string;
  total_installments: number;
  installment_amount: number | string;
  tna: number | string | null;
}

export interface InstallmentPlanView {
  id: string;
  description: string;
  /** Cuota que corre ahora, 1-based y topeada en el total. */
  current: number;
  total: number;
  remaining: number;
  amount: number;
  /** Lo que falta pagar de esta compra, a valor de hoy. */
  balance: number;
  /** Lo que se va a pagar de interés por esta compra, de acá al final. */
  projectedInterest: number;
  tna: number | null;
  finished: boolean;
  /** "jul 2027" */
  endsOn: string;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function viewInstallmentPlan(
  plan: InstallmentPlanRow,
  period: string
): InstallmentPlanView {
  const total = plan.total_installments;
  const amount = Number(plan.installment_amount);
  const tna = plan.tna != null ? Number(plan.tna) : null;
  const monthlyRate = tna != null ? tna / 100 / 12 : 0;

  const elapsed = monthsBetween(plan.first_period, period) + 1;
  const paid = Math.min(Math.max(elapsed - 1, 0), total);
  const remaining = total - paid;
  const balance = presentValue(amount, remaining, monthlyRate);

  return {
    id: plan.id,
    description: plan.description ?? `Cuota (cupón ${plan.cupon ?? "—"})`,
    current: Math.min(Math.max(elapsed, 1), total),
    total,
    remaining,
    amount,
    balance: Math.round(balance),
    projectedInterest: Math.round(remaining * amount - balance),
    tna,
    finished: remaining <= 0,
    endsOn: periodLabel(addMonths(plan.first_period, total - 1)),
  };
}
