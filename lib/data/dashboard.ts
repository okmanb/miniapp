import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, recurringChargeFor, type ExpenseLike } from "@/lib/calc/balance";
import { explainGrowth, type GrowthCause } from "@/lib/calc/statement";
import {
  projectCashflow,
  monthName,
  type CashflowResult,
  type IncomeLike,
} from "@/lib/calc/cashflow";

/**
 * Lectura del dashboard.
 *
 * Ninguna cifra de acá está guardada. El saldo de cada deuda se deriva de su
 * saldo base, sus pagos y sus gastos abiertos; el total es la suma de esos
 * derivados; el alcance sale de proyectar la caja; y las alertas se derivan
 * del modelo en cada lectura, no de una tabla de alertas que alguien tenga
 * que mantener al día.
 */

export interface DashboardDebt {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number | null;
  dueDay: number | null;
  recurringCharge: number;
  growth: GrowthCause | null;
  minimumPayment: number | null;
  /** Obligación mensual comprometida: la entry del plan, o el mínimo. */
  monthlyDue: number;
  /** Si el atajo del mínimo ya se aplicó este mes. */
  minimumPaidThisMonth: boolean;
  /** Total pagado a esta deuda, de todos los meses. */
  paid: number;
  /**
   * Fracción saldada, entre 0 y 1. Se deriva de pagado / (pagado + saldo) y
   * no de una columna: al registrar un pago tiene que moverse sola.
   */
  paidFraction: number;
  /** Cuántas compras en cuotas activas trae y cuánto suman. */
  installmentCount: number;
  installmentTotal: number;
}

export type AlertKind =
  | "saldo_creciente"
  | "vencimiento_hoy"
  | "tasa_mas_cara"
  | "mes_no_reflejado";

export interface DerivedAlert {
  kind: AlertKind;
  /** brick = vence o el saldo crece; gold = cuesta plata. */
  severity: "brick" | "gold";
  title: string;
  debtId: string | null;
}

export interface DashboardData {
  scenarioId: string;
  scenarioName: string;
  debts: DashboardDebt[];
  total: number;
  delta: number;
  series: number[];
  hasOverdue: boolean;
  cashflow: CashflowResult;
  runwayMonth: string | null;
  runwayNote: string;
  alerts: DerivedAlert[];
}

export function currentPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Días de aviso antes de un vencimiento. El prototipo usa 3 por defecto. */
const DUE_SOON_DAYS = 3;

/**
 * Memoizado por request: el layout lo usa para el contador de alertas del nav
 * y la página para todo lo demás, y aun así la base se consulta una sola vez.
 */
export const getDashboard = cache(async function getDashboard(): Promise<DashboardData | null> {
  const supabase = await createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, name, starting_balance")
    .eq("is_active", true)
    .maybeSingle();

  if (scenarioError) throw scenarioError;
  if (!scenario) return null;

  const [debtsRes, expensesRes, paymentsRes, statementsRes, incomesRes, scheduleRes, plansRes] =
    await Promise.all([
      supabase
        .from("debts")
        .select("id, name, kind, base_balance, annual_interest_rate, tem, due_day")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true),
      supabase
        .from("expenses")
        .select("debt_id, amount, is_archived, is_recurring, period, ended_period")
        .eq("scenario_id", scenario.id),
      supabase
        .from("debt_payments")
        .select("debt_id, amount, period, kind")
        .eq("scenario_id", scenario.id),
      supabase
        .from("card_statements")
        .select("debt_id, period, minimum_payment, total_due")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false }),
      supabase
        .from("incomes")
        .select("amount, kind, eligible_months, period, ended_period")
        .eq("scenario_id", scenario.id),
      supabase
        .from("debt_schedule_entries")
        .select("debt_id, period, amount")
        .eq("scenario_id", scenario.id),
      supabase
        .from("card_installment_plans")
        .select("debt_id, first_period, total_installments, installment_amount")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true),
    ]);

  for (const res of [debtsRes, expensesRes, paymentsRes, statementsRes, incomesRes, scheduleRes, plansRes]) {
    if (res.error) throw res.error;
  }

  const rawDebts = debtsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const statements = statementsRes.data ?? [];
  const incomes = (incomesRes.data ?? []) as IncomeLike[];
  const schedule = scheduleRes.data ?? [];
  const plans = plansRes.data ?? [];

  const period = currentPeriod();

  const debts: DashboardDebt[] = rawDebts.map((d) => {
    const balance = deriveBalance(
      {
        id: d.id,
        base_balance: Number(d.base_balance),
        annual_interest_rate: d.annual_interest_rate,
        tem: d.tem,
      },
      expenses,
      payments
    );

    const recurringCharge = recurringChargeFor(d.id, expenses, period);
    const latest = statements.find((s) => s.debt_id === d.id);
    const minimumPayment = latest?.minimum_payment != null ? Number(latest.minimum_payment) : null;

    const paid = payments
      .filter((p) => p.debt_id === d.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalEverOwed = paid + balance;

    // Cuotas que corren este mes: una que ya terminó no se "incluye" en nada.
    const activePlans = plans.filter((p) => {
      if (p.debt_id !== d.id) return false;
      const [fy, fm] = p.first_period.split("-").map(Number);
      const [cy, cm] = period.split("-").map(Number);
      const elapsed = (cy - fy) * 12 + (cm - fm) + 1;
      return elapsed >= 1 && elapsed <= p.total_installments;
    });

    return {
      paid,
      paidFraction: totalEverOwed > 0 ? paid / totalEverOwed : 0,
      installmentCount: activePlans.length,
      installmentTotal: activePlans.reduce((sum, p) => sum + Number(p.installment_amount), 0),
      id: d.id,
      name: d.name,
      kind: d.kind,
      balance,
      annualRate: d.annual_interest_rate != null ? Number(d.annual_interest_rate) : null,
      dueDay: d.due_day,
      recurringCharge,
      minimumPayment,
      monthlyDue: minimumPayment ?? 0,
      minimumPaidThisMonth: payments.some(
        (p) => p.debt_id === d.id && p.period === period && p.kind === "minimo_estimado"
      ),
      growth:
        minimumPayment != null
          ? explainGrowth({
              balance,
              annualRate: d.annual_interest_rate,
              minimumPayment,
              recurringCharge,
            })
          : null,
    };
  });

  const total = debts.reduce((sum, d) => sum + d.balance, 0);

  const paidThisMonth = payments
    .filter((p) => p.period === period)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const delta = -paidThisMonth;

  const byPeriod = new Map<string, number>();
  for (const s of statements) {
    byPeriod.set(s.period, (byPeriod.get(s.period) ?? 0) + Number(s.total_due));
  }
  const series = [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .concat(total);

  // La obligación de un mes es la entry del plan si está cargada —dato de más
  // confianza que cualquier estimación nuestra— y si no, la suma de mínimos.
  const scheduleByPeriod = new Map<string, number>();
  for (const e of schedule) {
    scheduleByPeriod.set(e.period, (scheduleByPeriod.get(e.period) ?? 0) + Number(e.amount));
  }
  const totalMinimums = debts.reduce((sum, d) => sum + d.monthlyDue, 0);
  const debtDueFor = (p: string) => scheduleByPeriod.get(p) ?? totalMinimums;

  const cashflow = projectCashflow({
    startBalance: Number(scenario.starting_balance),
    startPeriod: period,
    months: 6,
    incomes,
    expenses,
    debtDueFor,
  });

  const today = new Date().getDate();
  const hasOverdue = debts.some((d) => d.dueDay != null && d.dueDay < today && d.balance > 0);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    debts,
    total,
    delta,
    series: series.length >= 2 ? series : [total, total],
    hasOverdue,
    cashflow,
    runwayMonth:
      cashflow.runwayIndex >= 0 ? monthName(cashflow.months[cashflow.runwayIndex].period) : null,
    runwayNote: buildRunwayNote(cashflow, scenario.name),
    alerts: deriveAlerts(debts, today),
  };
});

function buildRunwayNote(cashflow: CashflowResult, scenarioName: string): string {
  if (cashflow.months.length === 0) return `Todavía no hay meses proyectados. Escenario: ${scenarioName}.`;

  if (cashflow.runwayIndex < 0) {
    return `Los gastos y los pagos de este mes superan lo que entra. Escenario: ${scenarioName}.`;
  }
  if (cashflow.firstGapIndex < 0) {
    return `La proyección no toca rojo en los próximos ${cashflow.months.length} meses. Escenario: ${scenarioName}.`;
  }
  const gap = monthName(cashflow.months[cashflow.firstGapIndex].period);
  return `Desde ${gap} el saldo queda en rojo. Escenario: ${scenarioName}.`;
}

/**
 * Alertas derivadas del modelo. Los tipos salen de
 * handoff/RESCATE-integridad-y-alertas.md.
 *
 * Solo se derivan las que este modelo puede sostener hoy: las que dependen de
 * comparar filas del flujo entre sí (doble_conteo, mes_no_reflejado,
 * gasto_no_capturado) necesitan la pantalla de flujo de caja, y se agregan
 * ahí. Inventar una alerta que no se puede derivar sería exactamente el tipo
 * de cifra a mano que la regla de oro prohíbe.
 */
function deriveAlerts(debts: DashboardDebt[], today: number): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const debt of debts) {
    if (debt.growth) {
      alerts.push({
        kind: "saldo_creciente",
        severity: "brick",
        title: `El saldo de ${debt.name} sigue creciendo`,
        debtId: debt.id,
      });
    }

    if (debt.dueDay != null && debt.balance > 0) {
      const daysAway = debt.dueDay - today;
      if (daysAway >= 0 && daysAway <= DUE_SOON_DAYS) {
        alerts.push({
          kind: "vencimiento_hoy",
          severity: "brick",
          title:
            daysAway === 0
              ? `${debt.name} vence hoy`
              : `${debt.name} vence en ${daysAway} ${daysAway === 1 ? "día" : "días"}`,
          debtId: debt.id,
        });
      }
    }
  }

  // La deuda más cara del escenario: cuesta plata, no vence. Va en gold.
  const rated = debts.filter((d) => d.annualRate != null && d.balance > 0);
  if (rated.length > 1) {
    const worst = rated.reduce((a, b) => (a.annualRate! > b.annualRate! ? a : b));
    alerts.push({
      kind: "tasa_mas_cara",
      severity: "gold",
      title: `${worst.name} es la más cara: ${worst.annualRate!.toLocaleString("es-AR")}% anual`,
      debtId: worst.id,
    });
  }

  return alerts;
}
