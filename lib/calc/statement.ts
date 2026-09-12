/**
 * Cierre del mes de una tarjeta, portado de `_stmtProj` en
 * handoff/prototipo.html:
 *
 *   nuevo = saldo anterior + interés + punitorio + consumos + dólares − pagado
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
  /** Lo que entró por consumos en dólares, en pesos. 0 si no hay o no hay cotización. */
  usdCharges: number;
  /** Cuánto se movió el saldo. Positivo = creció. */
  delta: number;
}

export function closeStatement(params: {
  previousBalance: number;
  annualRate: number | string | null;
  /**
   * La tasa mensual declarada por el resumen, en decimal. Manda sobre la
   * anual cuando está, igual que en el resto de la app.
   *
   * No es lo mismo que la anual sobre doce, y la diferencia se escribe en el
   * saldo: el banco convierte con treinta días sobre trescientos sesenta y
   * cinco, así que 80,5% anual le da 6,616% mensual y a nosotros 6,708%.
   * Sobre un saldo de tres millones eso son tres mil pesos de interés de más
   * por mes, y como el cierre pasa a ser el saldo anterior del mes que viene,
   * no se queda quieto.
   */
  monthlyRate?: number | null;
  /** Consumos nuevos del período. */
  newCharges: number;
  /** Pago mínimo exigido por el banco. */
  minimumPayment: number;
  /** Cuánto se pagó realmente. */
  amountPaid: number;
  /**
   * Consumos en dólares del resumen, YA convertidos a pesos.
   *
   * Van aparte de `newCharges` para que el preview pueda nombrarlos: un saldo
   * que sube $ 29.955 sin decir que fueron dólares es la clase de sorpresa que
   * esta app existe para evitar. La conversión se hace afuera porque la
   * cotización no sale del PDF — la pone la persona.
   */
  usdCharges?: number;
}): StatementClose {
  const previous = params.previousBalance || 0;
  const rate =
    params.monthlyRate != null && params.monthlyRate > 0
      ? params.monthlyRate
      : monthlyRateFromAnnual(params.annualRate);
  const interest = Math.round(previous * rate);

  // No pagar nada no genera punitorio en este modelo: genera interés sobre
  // todo el saldo, que es peor. El punitorio castiga el pago insuficiente.
  const lateFee =
    params.amountPaid > 0 && params.amountPaid < params.minimumPayment
      ? Math.round((params.minimumPayment - params.amountPaid) * LATE_FEE_RATE)
      : 0;

  const usdCharges = Math.round(params.usdCharges ?? 0);
  const grossBalance = Math.round(previous + interest + lateFee + params.newCharges) + usdCharges;
  const newBalance = Math.max(0, grossBalance - Math.round(params.amountPaid));

  return { interest, lateFee, usdCharges, grossBalance, newBalance, delta: newBalance - previous };
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
