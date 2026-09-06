import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, type ExpenseLike } from "@/lib/calc/balance";
import { projectCashflow, addMonths, type CashflowResult, type IncomeLike } from "@/lib/calc/cashflow";
import { currentPeriod } from "@/lib/data/dashboard";
import { monthlyRateFromAnnual } from "@/lib/calc/money";

/**
 * Lectura de la pantalla de flujo de caja.
 *
 * El "saldo proyectado" de cada deuda no es su saldo de hoy: es el que va a
 * quedar después del pago de este mes, con el interés del período aplicado.
 * Mostrar el de hoy en una pantalla que se llama "con qué te enfrentás" sería
 * responder otra pregunta.
 */

export interface CashflowInstallment {
  id: string;
  description: string;
  current: number;
  total: number;
  endsOn: string;
  amount: number;
}

export interface CashflowDebt {
  id: string;
  name: string;
  kind: string;
  dueDay: number | null;
  dueThisMonth: number;
  projectedBalance: number;
  installments: CashflowInstallment[];
}

export interface CashflowScreen {
  scenarioId: string;
  scenarioName: string;
  startingBalance: number;
  cashflow: CashflowResult;
  debts: CashflowDebt[];
}

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2026-12" -> "dic 2026". */
function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

export const getCashflowScreen = cache(async function getCashflowScreen(): Promise<CashflowScreen | null> {
  const supabase = await createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, name, starting_balance")
    .eq("is_active", true)
    .maybeSingle();

  if (scenarioError) throw scenarioError;
  if (!scenario) return null;

  const [debtsRes, expensesRes, paymentsRes, incomesRes, scheduleRes, statementsRes, plansRes] =
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
        .from("incomes")
        .select("amount, kind, eligible_months, period, ended_period")
        .eq("scenario_id", scenario.id),
      supabase
        .from("debt_schedule_entries")
        .select("debt_id, period, amount")
        .eq("scenario_id", scenario.id),
      supabase
        .from("card_statements")
        .select("debt_id, period, minimum_payment")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false }),
      supabase
        .from("card_installment_plans")
        .select("id, debt_id, description, cupon, first_period, total_installments, installment_amount")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true),
    ]);

  for (const res of [debtsRes, expensesRes, paymentsRes, incomesRes, scheduleRes, statementsRes, plansRes]) {
    if (res.error) throw res.error;
  }

  const rawDebts = debtsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const incomes = (incomesRes.data ?? []) as IncomeLike[];
  const schedule = scheduleRes.data ?? [];
  const statements = statementsRes.data ?? [];
  const plans = plansRes.data ?? [];

  const period = currentPeriod();

  const debts: CashflowDebt[] = rawDebts.map((d) => {
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

    // La entry del plan de este mes manda sobre el mínimo del resumen: es un
    // compromiso cargado, no una estimación.
    const entry = schedule.find((e) => e.debt_id === d.id && e.period === period);
    const latest = statements.find((s) => s.debt_id === d.id);
    const dueThisMonth = entry
      ? Number(entry.amount)
      : latest?.minimum_payment != null
        ? Number(latest.minimum_payment)
        : 0;

    const rate = d.tem != null ? Number(d.tem) : monthlyRateFromAnnual(d.annual_interest_rate);
    const projectedBalance = Math.max(0, balance + balance * rate - dueThisMonth);

    const installments: CashflowInstallment[] = plans
      .filter((p) => p.debt_id === d.id)
      .map((p) => {
        // Cuál cuota corre este mes, contando desde la primera.
        const [fy, fm] = p.first_period.split("-").map(Number);
        const [cy, cm] = period.split("-").map(Number);
        const elapsed = (cy - fy) * 12 + (cm - fm) + 1;
        return {
          id: p.id,
          description: p.description ?? `Cuota (cupón ${p.cupon ?? "—"})`,
          current: elapsed,
          total: p.total_installments,
          endsOn: periodLabel(addMonths(p.first_period, p.total_installments - 1)),
          amount: Number(p.installment_amount),
          elapsed,
        };
      })
      // Una cuota que ya terminó o que todavía no arrancó no se enfrenta este mes.
      .filter((p) => p.elapsed >= 1 && p.elapsed <= p.total)
      .map(({ elapsed, ...rest }) => rest);

    return {
      id: d.id,
      name: d.name,
      kind: d.kind,
      dueDay: d.due_day,
      dueThisMonth,
      projectedBalance,
      installments,
    };
  });

  const scheduleByPeriod = new Map<string, number>();
  for (const e of schedule) {
    scheduleByPeriod.set(e.period, (scheduleByPeriod.get(e.period) ?? 0) + Number(e.amount));
  }
  const totalDue = debts.reduce((sum, d) => sum + d.dueThisMonth, 0);

  const cashflow = projectCashflow({
    startBalance: Number(scenario.starting_balance),
    startPeriod: period,
    months: 6,
    incomes,
    expenses,
    debtDueFor: (p) => scheduleByPeriod.get(p) ?? totalDue,
  });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    startingBalance: Number(scenario.starting_balance),
    cashflow,
    debts,
  };
});
