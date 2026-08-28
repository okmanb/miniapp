/**
 * Motor del "plan destructor de deudas". Simula mes a mes qué pasa
 * si el usuario le mete un pago extra fijo por encima de los
 * mínimos, siguiendo alguna de las dos estrategias clásicas:
 *
 * - avalanche: el extra va siempre a la deuda con la tasa más alta.
 *   Matemáticamente óptimo — minimiza el interés total pagado.
 * - snowball: el extra va siempre a la deuda con el saldo más
 *   chico. Paga más interés en el camino, pero cancela deudas
 *   completas más rápido (efecto motivacional).
 *
 * Nota sobre deudas UVA: se aproximan usando el valor UVA actual
 * como constante hacia adelante (misma simplificación que en
 * lib/debt-engine/index.ts) — el resultado es una estimación, no
 * una proyección exacta, porque la UVA real variará mes a mes.
 */

import { getUvaValue } from "@/lib/bcra";
import { calculateFixedInstallment, type Debt } from "./index";
import { projectDebtSchedule, type DebtScheduleEntry } from "./schedule";

export type PayoffStrategy = "avalanche" | "snowball";

interface SimDebt {
  id: string;
  name: string;
  balance: number;
  monthlyRate: number; // decimal, ej 0.03 = 3% mensual
  minPayment: number;
}

export interface PayoffPlanResult {
  strategy: PayoffStrategy;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffOrder: Array<{ id: string; name: string; monthPaidOff: number }>;
  monthlyTimeline: Array<{ month: number; totalBalance: number }>;
}

// Convierte las deudas de la DB al formato interno de simulación,
// resolviendo tasa mensual y pago mínimo para cada tipo.
async function prepareDebtsForSimulation(
  debts: Debt[],
  scheduleEntriesByDebt: Map<string, DebtScheduleEntry[]>
): Promise<SimDebt[]> {
  let uvaValue: number | null = null;
  const hasUvaDebt = debts.some((d) => d.rate_type === "uva");
  if (hasUvaDebt) {
    uvaValue = (await getUvaValue()).value;
  }

  return debts
    .filter((d) => d.current_balance > 0)
    .map((d) => {
      const annualRate = d.annual_interest_rate ?? 0;
      const monthlyRate = annualRate / 100 / 12;

      let balance = d.current_balance;
      let minPayment: number;

      if (d.debt_type === "credit_card") {
        // El pago mínimo de una tarjeta viene del cronograma real
        // (cuota fija, pago variable, o mínimo+margen — ver
        // lib/debt-engine/schedule.ts), no de un campo que puede
        // haber quedado desactualizado.
        const [projected] = projectDebtSchedule({
          debt: {
            id: d.id,
            current_balance: balance,
            annual_interest_rate: d.annual_interest_rate,
            tem: null,
            installments_total: d.installments_total,
            installments_paid: d.installments_paid,
          },
          entries: scheduleEntriesByDebt.get(d.id) ?? [],
          months: 1,
        });
        minPayment = projected?.amount || balance * 0.05; // sin ningún dato todavía: 5% como piso conservador
      } else if (d.rate_type === "uva" && uvaValue) {
        // Trabajamos en UVAs internamente para la cuota, pero
        // devolvemos saldo y pago en pesos usando la UVA actual.
        const remaining = (d.installments_total ?? 1) - d.installments_paid;
        const balanceUva = balance / uvaValue;
        const installmentUva = calculateFixedInstallment(
          balanceUva,
          annualRate,
          Math.max(remaining, 1)
        );
        minPayment = installmentUva * uvaValue;
      } else {
        const remaining = (d.installments_total ?? 1) - d.installments_paid;
        minPayment = calculateFixedInstallment(balance, annualRate, Math.max(remaining, 1));
      }

      return {
        id: d.id,
        name: d.name,
        balance,
        monthlyRate,
        minPayment: Math.min(minPayment, balance), // no pagar de más si ya es poca plata
      };
    });
}

function simulate(
  debts: SimDebt[],
  strategy: PayoffStrategy,
  extraMonthlyPayment: number,
  maxMonths = 480 // 40 años, tope de seguridad para evitar loop infinito
): Omit<PayoffPlanResult, "strategy"> {
  const balances = debts.map((d) => ({ ...d }));
  let month = 0;
  let totalInterestPaid = 0;
  let totalPaid = 0;
  const payoffOrder: PayoffPlanResult["payoffOrder"] = [];
  const monthlyTimeline: PayoffPlanResult["monthlyTimeline"] = [];

  while (balances.some((d) => d.balance > 0.01) && month < maxMonths) {
    month++;

    // 1. Se devenga el interés del mes sobre cada saldo activo.
    for (const d of balances) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.monthlyRate;
      d.balance += interest;
      totalInterestPaid += interest;
    }

    // 2. Se paga el mínimo de cada deuda activa.
    for (const d of balances) {
      if (d.balance <= 0) continue;
      const payment = Math.min(d.minPayment, d.balance);
      d.balance -= payment;
      totalPaid += payment;
    }

    // 3. El extra va todo a UNA deuda, la que dicte la estrategia.
    const active = balances.filter((d) => d.balance > 0.01);
    if (active.length > 0 && extraMonthlyPayment > 0) {
      const target =
        strategy === "avalanche"
          ? active.reduce((a, b) => (b.monthlyRate > a.monthlyRate ? b : a))
          : active.reduce((a, b) => (b.balance < a.balance ? b : a));

      const extra = Math.min(extraMonthlyPayment, target.balance);
      target.balance -= extra;
      totalPaid += extra;
    }

    // 4. Registrar qué deudas se saldaron este mes.
    for (const d of balances) {
      if (d.balance <= 0.01 && !payoffOrder.find((p) => p.id === d.id)) {
        payoffOrder.push({ id: d.id, name: d.name, monthPaidOff: month });
      }
    }

    monthlyTimeline.push({
      month,
      totalBalance: balances.reduce((sum, d) => sum + Math.max(d.balance, 0), 0),
    });
  }

  return {
    monthsToPayoff: month,
    totalInterestPaid: Math.round(totalInterestPaid),
    totalPaid: Math.round(totalPaid),
    payoffOrder,
    monthlyTimeline,
  };
}

export async function calculatePayoffPlan(
  debts: Debt[],
  scheduleEntriesByDebt: Map<string, DebtScheduleEntry[]>,
  strategy: PayoffStrategy,
  extraMonthlyPayment: number
): Promise<PayoffPlanResult> {
  const prepared = await prepareDebtsForSimulation(debts, scheduleEntriesByDebt);
  const result = simulate(prepared, strategy, extraMonthlyPayment);
  return { strategy, ...result };
}
