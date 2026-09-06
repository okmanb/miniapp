import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, recurringChargeFor, type ExpenseLike } from "@/lib/calc/balance";
import { amortize, breakeven } from "@/lib/calc/amortize";
import { explainGrowth, type GrowthCause } from "@/lib/calc/statement";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { addMonths } from "@/lib/calc/cashflow";
import { currentPeriod } from "@/lib/data/dashboard";

/**
 * Lectura del detalle de una deuda (pantalla 03) y de sus cuotas (09).
 *
 * La comparación de pagos es deliberadamente simple —asume el mismo monto
 * todos los meses— y la pantalla lo dice con todas las letras. Es una
 * comparación entre dos ritmos, no una proyección: si la presentáramos como
 * una predicción estaríamos prometiendo algo que el modelo no sostiene.
 */

export interface PayoffOption {
  label: string;
  monthlyPayment: number;
  /** null = a ese ritmo no se salda. */
  months: number | null;
  totalInterest: number | null;
}

export interface DebtInstallment {
  id: string;
  description: string;
  current: number;
  total: number;
  remaining: number;
  amount: number;
  tna: number | null;
  endsOn: string;
  finished: boolean;
}

export interface DebtPaymentRow {
  id: string;
  period: string;
  paidOn: string | null;
  amount: number;
  kind: string;
  note: string | null;
}

export interface DebtDetail {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number | null;
  dueDay: number | null;
  nextDueLabel: string | null;
  monthlyInterest: number;
  minimumPayment: number | null;
  recurringCharge: number;
  breakevenAmount: number;
  growth: GrowthCause | null;
  health: "al_dia" | "crece" | "sin_datos";
  payoff: { minimum: PayoffOption; double: PayoffOption; savings: number | null } | null;
  installments: DebtInstallment[];
  payments: DebtPaymentRow[];
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

/**
 * El día del resumen es el dato; la fecha del próximo vencimiento se deriva de
 * hoy. Si el día ya pasó este mes, el vencimiento vigente es el del mes que
 * viene. Se topea al último día del mes para que un vencimiento el 31 no se
 * caiga a marzo en febrero.
 */
export function nextDueDate(dueDay: number, today = new Date()): Date {
  const clamp = (year: number, monthIndex: number) =>
    new Date(year, monthIndex, Math.min(dueDay, new Date(year, monthIndex + 1, 0).getDate()));

  const thisMonth = clamp(today.getFullYear(), today.getMonth());
  if (thisMonth.getDate() >= today.getDate()) return thisMonth;
  return clamp(today.getFullYear(), today.getMonth() + 1);
}

function formatLongDate(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`;
}

export const getDebtDetail = cache(async function getDebtDetail(
  debtId: string
): Promise<DebtDetail | null> {
  const supabase = await createClient();

  const { data: debt, error } = await supabase
    .from("debts")
    .select("id, name, kind, scenario_id, base_balance, annual_interest_rate, tem, due_day")
    .eq("id", debtId)
    .maybeSingle();

  if (error) throw error;
  if (!debt) return null;

  const [expensesRes, paymentsRes, statementsRes, plansRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("debt_id, amount, is_archived, is_recurring, period, ended_period")
      .eq("scenario_id", debt.scenario_id),
    supabase
      .from("debt_payments")
      .select("id, debt_id, amount, period, paid_on, kind, note")
      .eq("debt_id", debtId)
      .order("period", { ascending: false }),
    supabase
      .from("card_statements")
      .select("minimum_payment, period")
      .eq("debt_id", debtId)
      .order("period", { ascending: false }),
    supabase
      .from("card_installment_plans")
      .select("id, description, cupon, first_period, total_installments, installment_amount, tna")
      .eq("debt_id", debtId)
      .eq("is_active", true),
  ]);

  for (const res of [expensesRes, paymentsRes, statementsRes, plansRes]) {
    if (res.error) throw res.error;
  }

  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const statements = statementsRes.data ?? [];
  const plans = plansRes.data ?? [];

  const period = currentPeriod();

  const balance = deriveBalance(
    {
      id: debt.id,
      base_balance: Number(debt.base_balance),
      annual_interest_rate: debt.annual_interest_rate,
      tem: debt.tem,
    },
    expenses,
    payments.map((p) => ({ debt_id: p.debt_id, amount: Number(p.amount) }))
  );

  const annualRate = debt.annual_interest_rate != null ? Number(debt.annual_interest_rate) : null;
  const monthlyRate = debt.tem != null ? Number(debt.tem) : monthlyRateFromAnnual(annualRate);
  const monthlyInterest = Math.round(balance * monthlyRate);
  const recurringCharge = recurringChargeFor(debt.id, expenses, period);
  const minimumPayment =
    statements[0]?.minimum_payment != null ? Number(statements[0].minimum_payment) : null;

  const growth =
    minimumPayment != null
      ? explainGrowth({ balance, annualRate, minimumPayment, recurringCharge })
      : null;

  // La comparación necesita un monto de referencia: el mínimo del resumen.
  // Sin resumen cargado no se inventa uno — la pantalla ofrece cargarlo.
  let payoff: DebtDetail["payoff"] = null;
  if (minimumPayment != null && minimumPayment > 0) {
    const min = amortize({ balance, annualRate, payment: minimumPayment, recurringCharge });
    const dbl = amortize({ balance, annualRate, payment: minimumPayment * 2, recurringCharge });

    payoff = {
      minimum: {
        label: "mínimo",
        monthlyPayment: minimumPayment,
        months: min.months,
        totalInterest: min.interest,
      },
      double: {
        label: "el doble",
        monthlyPayment: minimumPayment * 2,
        months: dbl.months,
        totalInterest: dbl.interest,
      },
      // Solo hay ahorro que mostrar si las dos ramas cierran. Si al mínimo no
      // se salda nunca, el ahorro no es un número: es "esto no termina".
      savings:
        min.interest != null && dbl.interest != null ? min.interest - dbl.interest : null,
    };
  }

  const installments: DebtInstallment[] = plans.map((p) => {
    const [fy, fm] = p.first_period.split("-").map(Number);
    const [cy, cm] = period.split("-").map(Number);
    const elapsed = (cy - fy) * 12 + (cm - fm) + 1;
    const remaining = Math.max(p.total_installments - elapsed + 1, 0);
    return {
      id: p.id,
      description: p.description ?? `Cuota (cupón ${p.cupon ?? "—"})`,
      current: Math.min(Math.max(elapsed, 0), p.total_installments),
      total: p.total_installments,
      remaining,
      amount: Number(p.installment_amount),
      tna: p.tna != null ? Number(p.tna) : null,
      endsOn: periodLabel(addMonths(p.first_period, p.total_installments - 1)),
      finished: remaining === 0,
    };
  });

  const due = debt.due_day != null ? nextDueDate(debt.due_day) : null;

  return {
    id: debt.id,
    name: debt.name,
    kind: debt.kind,
    balance,
    annualRate,
    dueDay: debt.due_day,
    nextDueLabel: due ? formatLongDate(due) : null,
    monthlyInterest,
    minimumPayment,
    recurringCharge,
    breakevenAmount: Math.round(breakeven({ balance, annualRate, recurringCharge })),
    growth,
    health: minimumPayment == null ? "sin_datos" : growth ? "crece" : "al_dia",
    payoff,
    installments,
    payments: payments.map((p) => ({
      id: p.id,
      period: p.period,
      paidOn: p.paid_on,
      amount: Number(p.amount),
      kind: p.kind,
      note: p.note,
    })),
  };
});
