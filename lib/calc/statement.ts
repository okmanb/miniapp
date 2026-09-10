/**
 * Cierre del mes de una tarjeta, portado de `_stmtProj` en
 * handoff/prototipo.html:
 *
 *   nuevo = saldo anterior + interés + punitorio + consumos − pagado
 *
 * Dos cosas que lo separan del motor viejo (lib/card-statements) y que son la
 * razón de que esta sea la implementación que va a producción:
 *
 * 1. El interés se calcula sobre el saldo ANTES de restar el pago. El motor
 *    viejo lo calcula sobre el saldo ya neto de lo pagado, así que da menos.
 * 2. Existe el punitorio: si se pagó algo pero menos que el mínimo, se cobra
 *    3% sobre lo que faltó. El motor viejo no lo modela.
 *
 * Lo que sí se conserva del motor viejo es la advertencia de su comentario: el
 * "saldo actual" que trae el PDF ya es el total calculado por el banco.
 * Sumarle otra vez interés, consumos y cuotas encima fue un bug real que
 * mostraba $2-3M como $33M. Por eso esta función recibe el saldo anterior y
 * los consumos por separado, nunca el total del resumen.
 */

import { monthlyRateFromAnnual } from "./money";

/** Punitorio sobre lo que faltó para llegar al mínimo. */
const LATE_FEE_RATE = 0.03;

export interface StatementClose {
  /** Interés del período sobre el saldo anterior. */
  interest: number;
  /** Punitorio por pago menor al mínimo. 0 si no corresponde. */
  lateFee: number;
  /** Saldo con el que cierra el mes. Nunca negativo. */
  newBalance: number;
  /**
   * El cierre ANTES de restar lo pagado.
   *
   * Es lo que se guarda como saldo base de la tarjeta, porque el pago no se
   * guarda restado: se guarda como pago y la resta la hace `deriveBalance`.
   * Así el pago del resumen queda con recibo propio en el historial en vez de
   * desaparecer adentro de un saldo, que es lo que pasaba antes.
   */
  grossBalance: number;
  /** Cuánto se movió el saldo. Positivo = creció. */
  delta: number;
}

export function closeStatement(params: {
  previousBalance: number;
  annualRate: number | string | null;
  /** Consumos nuevos del período. */
  newCharges: number;
  /** Pago mínimo exigido por el banco. */
  minimumPayment: number;
  /** Cuánto se pagó realmente. */
  amountPaid: number;
}): StatementClose {
  const previous = params.previousBalance || 0;
  const interest = Math.round(previous * monthlyRateFromAnnual(params.annualRate));

  // No pagar nada no genera punitorio en este modelo: genera interés sobre
  // todo el saldo, que es peor. El punitorio castiga el pago insuficiente.
  const lateFee =
    params.amountPaid > 0 && params.amountPaid < params.minimumPayment
      ? Math.round((params.minimumPayment - params.amountPaid) * LATE_FEE_RATE)
      : 0;

  const grossBalance = Math.round(previous + interest + lateFee + params.newCharges);
  const newBalance = Math.max(0, grossBalance - Math.round(params.amountPaid));

  return { interest, lateFee, grossBalance, newBalance, delta: newBalance - previous };
}

/**
 * Por qué creció el saldo. La app dice la causa, no solo el número: si el
 * mínimo no cubre el interés se nombra el monto del interés; si lo cubre pero
 * no alcanza para los gastos fijos que se le cargan cada mes, se nombra ese
 * monto. Devuelve null cuando el saldo no creció.
 */
export type GrowthCause =
  | { kind: "interes"; amount: number }
  | { kind: "gastos_fijos"; amount: number }
  | { kind: "minimo_insuficiente"; amount: number };

export function explainGrowth(params: {
  balance: number;
  annualRate: number | string | null;
  minimumPayment: number;
  /** Gastos fijos cargados a esta tarjeta que se repiten cada mes. */
  recurringCharge: number;
}): GrowthCause | null {
  const interest = params.balance * monthlyRateFromAnnual(params.annualRate);
  const total = interest + params.recurringCharge;

  if (params.minimumPayment >= total) return null;

  // El mínimo ni siquiera cubre el interés: esa es la causa, y se nombra el interés.
  if (params.minimumPayment < interest) {
    return { kind: "interes", amount: Math.round(interest) };
  }

  // Cubre el interés pero no lo que se le carga encima cada mes.
  if (params.recurringCharge > 0) {
    return { kind: "gastos_fijos", amount: Math.round(params.recurringCharge) };
  }

  return { kind: "minimo_insuficiente", amount: Math.round(total - params.minimumPayment) };
}
