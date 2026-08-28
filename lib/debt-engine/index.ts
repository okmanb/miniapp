/**
 * Motor de cálculo del simulador de deuda. Toma una deuda (tal como
 * está en la tabla `debts`) y proyecta sus próximas N cuotas.
 *
 * Cada debt_type tiene su propia lógica de amortización:
 * - credit_card: revolving, sin plazo fijo — se asume que se paga
 *   el mínimo/total cargado por el usuario, sin proyección de
 *   amortización automática.
 * - personal_loan / plan_v / prendario: cuota fija (sistema francés)
 *   si rate_type = 'fixed'.
 * - mortgage: igual que personal_loan pero casi siempre con
 *   rate_type = 'uva', así que la cuota en pesos varía mes a mes
 *   según la evolución del valor UVA.
 */

import { getUvaValue } from "@/lib/bcra";

export interface Debt {
  id: string;
  name: string;
  debt_type: "credit_card" | "personal_loan" | "plan_v" | "mortgage" | "prendario";
  current_balance: number;
  rate_type: "fixed" | "uva" | "variable";
  annual_interest_rate: number | null;
  installments_total: number | null;
  installments_paid: number;
  monthly_payment: number | null;
  due_day: number | null;
  parent_debt_id?: string | null;
}

export interface ProjectedInstallment {
  installmentNumber: number;
  dueDate: string; // ISO date
  amount: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

// Cuota fija, sistema francés — usado por personal_loan, plan_v,
// prendario y mortgage cuando rate_type = 'fixed'. Exportada porque
// también la usa el motor de plan de pago (payoff-plan.ts).
export function calculateFixedInstallment(
  balance: number,
  annualRate: number,
  remainingInstallments: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return balance / remainingInstallments;

  return (
    (balance * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -remainingInstallments))
  );
}

function nextDueDate(dueDay: number | null, monthsAhead: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  if (dueDay) date.setDate(dueDay);
  return date.toISOString().split("T")[0];
}

// Proyecta las próximas `months` cuotas de una deuda de cuota fija
// (personal_loan, plan_v, prendario, o mortgage en pesos fijos).
function projectFixedRateDebt(debt: Debt, months: number): ProjectedInstallment[] {
  if (!debt.annual_interest_rate || !debt.installments_total) return [];

  const remaining = debt.installments_total - debt.installments_paid;
  const monthlyRate = debt.annual_interest_rate / 100 / 12;
  const installmentAmount = calculateFixedInstallment(
    debt.current_balance,
    debt.annual_interest_rate,
    remaining
  );

  const projection: ProjectedInstallment[] = [];
  let balance = debt.current_balance;

  for (let i = 0; i < Math.min(months, remaining); i++) {
    const interest = balance * monthlyRate;
    const principal = installmentAmount - interest;
    balance -= principal;

    projection.push({
      installmentNumber: debt.installments_paid + i + 1,
      dueDate: nextDueDate(debt.due_day, i + 1),
      amount: Math.round(installmentAmount * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(Math.max(balance, 0) * 100) / 100,
    });
  }

  return projection;
}

// Proyecta una deuda ajustada por UVA (típicamente hipotecas). El
// saldo está expresado en UVAs; la cuota en pesos = cuota en UVAs *
// valor UVA del mes. Usa el valor UVA actual como base y lo
// mantiene constante hacia adelante (no proyecta inflación futura,
// que es inherentemente incierta) — el usuario puede refrescar la
// proyección cuando quiera con el valor UVA más reciente.
async function projectUvaDebt(debt: Debt, months: number): Promise<ProjectedInstallment[]> {
  if (!debt.installments_total) return [];

  const { value: uvaValue } = await getUvaValue();
  const remaining = debt.installments_total - debt.installments_paid;

  // Saldo actual en pesos -> se asume que current_balance ya está
  // en pesos; lo convertimos a UVAs para amortizar en esa unidad,
  // que es como realmente funciona un crédito UVA.
  const balanceInUva = debt.current_balance / uvaValue;
  const monthlyRate = (debt.annual_interest_rate ?? 0) / 100 / 12;
  const installmentInUva = calculateFixedInstallment(
    balanceInUva,
    debt.annual_interest_rate ?? 0,
    remaining
  );

  const projection: ProjectedInstallment[] = [];
  let balanceUva = balanceInUva;

  for (let i = 0; i < Math.min(months, remaining); i++) {
    const interestUva = balanceUva * monthlyRate;
    const principalUva = installmentInUva - interestUva;
    balanceUva -= principalUva;

    // Convertimos de vuelta a pesos usando el valor UVA actual como
    // aproximación — la cuota real variará con la UVA de cada mes.
    projection.push({
      installmentNumber: debt.installments_paid + i + 1,
      dueDate: nextDueDate(debt.due_day, i + 1),
      amount: Math.round(installmentInUva * uvaValue * 100) / 100,
      principal: Math.round(principalUva * uvaValue * 100) / 100,
      interest: Math.round(interestUva * uvaValue * 100) / 100,
      remainingBalance: Math.round(Math.max(balanceUva, 0) * uvaValue * 100) / 100,
    });
  }

  return projection;
}

// Tarjetas: sin amortización estructurada. Devolvemos una sola
// "cuota" estimada (el monthly_payment que cargó el usuario) — el
// modelo completo de revolving/interés punitorio queda para una
// segunda vuelta si hace falta.
function projectCreditCard(debt: Debt, months: number): ProjectedInstallment[] {
  if (!debt.monthly_payment) return [];

  const projection: ProjectedInstallment[] = [];
  let balance = debt.current_balance;

  for (let i = 0; i < months; i++) {
    if (balance <= 0) break; // ya está saldada, no seguir proyectando cuotas

    const payment = Math.min(debt.monthly_payment, balance);
    balance -= payment;

    projection.push({
      installmentNumber: debt.installments_paid + i + 1,
      dueDate: nextDueDate(debt.due_day, i + 1),
      amount: payment,
      principal: payment,
      interest: 0,
      remainingBalance: Math.max(balance, 0),
    });
  }
  return projection;
}

// Punto de entrada único: proyecta cualquier tipo de deuda.
export async function projectDebt(
  debt: Debt,
  months = 12
): Promise<ProjectedInstallment[]> {
  if (debt.debt_type === "credit_card") {
    return projectCreditCard(debt, months);
  }
  if (debt.rate_type === "uva") {
    return projectUvaDebt(debt, months);
  }
  return projectFixedRateDebt(debt, months);
}

// Cash flow agregado: suma todas las deudas del usuario mes a mes.
export interface MonthlyCashFlow {
  month: string; // "2026-09"
  totalDue: number;
  byDebt: Record<string, number>; // debtId -> monto ese mes
}

export async function projectCashFlow(
  debts: Debt[],
  months = 12
): Promise<MonthlyCashFlow[]> {
  const allProjections = await Promise.all(
    debts.map(async (d) => ({ debtId: d.id, installments: await projectDebt(d, months) }))
  );

  const byMonth = new Map<string, MonthlyCashFlow>();

  for (const { debtId, installments } of allProjections) {
    for (const installment of installments) {
      const month = installment.dueDate.slice(0, 7); // "YYYY-MM"
      if (!byMonth.has(month)) {
        byMonth.set(month, { month, totalDue: 0, byDebt: {} });
      }
      const entry = byMonth.get(month)!;
      entry.totalDue += installment.amount;
      entry.byDebt[debtId] = (entry.byDebt[debtId] ?? 0) + installment.amount;
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}
