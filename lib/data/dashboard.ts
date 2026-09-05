import { createClient } from "@/lib/supabase/server";
import { deriveBalance, recurringChargeFor, type ExpenseLike } from "@/lib/calc/balance";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { explainGrowth, type GrowthCause } from "@/lib/calc/statement";

/**
 * Lectura del dashboard.
 *
 * Ninguna cifra de acá está guardada: el saldo de cada deuda se deriva de su
 * saldo base, sus pagos y sus gastos abiertos, y el total es la suma de esos
 * derivados. Si una pantalla necesitara un número que no sale de este modelo,
 * el problema sería el modelo.
 */

export interface DashboardDebt {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number | null;
  dueDay: number | null;
  /** Gasto fijo que se le carga a esta tarjeta cada mes. */
  recurringCharge: number;
  /** Por qué crece el saldo, o null si no crece. */
  growth: GrowthCause | null;
  minimumPayment: number | null;
}

export interface DashboardData {
  scenarioId: string;
  scenarioName: string;
  debts: DashboardDebt[];
  total: number;
  /** Cuánto se movió el total este mes. Negativo = bajó. */
  delta: number;
  series: number[];
  hasOverdue: boolean;
}

export function currentPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Devuelve null cuando el usuario todavía no tiene un escenario activo —
 * es el estado vacío real, no un error.
 */
export async function getDashboard(): Promise<DashboardData | null> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (scenarioError) throw scenarioError;
  if (!scenario) return null;

  const [debtsRes, expensesRes, paymentsRes, statementsRes] = await Promise.all([
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
      .select("debt_id, amount, period")
      .eq("scenario_id", scenario.id),
    supabase
      .from("card_statements")
      .select("debt_id, period, minimum_payment, total_due")
      .eq("scenario_id", scenario.id)
      .order("period", { ascending: false }),
  ]);

  for (const res of [debtsRes, expensesRes, paymentsRes, statementsRes]) {
    if (res.error) throw res.error;
  }

  const rawDebts = debtsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const statements = statementsRes.data ?? [];

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

    // El mínimo del último resumen cargado es el dato de mayor confianza.
    const latest = statements.find((s) => s.debt_id === d.id);
    const minimumPayment = latest?.minimum_payment != null ? Number(latest.minimum_payment) : null;

    return {
      id: d.id,
      name: d.name,
      kind: d.kind,
      balance,
      annualRate: d.annual_interest_rate != null ? Number(d.annual_interest_rate) : null,
      dueDay: d.due_day,
      recurringCharge,
      minimumPayment,
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

  // El delta del encabezado se deriva igual que todo lo demás: es el total de
  // hoy contra el total que resulta de deshacer los pagos de este mes.
  const paidThisMonth = payments
    .filter((p) => p.period === period)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const previousTotal = total + paidThisMonth;
  const delta = total - previousTotal;

  // Serie de la chispa: los totales que dejaron los resúmenes cerrados, con
  // el total vigente al final. Con un solo punto la chispa no se dibuja.
  const byPeriod = new Map<string, number>();
  for (const s of statements) {
    byPeriod.set(s.period, (byPeriod.get(s.period) ?? 0) + Number(s.total_due));
  }
  const series = [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .concat(total);

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
  };
}

export { previousPeriod };
