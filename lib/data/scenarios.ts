import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, type ExpenseLike } from "@/lib/calc/balance";
import {
  projectCashflow,
  monthName,
  incomeAppliesTo,
  type CashflowResult,
  type IncomeLike,
} from "@/lib/calc/cashflow";
import { currentPeriod } from "@/lib/data/dashboard";
import { BRIDGE_COLUMNS, toBridgeFlows, type BridgeLoanRow } from "@/lib/data/bridges";

/**
 * Lectura de la pantalla de escenarios.
 *
 * A diferencia del resto de la app, esta pantalla proyecta TODOS los
 * escenarios y no solo el activo: la pregunta que trae a alguien acá no es
 * "cómo voy" sino "cuál de los dos me deja mejor", y esa no se puede responder
 * mirando uno.
 *
 * Se leen todas las filas del usuario de una vez y se agrupan en memoria. Una
 * consulta por escenario daría el mismo resultado y N veces el trabajo, y la
 * cantidad de escenarios de una persona se cuenta con los dedos.
 */

export interface ScenarioSummary {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  startingBalance: number;
  debtCount: number;
  /**
   * Si tiene con qué proyectar. Un escenario sin ingresos no es optimista: es
   * incalculable, y mostrarle un colchón de cero como si fuera un resultado
   * sería exactamente la cifra a mano que la regla de oro prohíbe.
   */
  canProject: boolean;
  cashflow: CashflowResult;
  /** Mes del primer rojo, o null si aguanta los seis. */
  firstGapMonth: string | null;
  /** El peor acumulado de la proyección. */
  worstCushion: number;
  /** El acumulado del último mes proyectado, y de qué mes es. */
  finalCushion: number;
  finalMonth: string;
  /** Neto promedio de los seis meses. */
  averageNet: number;
  /** Ingreso mensual recurrente y gasto fijo en efectivo, para precargar una copia. */
  monthlyIncome: number;
  monthlyFixed: number;
}

export const getScenarioBoard = cache(async function getScenarioBoard(): Promise<ScenarioSummary[]> {
  const supabase = await createClient();

  const { data: scenarios, error } = await supabase
    .from("scenarios")
    .select("id, name, note, starting_balance, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!scenarios || scenarios.length === 0) return [];

  const [debtsRes, expensesRes, paymentsRes, incomesRes, scheduleRes, statementsRes, bridgesRes] =
    await Promise.all([
      supabase
        .from("debts")
        .select("id, scenario_id, base_balance, annual_interest_rate, tem, monthly_payment")
        .eq("is_active", true),
      supabase
        .from("expenses")
        .select("scenario_id, debt_id, amount, is_archived, is_recurring, period, ended_period"),
      supabase.from("debt_payments").select("scenario_id, debt_id, amount, period, kind, is_absorbed"),
      supabase
        .from("incomes")
        .select("scenario_id, amount, kind, eligible_months, period, ended_period"),
      supabase.from("debt_schedule_entries").select("scenario_id, period, amount"),
      supabase
        .from("card_statements")
        .select("scenario_id, debt_id, period, minimum_payment")
        .order("period", { ascending: false }),
      supabase.from("bridge_loans").select(`scenario_id, ${BRIDGE_COLUMNS}`),
    ]);

  const period = currentPeriod();

  function forScenario<T extends { scenario_id: string }>(rows: T[] | null): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.scenario_id) ?? [];
      list.push(row);
      map.set(row.scenario_id, list);
    }
    return map;
  }

  const debtsBy = forScenario(debtsRes.data as never);
  const expensesBy = forScenario(expensesRes.data as never);
  const paymentsBy = forScenario(paymentsRes.data as never);
  const incomesBy = forScenario(incomesRes.data as never);
  const scheduleBy = forScenario(scheduleRes.data as never);
  const statementsBy = forScenario(statementsRes.data as never);
  const bridgesBy = forScenario(bridgesRes.data as never);

  return scenarios.map((scenario) => {
    const debts = (debtsBy.get(scenario.id) ?? []) as unknown as {
      id: string;
      base_balance: number | string;
      annual_interest_rate: number | null;
      tem: number | null;
      monthly_payment: number | string | null;
    }[];
    const expenses = (expensesBy.get(scenario.id) ?? []) as unknown as ExpenseLike[];
    const payments = (paymentsBy.get(scenario.id) ?? []) as unknown as {
      debt_id: string;
      amount: number;
      period: string;
      kind: string;
      is_absorbed: boolean;
    }[];
    const incomes = (incomesBy.get(scenario.id) ?? []) as unknown as IncomeLike[];
    const schedule = (scheduleBy.get(scenario.id) ?? []) as unknown as {
      period: string;
      amount: number | string;
    }[];
    const statements = (statementsBy.get(scenario.id) ?? []) as unknown as {
      debt_id: string;
      minimum_payment: number | string | null;
    }[];

    // La obligación del mes: el mínimo del último resumen de cada deuda, salvo
    // que el plan tenga una entry cargada para ese mes, que manda por ser un
    // compromiso y no una estimación.
    const totalMinimums = debts.reduce((sum, d) => {
      const latest = statements.find((s) => s.debt_id === d.id);
      if (latest?.minimum_payment != null) return sum + Number(latest.minimum_payment);
      // Un préstamo no tiene resumen: su cuota es lo único que lo hace pesar.
      return sum + (d.monthly_payment != null ? Number(d.monthly_payment) : 0);
    }, 0);

    const scheduleByPeriod = new Map<string, number>();
    for (const entry of schedule) {
      scheduleByPeriod.set(
        entry.period,
        (scheduleByPeriod.get(entry.period) ?? 0) + Number(entry.amount)
      );
    }

    const cashflow = projectCashflow({
      startBalance: Number(scenario.starting_balance),
      startPeriod: period,
      months: 6,
      incomes,
      expenses,
      debtDueFor: (p) => scheduleByPeriod.get(p) ?? totalMinimums,
      bridges: toBridgeFlows((bridgesBy.get(scenario.id) ?? []) as unknown as BridgeLoanRow[]),
    });

    // El saldo se deriva igual que en todas las pantallas, para que el conteo
    // de deudas y los montos no salgan de dos cuentas distintas.
    const debtCount = debts.filter(
      (d) =>
        deriveBalance(
          {
            id: d.id,
            base_balance: Number(d.base_balance),
            annual_interest_rate: d.annual_interest_rate,
            tem: d.tem,
          },
          expenses,
          payments
        ) > 0
    ).length;

    const last = cashflow.months[cashflow.months.length - 1];

    return {
      id: scenario.id,
      name: scenario.name,
      note: scenario.note,
      isActive: scenario.is_active,
      startingBalance: Number(scenario.starting_balance),
      debtCount,
      canProject: incomes.length > 0,
      cashflow,
      firstGapMonth:
        cashflow.firstGapIndex >= 0
          ? monthName(cashflow.months[cashflow.firstGapIndex].period)
          : null,
      worstCushion: Math.min(...cashflow.months.map((m) => m.cumulative)),
      finalCushion: last?.cumulative ?? 0,
      finalMonth: last ? monthName(last.period) : "",
      averageNet:
        cashflow.months.length > 0
          ? cashflow.months.reduce((sum, m) => sum + m.net, 0) / cashflow.months.length
          : 0,
      // Solo lo que entra TODOS los meses: precargar una copia con el mes del
      // aguinaldo daría un ingreso que once meses del año no existe.
      monthlyIncome: incomes
        .filter((inc) => inc.kind === "mensual" && incomeAppliesTo(inc, period))
        .reduce((sum, inc) => sum + Number(inc.amount), 0),
      monthlyFixed: cashflow.months[0]?.expenses ?? 0,
    };
  });
});
