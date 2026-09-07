/**
 * Alertas derivadas del modelo. Portado de `_deriveAlerts` del prototipo.
 *
 * Una alerta acá no es un título: es un título, una cifra con su etiqueta y un
 * lugar a donde ir. Sin la cifra la alerta no dice cuánto duele, y sin el
 * destino es una preocupación sin salida — que es justo lo que esta app no
 * quiere producir.
 *
 * Solo se derivan las cinco que el modelo puede sostener. Las que dependen de
 * comparar filas del flujo entre sí (doble conteo, gasto no capturado, mes no
 * reflejado) todavía hay que verlas a ojo, y la pantalla lo dice en vez de
 * simular que las mira.
 */

import type { CashflowResult } from "./cashflow";
import { monthName } from "./cashflow";

export type AlertKind =
  | "saldo_creciente"
  | "vencimiento_hoy"
  | "mes_no_cierra"
  | "cuotas_fijas"
  | "tasa_mas_cara";

export interface DerivedAlert {
  kind: AlertKind;
  /**
   * Identifica la instancia concreta, para poder posponer una alerta sin
   * silenciar toda su categoría de por vida. "-" para las que no cuelgan de
   * una deuda.
   */
  subjectId: string;
  /** brick = vence o el saldo crece; gold = cuesta plata. */
  severity: "brick" | "gold";
  icon: string;
  title: string;
  body: string;
  metricLabel: string;
  metricValue: number;
  ctaLabel: string;
  href: string;
  debtId: string | null;
}

export interface AlertDebt {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number | null;
  /** Tasa mensual en decimal. */
  monthlyRate: number;
  dueDay: number | null;
  minimumPayment: number | null;
}

/** Las que vencen sí o sí: la cuota no se puede pagar a medias como un mínimo. */
export function isLoanLike(kind: string): boolean {
  return kind !== "tarjeta" && kind !== "otro";
}

/** "Mastercard Black …3311" -> "Mastercard Black". Los títulos no necesitan el número. */
function shortName(name: string): string {
  return name.replace(/\s*…\s*\d+$/, "").trim();
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function shortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}-${MONTHS_SHORT[date.getMonth()]}`;
}

/**
 * El día del resumen es el dato; la fecha del próximo vencimiento se deriva de
 * hoy. Si el día ya pasó este mes, el vencimiento vigente es el del mes que
 * viene. Un préstamo con cuota fija no tiene día de vencimiento de tarjeta.
 */
export function nextDueDate(debt: AlertDebt, today: Date): Date | null {
  if (debt.dueDay == null || isLoanLike(debt.kind)) return null;
  const clamp = (year: number, month: number) =>
    new Date(year, month, Math.min(debt.dueDay!, new Date(year, month + 1, 0).getDate()));
  const thisMonth = clamp(today.getFullYear(), today.getMonth());
  return thisMonth.getDate() >= today.getDate()
    ? thisMonth
    : clamp(today.getFullYear(), today.getMonth() + 1);
}

export function deriveAlerts(params: {
  debts: AlertDebt[];
  cashflow: CashflowResult;
  /** Si la proyección tiene ingresos con qué decir algo. */
  canProject: boolean;
  scenarioName: string;
  /** Ingreso mensual recurrente y gastos fijos en efectivo, para medir el peso de las cuotas. */
  monthlyIncome: number;
  monthlyFixed: number;
  /** Ventana de aviso, en días. */
  leadDays: number;
  today?: Date;
}): DerivedAlert[] {
  const today = params.today ?? new Date();
  const window = Math.max(1, params.leadDays);
  const out: DerivedAlert[] = [];

  // 1 · el mínimo no cubre el interés del mes, así que el saldo crece.
  //     Va la peor, no todas: cinco tarjetas creciendo son cinco veces el
  //     mismo aviso y ninguna decisión distinta.
  const growing = params.debts
    .filter((d) => !isLoanLike(d.kind) && d.balance > 0 && d.minimumPayment != null)
    .map((d) => ({ debt: d, interest: Math.round(d.balance * d.monthlyRate) }))
    .filter((x) => (x.debt.minimumPayment ?? 0) < x.interest)
    .sort((a, b) => b.interest - (b.debt.minimumPayment ?? 0) - (a.interest - (a.debt.minimumPayment ?? 0)))[0];

  if (growing) {
    out.push({
      kind: "saldo_creciente",
      subjectId: growing.debt.id,
      severity: "brick",
      icon: "↗",
      title: `El saldo de ${shortName(growing.debt.name)} sigue creciendo`,
      body: "El mínimo del resumen no alcanza a cubrir el interés del mes, así que la diferencia se suma al saldo.",
      metricLabel: "Punto de equilibrio",
      metricValue: growing.interest,
      ctaLabel: "Ver la deuda",
      href: `/dashboard/debts/${growing.debt.id}`,
      debtId: growing.debt.id,
    });
  }

  // 2 · vencimientos apilados dentro de la ventana de aviso. Se agrupan porque
  //     el problema no es que venza una: es que vencen tres juntas.
  const DAY = 86_400_000;
  const dues = params.debts
    .map((d) => {
      const date = nextDueDate(d, today);
      return date ? { debt: d, time: date.getTime(), date } : null;
    })
    .filter((x): x is { debt: AlertDebt; time: number; date: Date } => x !== null)
    .sort((a, b) => a.time - b.time);

  let cluster: typeof dues | null = null;
  for (const d of dues) {
    const group = dues.filter((x) => x.time >= d.time && x.time <= d.time + window * DAY);
    if (group.length >= 2 && (!cluster || group.length > cluster.length)) cluster = group;
  }

  if (cluster) {
    out.push({
      kind: "vencimiento_hoy",
      subjectId: "-",
      severity: "gold",
      icon: "⏱",
      title: `${cluster.length} vencimientos en ${window} ${window === 1 ? "día" : "días"}`,
      body: `${cluster.map((v) => shortName(v.debt.name)).join(", ")} — entre el ${shortDate(cluster[0].date)} y el ${shortDate(cluster[cluster.length - 1].date)}.`,
      metricLabel: "Total a cubrir",
      metricValue: cluster.reduce((sum, v) => sum + (v.debt.minimumPayment ?? 0), 0),
      ctaLabel: "Ver flujo de caja",
      href: "/dashboard/cashflow",
      debtId: null,
    });
  }

  // 3 · el mes en que el colchón se da vuelta. Sin ingresos cargados la
  //     proyección da todo cero, y cero no es rojo: no habría nada que avisar.
  const gap = params.cashflow.firstGapIndex;
  if (params.canProject && gap >= 0) {
    const month = params.cashflow.months[gap];
    out.push({
      kind: "mes_no_cierra",
      subjectId: "-",
      severity: "brick",
      icon: "↘",
      title: `En ${monthName(month.period)} el mes no cierra`,
      body: `Con el ${params.scenarioName.toLowerCase()}, el colchón queda en negativo después de pagar los vencimientos de ese mes.`,
      metricLabel: "Faltan",
      metricValue: Math.abs(Math.round(month.cumulative)),
      ctaLabel: "Ver flujo de caja",
      href: "/dashboard/cashflow",
      debtId: null,
    });
  }

  // 4 · las cuotas fijas comprometen el mes antes de empezar.
  const loans = params.debts.filter((d) => isLoanLike(d.kind) && d.balance > 0);
  const loanTotal = loans.reduce((sum, d) => sum + (d.minimumPayment ?? 0), 0);
  const capacity = Math.max(0, params.monthlyIncome - params.monthlyFixed);

  if (loans.length > 0 && loanTotal > 0 && capacity > 0 && loanTotal > capacity * 0.4) {
    const share = Math.round((loanTotal / capacity) * 100);
    out.push({
      kind: "cuotas_fijas",
      subjectId: "-",
      severity: loanTotal >= capacity ? "brick" : "gold",
      icon: "=",
      title: `Las cuotas fijas se llevan el ${share}% de lo que te queda`,
      body: `${loans.length === 1 ? `${shortName(loans[0].name)} vence` : `${loans.length} préstamos vencen`} sí o sí cada mes: la cuota no se puede pagar a medias como el mínimo de una tarjeta.`,
      metricLabel: "Cuotas del mes",
      metricValue: loanTotal,
      ctaLabel: "Ver flujo de caja",
      href: "/dashboard/cashflow",
      debtId: null,
    });
  }

  // 5 · la tasa más alta de la cartera: cuesta plata, no vence.
  const worst = params.debts
    .filter((d) => d.annualRate != null && d.balance > 0)
    .sort((a, b) => b.monthlyRate - a.monthlyRate)[0];

  if (worst) {
    out.push({
      kind: "tasa_mas_cara",
      subjectId: worst.id,
      severity: "gold",
      icon: "%",
      title: `Tu deuda más cara está al ${worst.annualRate!.toLocaleString("es-AR")}% TNA`,
      body: `${shortName(worst.name)} es la primera que conviene atacar si te sobra algo este mes.`,
      metricLabel: isLoanLike(worst.kind) ? "Cuota fija" : "Mínimo",
      metricValue: worst.minimumPayment ?? 0,
      ctaLabel: "Ver la deuda",
      href: `/dashboard/debts/${worst.id}`,
      debtId: worst.id,
    });
  }

  return out;
}

/**
 * Hasta cuándo se pospone. Portado del prototipo: vuelve mañana, o antes si el
 * vencimiento aprieta — posponer no puede tapar el aviso justo cuando importa.
 */
export function snoozeUntil(params: {
  dueDate: Date | null;
  now?: Date;
}): Date {
  const now = params.now ?? new Date();
  const DAY = 86_400_000;
  let until = now.getTime() + DAY;

  if (params.dueDate) {
    const eve = params.dueDate.getTime() - DAY;
    if (eve > now.getTime()) until = Math.min(until, eve);
  }

  return new Date(until);
}
