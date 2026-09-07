/**
 * Préstamos puente. Portado de `_brCalc` y de la parte de puentes de
 * `_dueSchedule` del prototipo.
 *
 * Un puente no es una deuda más: entra entero en un mes y se devuelve entero
 * en otro. No se amortiza, así que no tiene nada que ver con el motor de
 * deudas y vive en su propio archivo.
 *
 * Dos cosas que el prototipo decide y acá se respetan:
 *
 *  - La tasa es MENSUAL y el interés es SIMPLE: `costo = monto * tasa * meses`.
 *    Un puente de dos meses al 5% cuesta 10%, no 10,25%. Es como se pacta un
 *    préstamo entre personas, que es de dónde suele salir esta plata.
 *
 *  - La alternativa al puente no es "no pedirlo": es dejar esa plata
 *    financiada en la deuda más cara. Por eso el costo se compara siempre
 *    contra esa deuda, y ahí sí el interés es compuesto, porque una tarjeta
 *    capitaliza todos los meses.
 */

export interface BridgeCost {
  /** Meses de puente. Mínimo 1: devolver el mismo mes no es un puente. */
  months: number;
  /** Tasa mensual en porcentaje, tal como se carga. */
  ratePercent: number;
  /** Lo que cuesta el puente. */
  interest: number;
  /** Lo que hay que devolver: monto + costo. */
  total: number;
}

export function bridgeCost(params: {
  amount: number;
  months: number;
  ratePercent: number | null;
}): BridgeCost {
  const months = Math.max(1, Math.round(params.months) || 1);
  const ratePercent = params.ratePercent ?? 0;
  const interest = Math.round(params.amount * (ratePercent / 100) * months);
  return { months, ratePercent, interest, total: params.amount + interest };
}

export interface BridgeComparison {
  /** Interés que se comería la deuda más cara en esos meses. */
  alternativeInterest: number;
  /** Positivo = el puente sale más barato. */
  saving: number;
}

/**
 * Contra qué se compara el puente: dejar esa plata financiada en la deuda más
 * cara del escenario. Ahí el interés capitaliza, así que va compuesto.
 */
export function compareAgainstWorstDebt(params: {
  amount: number;
  months: number;
  /** Tasa mensual de la deuda más cara, en decimal. */
  worstMonthlyRate: number;
  bridgeInterest: number;
}): BridgeComparison {
  const alternativeInterest = Math.round(
    params.amount * (Math.pow(1 + params.worstMonthlyRate, params.months) - 1)
  );
  return { alternativeInterest, saving: alternativeInterest - params.bridgeInterest };
}

/** Meses enteros de "2026-09" a "2026-11" = 2. Negativo si el orden se invierte. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
