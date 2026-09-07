/**
 * Amortización mes a mes con pago fijo.
 *
 * Portado literal de `_amort` en handoff/prototipo.html. Es la lógica que
 * produjo las cifras ya revisadas y aprobadas, así que donde difiera del
 * motor viejo (lib/debt-engine) gana esta. La comparación entre las dos está
 * en scripts/cross-check.ts.
 *
 * Las tres respuestas posibles importan tanto como el número:
 *   months = 0     el saldo ya estaba cancelado — cierra en cero meses, no en "nunca"
 *   months = null  a ese ritmo no se salda: el pago no cubre el interés del mes
 *   months = n     se cancela en n meses
 */

import { monthlyRateFromAnnual } from "./money";

/** Techo de simulación: 50 años. Tocarlo es lo mismo que no cerrar nunca. */
const MAX_MONTHS = 600;

export interface AmortizationResult {
  /** null = a ese ritmo no se salda. */
  months: number | null;
  /** Interés total pagado, redondeado. null cuando months es null. */
  interest: number | null;
  /** Tasa mensual usada, para poder mostrar el interés del período. */
  monthlyRate: number;
}

export function amortize(params: {
  balance: number;
  annualRate: number | string | null;
  payment: number;
  /** Consumo que se suma al saldo cada mes (gastos fijos cargados a la tarjeta). */
  recurringCharge?: number;
}): AmortizationResult {
  const monthlyRate = monthlyRateFromAnnual(params.annualRate);
  const recurring = params.recurringCharge ?? 0;

  let balance = params.balance;
  let interest = 0;
  let months = 0;

  // Un saldo ya cancelado cierra en cero meses.
  if (!(balance > 0.5)) return { months: 0, interest: 0, monthlyRate };

  // Si el pago no cubre el interés del mes (más lo que se le carga encima),
  // no se devuelve un plazo: se devuelve que no se salda a ese ritmo.
  if (params.payment <= balance * monthlyRate + recurring) {
    return { months: null, interest: null, monthlyRate };
  }

  while (balance > 0.5 && months < MAX_MONTHS) {
    const monthInterest = balance * monthlyRate;
    interest += monthInterest;
    balance = balance + monthInterest + recurring - params.payment;
    months++;
  }

  if (balance > 0.5) return { months: null, interest: null, monthlyRate };

  return { months, interest: Math.round(interest), monthlyRate };
}

/**
 * Lo mínimo que hay que pagar por mes para que el saldo DEJE de crecer.
 * Se muestra siempre al lado de la proyección: es la cifra que explica por qué
 * el saldo sube aunque se esté pagando.
 */
export function breakeven(params: {
  balance: number;
  annualRate: number | string | null;
  recurringCharge?: number;
}): number {
  return (
    params.balance * monthlyRateFromAnnual(params.annualRate) + (params.recurringCharge ?? 0)
  );
}
