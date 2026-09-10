import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, recurringChargeFor, type ExpenseLike } from "@/lib/calc/balance";
import { explainGrowth, type GrowthCause } from "@/lib/calc/statement";
import { BRIDGE_COLUMNS, toBridgeFlows, type BridgeLoanRow } from "@/lib/data/bridges";
import { deriveAlerts, type AlertDebt, type DerivedAlert } from "@/lib/calc/alerts";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import {
  ALERT_SETTINGS_COLUMNS,
  DEFAULT_ALERT_SETTINGS,
  toAlertSettings,
  type AlertSettings,
} from "@/lib/data/alert-settings";
import {
  projectCashflow,
  monthName,
  incomeAppliesTo,
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
  /**
   * El día de vencimiento de este mes ya pasó y todavía debe. Es la misma
   * definición que usa `hasOverdue`, que ahora sale de acá: si fueran dos
   * cuentas distintas, tarde o temprano la tarjeta y el encabezado dirían
   * cosas diferentes del mismo mes.
   */
  overdue: boolean;
}

export type { AlertKind, DerivedAlert } from "@/lib/calc/alerts";
export type { AlertSettings } from "@/lib/data/alert-settings";

export interface DashboardData {
  scenarioId: string;
  scenarioName: string;
  debts: DashboardDebt[];
  total: number;
  delta: number;
  series: number[];
  hasOverdue: boolean;
  cashflow: CashflowResult;
  /**
   * Si la proyección tiene con qué decir algo. Sin ingresos cargados todos
   * los meses dan cero, y como cero nunca es menor que cero el alcance sale
   * "no toca rojo en 6 meses" — una afirmación tranquilizadora sacada de la
   * nada. Eso es justo lo que la regla de oro prohíbe.
   */
  canProject: boolean;
  runwayMonth: string | null;
  runwayNote: string;
  alerts: DerivedAlert[];
  /** Cuántas alertas hay pospuestas ahora mismo, para poder reactivarlas. */
  snoozedCount: number;
  alertSettings: AlertSettings;
}

export function currentPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

  const [debtsRes, expensesRes, paymentsRes, statementsRes, incomesRes, scheduleRes, plansRes, bridgesRes, settingsRes, dismissalsRes] =
    await Promise.all([
      supabase
        .from("debts")
        .select("id, name, kind, base_balance, annual_interest_rate, tem, due_day, monthly_payment, status, original_amount")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true),
      supabase
        .from("expenses")
        .select("debt_id, amount, is_archived, is_recurring, period, ended_period")
        .eq("scenario_id", scenario.id),
      supabase
        .from("debt_payments")
        .select("debt_id, amount, period, kind, is_absorbed")
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
      supabase.from("bridge_loans").select(BRIDGE_COLUMNS).eq("scenario_id", scenario.id),
      supabase.from("alert_settings").select(ALERT_SETTINGS_COLUMNS).maybeSingle(),
      supabase
        .from("alert_dismissals")
        .select("kind, subject_id, snoozed_until")
        .eq("scenario_id", scenario.id),
    ]);

  for (const res of [debtsRes, expensesRes, paymentsRes, statementsRes, incomesRes, scheduleRes, plansRes, bridgesRes]) {
    if (res.error) throw res.error;
  }

  const rawDebts = debtsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const todayDay = new Date().getDate();
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

    // El mínimo del último resumen es el dato preferido: lo dice el banco. Una
    // deuda sin resumen —un préstamo— no tiene ninguno, y ahí manda la cuota
    // que la persona cargó. Sin ese respaldo el préstamo entraba al flujo con
    // cuota cero y la proyección lo ignoraba por completo.
    const minimumPayment =
      latest?.minimum_payment != null
        ? Number(latest.minimum_payment)
        : d.monthly_payment != null
          ? Number(d.monthly_payment)
          : null;

    const paid = payments
      .filter((p) => p.debt_id === d.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalEverOwed = paid + balance;
    const original = d.original_amount != null ? Number(d.original_amount) : null;

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
      /*
       * Con monto original, la fracción saldada es la de verdad: cuánto de la
       * deuda entera queda. Sin él solo se puede medir contra lo que la app
       * vio pagar, y una deuda que arrancó antes que la app se ve más nueva de
       * lo que es. Por eso el campo se carga a mano: no hay de dónde derivarlo.
       */
      paidFraction: original != null && original > 0
        ? Math.min(Math.max((original - balance) / original, 0), 1)
        : totalEverOwed > 0
          ? paid / totalEverOwed
          : 0,
      installmentCount: activePlans.length,
      installmentTotal: activePlans.reduce((sum, p) => sum + Number(p.installment_amount), 0),
      // La mora declarada gana sobre la deducida: la app ve que el vencimiento
      // pasó, la persona sabe si el pago entró.
      overdue:
        d.status === "en_mora" ||
        (d.due_day != null && d.due_day < todayDay && balance > 0),
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
    bridges: toBridgeFlows((bridgesRes.data ?? []) as BridgeLoanRow[]),
  });

  const settings = settingsRes.data ? toAlertSettings(settingsRes.data) : DEFAULT_ALERT_SETTINGS;

  const now = new Date();
  const today = now.getDate();
  const hasOverdue = debts.some((d) => d.overdue);

  // La capacidad del mes: lo que entra todos los meses menos lo que sale sí o
  // sí en efectivo. El aguinaldo no cuenta — medir el peso de las cuotas
  // contra el mes del aguinaldo daría un alivio que once meses del año no existe.
  const monthlyIncome = incomes
    .filter((inc) => inc.kind === "mensual" && incomeAppliesTo(inc, period))
    .reduce((sum, inc) => sum + Number(inc.amount), 0);
  const monthlyFixed = cashflow.months[0]?.expenses ?? 0;

  const scoped =
    settings.scope === "algunas" && settings.onlyDebtIds.length > 0
      ? debts.filter((d) => settings.onlyDebtIds.includes(d.id))
      : debts;

  const alertDebts: AlertDebt[] = scoped.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    balance: d.balance,
    annualRate: d.annualRate,
    monthlyRate: monthlyRateFromAnnual(d.annualRate),
    dueDay: d.dueDay,
    minimumPayment: d.minimumPayment,
  }));

  const alerts = deriveAlerts({
    debts: alertDebts,
    cashflow,
    canProject: incomes.length > 0,
    scenarioName: scenario.name,
    monthlyIncome,
    monthlyFixed,
    leadDays: settings.leadDays,
    today: now,
  });

  // Las pospuestas salen de la lista hasta que se les cumple el plazo. No se
  // borran del modelo: se filtran acá, así una alerta pospuesta que vuelve a
  // ser urgente reaparece sola cuando el vencimiento se acerca.
  const snoozedUntil = new Map<string, number>();
  for (const row of dismissalsRes.data ?? []) {
    snoozedUntil.set(`${row.kind}:${row.subject_id}`, new Date(row.snoozed_until).getTime());
  }
  const visibleAlerts = alerts.filter(
    (a) => !((snoozedUntil.get(`${a.kind}:${a.subjectId}`) ?? 0) > now.getTime())
  );

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    debts,
    total,
    delta,
    series: series.length >= 2 ? series : [total, total],
    hasOverdue,
    cashflow,
    canProject: incomes.length > 0,
    runwayMonth:
      cashflow.runwayIndex >= 0 ? monthName(cashflow.months[cashflow.runwayIndex].period) : null,
    runwayNote: buildRunwayNote(cashflow, scenario.name),
    alerts: visibleAlerts,
    snoozedCount: alerts.length - visibleAlerts.length,
    alertSettings: settings,
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

