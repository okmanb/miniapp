/**
 * Plan de pago: simulación mes a mes con un extra que se vuelca a una deuda
 * por vez. Portado de `_payoff` del prototipo.
 *
 * No es una fórmula cerrada: se simula mes a mes porque el efecto que hace
 * valer la pena el plan —cuando una deuda se cancela, su mínimo se suma al
 * pozo y acelera la siguiente— no se puede expresar de otra forma.
 *
 * Dos estrategias, y la diferencia es real, no cosmética:
 *  - "avalancha": primero la de tasa más alta. Es la que menos interés paga.
 *  - "bola de nieve": primero la de saldo más chico. Paga más interés, pero
 *    cancela deudas antes, que para mucha gente es lo que sostiene el plan.
 */

export type Strategy = "avalancha" | "bola_de_nieve";

/** Techo de simulación: 50 años. Llegar ahí es no terminar nunca. */
const MAX_MONTHS = 600;

export interface PayoffDebtInput {
  id: string;
  name: string;
  balance: number;
  /** Pago mínimo mensual comprometido. */
  minimum: number;
  /** Tasa mensual, en decimal. */
  monthlyRate: number;
  /** Gasto fijo que se le carga cada mes y engorda el saldo. */
  recurringCharge: number;
}

export interface PayoffDebtResult {
  id: string;
  name: string;
  /** Mes (1-based) en que queda cancelada. null = no se cancela. */
  clearedMonth: number | null;
  order: number;
}

export interface PayoffResult {
  strategy: Strategy;
  /** Meses hasta cancelar todo. null = no se termina a este ritmo. */
  totalMonths: number | null;
  totalInterest: number | null;
  debts: PayoffDebtResult[];
  /** Deudas que ya estaban en cero al empezar. */
  alreadyClear: number;
}

export function simulatePayoff(params: {
  debts: PayoffDebtInput[];
  /** Plata extra por mes, por encima de los mínimos. */
  extraPerMonth: number;
  strategy: Strategy;
}): PayoffResult {
  const debts = params.debts.map((d) => ({ ...d, bal: d.balance, cleared: null as number | null }));

  const order =
    params.strategy === "avalancha"
      ? [...debts].sort((a, b) => b.monthlyRate - a.monthlyRate)
      : [...debts].sort((a, b) => a.bal - b.bal);

  const openAtStart = debts.filter((d) => d.bal > 0.5).length;

  // Nada abierto al arrancar: el plan no dura "50 años", no hay nada que pagar.
  if (openAtStart === 0) {
    return {
      strategy: params.strategy,
      totalMonths: 0,
      totalInterest: 0,
      debts: debts.map((d, i) => ({ id: d.id, name: d.name, clearedMonth: 0, order: i })),
      alreadyClear: debts.length,
    };
  }

  let interest = 0;
  let month = 0;

  while (debts.some((d) => d.bal > 0.5) && month < MAX_MONTHS) {
    month++;
    let pool = params.extraPerMonth;

    // 1. Interés y consumo del mes sobre lo que sigue abierto.
    for (const d of debts) {
      if (d.bal > 0.5) {
        const monthInterest = d.bal * d.monthlyRate;
        interest += monthInterest;
        d.bal += monthInterest + d.recurringCharge;
      }
    }

    // 2. Cada deuda paga su mínimo. La que ya está cancelada libera el suyo al
    //    pozo: ese es el efecto bola de nieve, y es lo que hace que el plan
    //    acelere en vez de avanzar parejo.
    for (const d of debts) {
      if (d.bal > 0.5) {
        d.bal -= Math.min(d.minimum, d.bal);
      } else {
        pool += d.minimum;
      }
    }

    // 3. El pozo entero va a la primera de la cola que siga abierta.
    for (const target of order) {
      if (pool <= 0) break;
      if (target.bal <= 0.5) continue;
      const payment = Math.min(pool, target.bal);
      target.bal -= payment;
      pool -= payment;
    }

    // 4. Recién acá se marca lo cancelado, para que el mes quede completo.
    for (const d of debts) {
      if (d.bal <= 0.5 && d.cleared === null) d.cleared = month;
    }
  }

  const finished = debts.every((d) => d.bal <= 0.5);

  return {
    strategy: params.strategy,
    totalMonths: finished ? month : null,
    totalInterest: finished ? Math.round(interest) : null,
    debts: order.map((d, i) => ({
      id: d.id,
      name: d.name,
      clearedMonth: d.cleared,
      order: i,
    })),
    alreadyClear: debts.length - openAtStart,
  };
}
