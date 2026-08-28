/**
 * Lógica del modelo realista de tarjeta de crédito: cuotas activas
 * (Plan V u otro financiamiento) + resúmenes mensuales con interés
 * punitorio sobre lo impago.
 */

export interface InstallmentPlan {
  id: string;
  description: string;
  total_installments: number;
  installment_amount: number;
  first_period: string; // ISO date, día 1 del mes
  is_active: boolean;
}

// Cuántas cuotas de un plan ya "pasaron" para un período dado.
function installmentsElapsed(plan: InstallmentPlan, periodStr: string): number {
  const [firstYear, firstMonth] = plan.first_period.slice(0, 7).split("-").map(Number);
  const [periodYear, periodMonth] = periodStr.split("-").map(Number);
  const elapsed = (periodYear - firstYear) * 12 + (periodMonth - firstMonth) + 1;
  return elapsed;
}

// Cuántas cuotas le quedan a un plan en un período dado (0 si ya
// terminó o todavía no empezó a cobrarse).
export function installmentsRemaining(plan: InstallmentPlan, periodStr: string): number {
  const elapsed = installmentsElapsed(plan, periodStr);
  if (elapsed < 1) return plan.total_installments; // todavía no arrancó
  return Math.max(plan.total_installments - elapsed + 1, 0);
}

// Si el plan tiene una cuota que vence en este período específico.
function isDueThisPeriod(plan: InstallmentPlan, periodStr: string): boolean {
  const elapsed = installmentsElapsed(plan, periodStr);
  return elapsed >= 1 && elapsed <= plan.total_installments;
}

// Suma de todas las cuotas activas que vencen en un período dado.
export function totalInstallmentsDue(plans: InstallmentPlan[], periodStr: string): number {
  return plans
    .filter((p) => p.is_active && isDueThisPeriod(p, periodStr))
    .reduce((sum, p) => sum + p.installment_amount, 0);
}

// Saldo total pendiente hoy: todas las cuotas futuras de todos los
// planes activos, sin importar el período. Esto es "lo que falta
// pagar en total", no solo la cuota de este mes.
export function totalRemainingInstallmentBalance(
  plans: InstallmentPlan[],
  asOfPeriod: string
): number {
  return plans
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + installmentsRemaining(p, asOfPeriod) * p.installment_amount, 0);
}

export interface StatementCalculation {
  previousBalance: number;
  interestCharged: number;
  installmentsCharge: number;
  totalDue: number;
}

// Calcula los valores de un resumen nuevo a partir del saldo YA
// impago que se arrastra al período (ver resolveCarriedBalance) y
// las cuotas activas de este mes. No recibe el "saldo actual" del
// PDF como input: ese número es el total ya calculado por el banco,
// sumarle de nuevo interés/consumos/cuotas encima sería contar todo
// dos veces (bug real que tuvo esta app: saldo de $2-3M mostrado
// como $33M).
export function calculateStatement(params: {
  carriedBalance: number;
  monthlyInterestRate: number; // decimal, ej 0.08 = 8% mensual
  newCharges: number;
  installmentsChargeThisPeriod: number;
}): StatementCalculation {
  const carriedBalance = Math.max(params.carriedBalance, 0);

  // Interés punitorio solo sobre lo que quedó SIN pagar del resumen
  // anterior — si pagaste todo, no hay interés.
  const interestCharged = carriedBalance > 0 ? carriedBalance * params.monthlyInterestRate : 0;

  const totalDue =
    carriedBalance + interestCharged + params.newCharges + params.installmentsChargeThisPeriod;

  return {
    previousBalance: carriedBalance,
    interestCharged,
    installmentsCharge: params.installmentsChargeThisPeriod,
    totalDue,
  };
}

// Resuelve cuánto se arrastra sin pagar hacia este período, en orden
// de confianza: 1) el "SALDO ANTERIOR" que trae el propio PDF de
// este resumen (dato duro del banco, ya neto de lo pagado) — 2) si
// no lo tenemos (banco no reconocido, o carga manual), el total del
// resumen guardado anteriormente menos lo que se pagó de él — 3) si
// tampoco hay resumen previo, el saldo actual de la deuda (cargado a
// mano por el usuario al crear la deuda sin PDF).
export function resolveCarriedBalance(params: {
  statementSaldoAnterior: number | null | undefined;
  previousStatement: { total_due: number | string; amount_paid: number | string } | null | undefined;
  debtCurrentBalance: number;
}): number {
  if (params.statementSaldoAnterior != null) {
    return Math.max(params.statementSaldoAnterior, 0);
  }
  if (params.previousStatement) {
    return Math.max(
      Number(params.previousStatement.total_due) - Number(params.previousStatement.amount_paid),
      0
    );
  }
  return Math.max(params.debtCurrentBalance, 0);
}

export function currentPeriodString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Estimación en vivo de "cuánto vas a tener que pagar el próximo
// mes" para una tarjeta con modelo de resúmenes: cuotas activas que
// vencen + los consumos nuevos del último resumen cargado (como
// aproximación de lo que sueles gastar). Se calcula al momento,
// sin depender de que algún campo guardado esté actualizado.
export function estimateMonthlyObligation(
  plans: InstallmentPlan[],
  latestStatementNewCharges: number | null,
  period = currentPeriodString()
): number {
  const installments = totalInstallmentsDue(plans, period);
  return installments + (latestStatementNewCharges ?? 0);
}
