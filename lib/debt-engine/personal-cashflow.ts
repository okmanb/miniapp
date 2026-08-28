/**
 * Cash flow personal completo: cruza ingresos, gastos fijos, y las
 * cuotas de deuda proyectadas (lib/debt-engine/schedule.ts) para
 * mostrar el neto disponible mes a mes.
 *
 * Reemplaza la versión anterior basada en income_sources/expenses
 * (un monto fijo por fuente, sin dimensión de mes) — ahora cada
 * ingreso/gasto es una fila por mes, lo que permite el caso real
 * del spec §1: el split sueldo/adelanto cambia de un mes a otro sin
 * que cambie el total, y los ajustes se aplican desde su mes en
 * adelante, nunca retroactivos (spec §4.3).
 */

import { projectDebtSchedule, type DebtScheduleEntry } from "./schedule";

export interface IncomeRow {
  name: string;
  kind: string;
  month: string; // "YYYY-MM-01" o "YYYY-MM"
  amount: number;
  is_recurring: boolean;
}

export interface FixedExpenseRow {
  name: string;
  month: string;
  amount: number;
  is_recurring: boolean;
}

export interface BridgeLoanRow {
  amount: number;
  received_month: string;
  repay_month: string;
}

export interface PersonalCashFlowMonth {
  month: string; // "2026-09"
  income: number;
  fixedExpenses: number;
  debtPayments: number;
  bridgeLoanNet: number; // + lo que entra ese mes, - lo que se devuelve
  netAvailable: number;
  cumulativeBalance: number; // saldo real de partida + netAvailable acumulado hasta este mes
  isBonusMonth: boolean; // true si tiene un ingreso kind='aguinaldo' cargado ese mes
}

function normalizeMonth(month: string): string {
  return month.slice(0, 7);
}

// Agrupa por nombre y resuelve cuánto vale esa línea en un mes dado
// (spec §4.3: un ajuste "sube de acá en más" se aplica desde su mes
// en adelante, no reescribe el histórico):
//  1. Si hay una fila para ESE mes exacto, gana siempre — es el dato
//     más específico posible (recurrente que arranca ahí, o un
//     monto puntual confirmado para ese mes).
//  2. Si no, se usa la última fila recurrente cuyo mes sea anterior
//     o igual al que se está proyectando — "lo que seguía vigente".
//  3. Filas no recurrentes de OTRO mes no aportan nada a este mes.
function amountForMonth(rows: { name: string; month: string; amount: number; is_recurring: boolean }[], month: string): number {
  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byName.get(r.name) ?? [];
    list.push(r);
    byName.set(r.name, list);
  }

  let total = 0;
  for (const group of byName.values()) {
    const exact = group.find((r) => normalizeMonth(r.month) === month);
    if (exact) {
      total += Number(exact.amount);
      continue;
    }
    const recurring = group
      .filter((r) => r.is_recurring && normalizeMonth(r.month) <= month)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    if (recurring) total += Number(recurring.amount);
  }
  return total;
}

export interface DebtForCashFlow {
  id: string;
  current_balance: number;
  annual_interest_rate: number | null;
  tem: number | null;
  installments_total: number | null;
  installments_paid: number;
  // Gastos sueltos ya cargados este mes (ver
  // app/dashboard/debts/[id]/charges/actions.ts::addCardCharge) —
  // sin esto el saldo proyectado asumía $0 de consumo nuevo hasta que
  // llegara el resumen bancario del mes.
  estimatedNewSpendPerMonth?: number;
}

export function projectPersonalCashFlow(params: {
  incomes: IncomeRow[];
  expenses: FixedExpenseRow[];
  debts: DebtForCashFlow[];
  scheduleEntriesByDebt: Map<string, DebtScheduleEntry[]>;
  bridgeLoans?: BridgeLoanRow[];
  months?: number;
  startMonth?: string;
  // Saldo real hoy — el punto de partida del que se encadena el
  // saldo acumulado. Sin esto, cumulativeBalance == netAvailable
  // acumulado desde 0, que sigue sirviendo para ver la TENDENCIA
  // (¿mejora o empeora?) aunque no sea la plata real disponible.
  startingBalance?: number;
}): PersonalCashFlowMonth[] {
  const months = params.months ?? 6;
  const startMonth = params.startMonth ?? normalizeMonth(new Date().toISOString());
  let runningBalance = params.startingBalance ?? 0;

  const debtByMonth = new Map<string, number>();
  for (const debt of params.debts) {
    const projection = projectDebtSchedule({
      debt,
      entries: params.scheduleEntriesByDebt.get(debt.id) ?? [],
      months,
      startMonth,
      estimatedNewSpendPerMonth: debt.estimatedNewSpendPerMonth,
    });
    for (const p of projection) {
      debtByMonth.set(p.month, (debtByMonth.get(p.month) ?? 0) + p.amount);
    }
  }

  const result: PersonalCashFlowMonth[] = [];
  for (let i = 0; i < months; i++) {
    const [year, month] = startMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + i, 1);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const income = amountForMonth(params.incomes, monthStr);
    const fixedExpenses = amountForMonth(params.expenses, monthStr);
    const debtPayments = debtByMonth.get(monthStr) ?? 0;
    const bridgeLoanNet = (params.bridgeLoans ?? []).reduce((sum, b) => {
      let net = 0;
      if (normalizeMonth(b.received_month) === monthStr) net += Number(b.amount);
      if (normalizeMonth(b.repay_month) === monthStr) net -= Number(b.amount);
      return sum + net;
    }, 0);
    const isBonusMonth = params.incomes.some(
      (i) => i.kind === "aguinaldo" && normalizeMonth(i.month) === monthStr
    );
    const netAvailable = income + bridgeLoanNet - fixedExpenses - debtPayments;
    runningBalance += netAvailable;

    result.push({
      month: monthStr,
      income,
      fixedExpenses,
      debtPayments,
      bridgeLoanNet,
      netAvailable,
      cumulativeBalance: runningBalance,
      isBonusMonth,
    });
  }

  return result;
}
