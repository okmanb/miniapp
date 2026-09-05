/**
 * El saldo se deriva; nunca se guarda ni se parchea.
 *
 * Portado de `_debtData()` del prototipo, que lo resuelve así:
 *
 *   saldo = max(0, saldo_base − pagos registrados + gastos abiertos de esa tarjeta)
 *
 * Los gastos que cuentan son los del escenario activo y los que todavía no se
 * archivaron: cargar el resumen del mes los archiva, y a partir de ahí el
 * saldo base ya los trae adentro. Por eso archivar no resta dos veces.
 *
 * La regla dura: al agregar o quitar un gasto no se toca ninguna columna de
 * saldo. Si alguna vez hiciera falta "revertir un parche", el modelo está mal.
 */

export interface DebtLike {
  id: string;
  base_balance: number;
  annual_interest_rate: number | null;
  tem: number | null;
}

export interface ExpenseLike {
  debt_id: string | null;
  amount: number;
  is_archived: boolean;
  is_recurring: boolean;
  period: string;
  ended_period: string | null;
}

export interface PaymentLike {
  debt_id: string;
  amount: number;
}

/** Saldo vigente de una deuda. */
export function deriveBalance(
  debt: DebtLike,
  expenses: ExpenseLike[],
  payments: PaymentLike[]
): number {
  const paid = payments
    .filter((p) => p.debt_id === debt.id)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const openCharges = expenses
    .filter((e) => e.debt_id === debt.id && !e.is_archived)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return Math.max(0, Number(debt.base_balance) - paid + openCharges);
}

/**
 * Si un gasto vale en un mes dado.
 *
 * Un consumo único vale solo en el mes en que se cargó. Un gasto fijo vale
 * desde ese mes en adelante, hasta el mes en que dejó de valer — y un fijo
 * archivado sigue contando en la repetición, porque archivarlo dice que ese
 * consumo ya entró en un resumen, no que el gasto haya terminado.
 */
export function expenseAppliesTo(expense: ExpenseLike, period: string): boolean {
  if (!expense.is_recurring) return expense.period === period;
  if (period < expense.period) return false;
  if (expense.ended_period && period >= expense.ended_period) return false;
  return true;
}

/**
 * Gasto mensual que se le carga a una tarjeta y se repite. Es el número que
 * la app nombra cuando el mínimo cubre el interés pero el saldo igual crece.
 */
export function recurringChargeFor(
  debtId: string,
  expenses: ExpenseLike[],
  period: string
): number {
  return expenses
    .filter((e) => e.debt_id === debtId && e.is_recurring && expenseAppliesTo(e, period))
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Total de gastos del mes que efectivamente salen del efectivo.
 *
 * Regla 7: un gasto fijo pagado con tarjeta aparece en la lista del mes
 * marcado como que no sale del efectivo, y el total cuenta solo lo que sí
 * sale. Sumarlo acá sería contarlo dos veces: ya está dentro del saldo de la
 * tarjeta, y la tarjeta ya aparece en el flujo por su pago mensual.
 */
export function cashExpensesFor(expenses: ExpenseLike[], period: string): number {
  return expenses
    .filter((e) => e.debt_id === null && expenseAppliesTo(e, period))
    .reduce((sum, e) => sum + Number(e.amount), 0);
}
