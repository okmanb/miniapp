import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/calc/dates";
import { deriveBalance, type ExpenseLike } from "@/lib/calc/balance";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { bridgeCost, compareAgainstWorstDebt, monthsBetween } from "@/lib/calc/bridge";
import { BRIDGE_COLUMNS, type BridgeLoanRow } from "@/lib/data/bridges";
import { EmptyState, Screen, Chevron } from "@/components/ui";
import { BridgeLoanForm, type WorstDebt } from "@/components/BridgeLoanForm";
import { BridgeLoanCard, type BridgeCardData } from "@/components/BridgeLoanCard";

export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthTitle(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

/**
 * Préstamos puente (pantalla 11).
 *
 * Un puente no es una deuda más: entra entero en un mes y hay que devolverlo
 * entero en otro. Y hay dos estados que no son lo mismo — simulado y tomado —
 * porque mirar cuánto costaría un préstamo no puede mover la proyección solo.
 */
export default async function BridgeLoansPage() {
  const supabase = await createClient();
  const period = currentPeriod();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) {
    return (
      <Screen>
        <Header scenarioName={null} />
        <div className="mt-4">
          <EmptyState
            title="Falta un escenario activo"
            note="Un puente pertenece a un escenario, para que puedas simularlo sin ensuciar tu plan base."
          />
        </div>
      </Screen>
    );
  }

  const [loansRes, debtsRes, expensesRes, paymentsRes] = await Promise.all([
    supabase
      .from("bridge_loans")
      .select(BRIDGE_COLUMNS)
      .eq("scenario_id", scenario.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("debts")
      .select("id, name, base_balance, annual_interest_rate, tem")
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
  ]);

  const loans = (loansRes.data ?? []) as BridgeLoanRow[];
  const expenses = (expensesRes.data ?? []) as ExpenseLike[];
  const payments = paymentsRes.data ?? [];

  // La deuda más cara con saldo abierto: es contra ella que se compara el
  // costo del puente, porque no pedirlo significa dejar esa plata financiada ahí.
  const worstDebt: WorstDebt | null = (debtsRes.data ?? [])
    .map((d) => ({
      name: d.name,
      balance: deriveBalance(
        {
          id: d.id,
          base_balance: Number(d.base_balance),
          annual_interest_rate: d.annual_interest_rate,
          tem: d.tem,
        },
        expenses,
        payments
      ),
      monthlyRate: d.tem != null ? Number(d.tem) : monthlyRateFromAnnual(d.annual_interest_rate),
      annualRatePercent: d.annual_interest_rate != null ? Number(d.annual_interest_rate) : 0,
    }))
    .filter((d) => d.balance > 0 && d.monthlyRate > 0)
    .sort((a, b) => b.monthlyRate - a.monthlyRate)
    .map(({ name, monthlyRate, annualRatePercent }) => ({ name, monthlyRate, annualRatePercent }))[0] ?? null;

  const cards: BridgeCardData[] = loans.map((loan) => {
    const amount = Number(loan.amount);
    const months = loan.repay_period
      ? Math.max(1, monthsBetween(loan.taken_period, loan.repay_period))
      : 1;
    const ratePercent = loan.monthly_interest_rate != null ? Number(loan.monthly_interest_rate) : null;
    const cost = bridgeCost({ amount, months, ratePercent });
    const comparison = worstDebt
      ? compareAgainstWorstDebt({
          amount,
          months,
          worstMonthlyRate: worstDebt.monthlyRate,
          bridgeInterest: cost.interest,
        })
      : null;

    return {
      id: loan.id,
      lender: loan.lender,
      amount,
      months,
      ratePercent,
      interest: cost.interest,
      total: cost.total,
      isTaken: loan.is_taken,
      repayLabel: loan.repay_period ? monthTitle(loan.repay_period) : "sin fecha",
      note: loan.note,
      saving: comparison ? comparison.saving : null,
      worstDebtName: worstDebt?.name ?? null,
    };
  });

  return (
    <Screen>
      <Header scenarioName={scenario.name} />

      {cards.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no agregaste ningún préstamo puente"
            note="Cargalo abajo cuando tomes uno para tapar un mes específico."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {cards.map((loan) => (
            <li key={loan.id}>
              <BridgeLoanCard loan={loan} />
            </li>
          ))}
        </ul>
      )}

      <BridgeLoanForm currentPeriod={period} worstDebt={worstDebt} />
    </Screen>
  );
}

function Header({ scenarioName }: { scenarioName: string | null }) {
  return (
    <>
      <Link
        href="/dashboard/cashflow"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a flujo de caja
      </Link>

      <h1 className="mt-2 text-screen text-ink">Préstamos puente</h1>

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
          Cómo se calcula
          <Chevron className="group-open:rotate-180" />
        </summary>
        <p className="help mt-1">
          Un préstamo corto para tapar un mes específico, con devolución programada — a veces
          encadenado (tomás uno para devolver el anterior). El interés es simple sobre la tasa
          mensual: un puente de dos meses al 5% cuesta 10%, no 10,25%.
          {scenarioName ? ` Escenario: ${scenarioName}.` : ""}
        </p>
      </details>
    </>
  );
}
