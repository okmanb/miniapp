import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { deriveBalance, type ExpenseLike } from "@/lib/calc/balance";
import { currentPeriod } from "@/lib/calc/dates";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { addMonths, projectCashflow, projectDebtDueByPeriod, type CashflowResult, type IncomeLike } from "@/lib/calc/cashflow";
import { BRIDGE_COLUMNS, toBridgeFlows, type BridgeLoanRow } from "@/lib/data/bridges";

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

  const [debtsRes, expensesRes, paymentsRes, incomesRes, scheduleRes, statementsRes, plansRes, bridgesRes] =
    await Promise.all([
      supabase
        .from("debts")
        .select("id, name, kind, base_balance, annual_interest_rate, tem, due_day, monthly_payment")
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
        .from("incomes")
        .select("amount, kind, eligible_months, period, ended_period")
        .eq("scenario_id", scenario.id),
      supabase
        .from("debt_schedule_entries")
        .select("debt_id, period, amount")
        .eq("scenario_id", scenario.id),
      supabase
        .from("card_statements")
        // total_due va porque el minimo se calcula SOBRE el saldo de cierre: es el
        // denominador de la proporcion que despues se proyecta.
        //
        // interest_charged y previous_balance van para la tasa efectiva: el
        // banco no cobra sobre el saldo entero sino sobre la parte financiada,
        // y esa proporcion no se deduce de ninguna tasa publicada.
        .select("debt_id, period, minimum_payment, total_due, interest_charged, previous_balance, financed_balance")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false }),
      supabase
        .from("card_installment_plans")
        .select("id, debt_id, description, cupon, first_period, total_installments, installment_amount")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true),
      supabase.from("bridge_loans").select(BRIDGE_COLUMNS).eq("scenario_id", scenario.id),
    ]);

  for (const res of [debtsRes, expensesRes, paymentsRes, incomesRes, scheduleRes, statementsRes, plansRes, bridgesRes]) {
    if (res.error) throw res.error;
  }

  const rawDebts = debtsRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];
  const incomes = (incomesRes.data ?? []) as IncomeLike[];
  const schedule = scheduleRes.data ?? [];
  const statements = statementsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const bridges = toBridgeFlows((bridgesRes.data ?? []) as BridgeLoanRow[]);

  const period = currentPeriod();

  /**
   * La tasa que de verdad le costo el mes a una tarjeta, sobre su saldo entero.
   *
   *   intereses que cobro el banco / saldo sobre el que los cobro
   *
   * No es la TEM. El banco cobra sobre la parte financiada --lo que no se pago
   * al vencimiento-- y ningun resumen publica cuanto es, asi que aplicar la
   * TEM al saldo entero cobra de mas: en una Visa real, $ 322.139 proyectados
   * contra $ 242.072 cobrados. La proporcion no se puede deducir, pero el
   * cociente si se puede medir, y es lo que se usa mientras haya un resumen
   * que lo diga.
   */
  function tasaEfectivaDe(debtId: string): number | null {
    const st = statements.find((s) => s.debt_id === debtId);
    if (!st || st.interest_charged == null) return null;
    const base = Number(st.previous_balance);
    const interes = Number(st.interest_charged);
    if (!(base > 0) || !(interes > 0)) return null;
    return interes / base;
  }

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
    // Orden de prioridad: la entry del plan (un compromiso cargado) manda sobre
    // el mínimo del resumen (lo que dice el banco), y este sobre la cuota
    // mensual de la deuda (lo que la persona sabe que paga). Un préstamo no
    // tiene resumen: sin el último escalón entraba al flujo con cero.
    const dueThisMonth = entry
      ? Number(entry.amount)
      : latest?.minimum_payment != null
        ? Number(latest.minimum_payment)
        : d.monthly_payment != null
          ? Number(d.monthly_payment)
          : 0;

    // La medida manda sobre la declarada, y la declarada sobre la deducida.
    const rate =
      tasaEfectivaDe(d.id) ??
      (d.tem != null ? Number(d.tem) : monthlyRateFromAnnual(d.annual_interest_rate));
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
  /*
   * La obligación de cada mes, proyectada en vez de congelada.
   *
   * La proporción sale del último resumen de cada tarjeta —lo que el banco
   * efectivamente pidió sobre el saldo con el que cerró— y no de una fórmula
   * nuestra. El texto legal da la composición del mínimo, pero necesita datos
   * que el resumen no lista, y aproximarla se midió: erra 22% para un lado en
   * una Visa con diez planes y 32% para el otro en una Mastercard con seis.
   */
  const proyectadas = rawDebts.map((d) => {
    const balanceHoy = deriveBalance(
      { id: d.id, base_balance: Number(d.base_balance), annual_interest_rate: d.annual_interest_rate, tem: d.tem },
      expenses,
      payments
    );
    const latest = statements.find((st) => st.debt_id === d.id);
    const cierre = latest?.total_due != null ? Number(latest.total_due) : 0;
    const minimo = latest?.minimum_payment != null ? Number(latest.minimum_payment) : null;

    return {
      balance: balanceHoy,
      monthlyRate:
        tasaEfectivaDe(d.id) ??
        (d.tem != null ? Number(d.tem) : monthlyRateFromAnnual(d.annual_interest_rate)),
      // Una tarjeta no tiene cuota fija; un préstamo no tiene resumen.
      fixedPayment:
        d.kind === "tarjeta" ? null : d.monthly_payment != null ? Number(d.monthly_payment) : null,
      minimumRatio: minimo != null && cierre > 0 ? minimo / cierre : null,
    };
  });

  const duePorPeriodo = projectDebtDueByPeriod(proyectadas, period, 6);
  const totalDue = debts.reduce((sum, d) => sum + d.dueThisMonth, 0);

  const cashflow = projectCashflow({
    startBalance: Number(scenario.starting_balance),
    startPeriod: period,
    months: 6,
    incomes,
    expenses,
    /*
     * Una entrada del plan cargada a mano manda sobre todo: es un compromiso
     * que la persona escribió. Después va la proyección, y el total de hoy
     * queda solo como red para el primer mes si la proyección no lo tiene.
     */
    debtDueFor: (p) => scheduleByPeriod.get(p) ?? duePorPeriodo.get(p) ?? totalDue,
    bridges,
  });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    startingBalance: Number(scenario.starting_balance),
    cashflow,
    debts,
  };
});
