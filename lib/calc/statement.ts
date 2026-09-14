/**
 * Cierre del mes de una tarjeta, portado de `_stmtProj` en
 * handoff/prototipo.html:
 *
 *   nuevo = saldo anterior − pagos que tomó el banco
 *           + interés + punitorio + consumos + dólares + impuestos − créditos
 *
 * y aparte, lo que la persona pague de ese resumen, que no cambia el cierre:
 * cambia lo que queda después.
 *
 * ## Los dos pagos no son el mismo pago
 *
 * El resumen de septiembre trae un pago hecho en agosto: es el pago del
 * resumen ANTERIOR, y el banco ya lo restó para llegar a su SALDO ACTUAL. El
 * pago de ESTE resumen todavía no existe cuando el resumen se emite — vence
 * el mes que viene. Mezclarlos en un solo campo hacía que la pantalla
 * preguntara "cuánto pagaste" por algo que la persona no había pagado.
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
   * El saldo con el que cierra el resumen según el banco: su SALDO ACTUAL.
   *
   * Ya tiene descontados los pagos que el banco tomó durante el período, y
   * NO tiene descontado lo que la persona pague de este resumen — eso todavía
   * no pasó cuando el resumen se emite.
   *
   * Es lo que se guarda como saldo base de la tarjeta. El pago posterior no se
   * guarda restado: se guarda como pago y la resta la hace `deriveBalance`,
   * así queda con recibo propio en el historial.
   */
  grossBalance: number;
  /** Lo que el banco ya había descontado adentro del cierre. */
  periodPayments: number;
  /** Lo que entró por consumos en dólares, en pesos. 0 si no hay o no hay cotización. */
  usdCharges: number;
  /** Impuestos y demás cargos del resumen. 0 si no se declararon. */
  otherCharges: number;
  /** Lo que salió del saldo sin ser un pago, como una cuotificación. */
  credits: number;
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
  /**
   * Lo que el banco YA descontó adentro de este resumen.
   *
   * Es la línea "SU PAGO" del PDF, y no es plata que se esté pagando ahora:
   * es lo que se pagó durante el período que cerró —el resumen anterior— y
   * que el banco ya restó para llegar a su SALDO ACTUAL. Por eso entra acá
   * adentro del cierre y no afuera como `amountPaid`.
   *
   * Tenerlos separados arregla además un doble conteo que estaba latente: si
   * la persona registraba ese pago cuando lo hizo Y el PDF lo declaraba, el
   * saldo lo restaba dos veces.
   */
  periodPayments?: number;
  /**
   * Lo que se paga de ESTE resumen, si ya se pagó. Cero es lo normal al
   * cargarlo: el vencimiento todavía no llegó.
   *
   * No cambia el cierre —el cierre es un dato del banco— sino lo que queda
   * después de pagar. Por eso se guarda como pago y no restado adentro del
   * saldo base: así tiene recibo propio en el historial.
   */
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
  /**
   * Los intereses que el resumen dice haber cobrado. Mandan sobre la cuenta
   * nuestra cuando estan.
   *
   * El banco NO cobra sobre el saldo entero: cobra sobre la parte financiada,
   * que ningun resumen publica. Deducirlos con la TEM sobre el saldo anterior
   * da de mas --en una Visa real, $ 322.139 contra los $ 242.072 que cobro--
   * y ese error se escribe en el saldo y viaja al mes siguiente. Cuando el
   * PDF los declara no hay nada que estimar.
   */
  declaredInterest?: number | null;
  /**
   * Impuestos y demas cargos del resumen: IVA sobre los intereses, IVA de los
   * planes en cuotas, sellos, IIBB, percepciones, adelantos.
   *
   * En seis resumenes reales van de $ 59.180 a $ 663.227 — en uno son el 4%
   * del saldo. No modelarlos no los hacia desaparecer: hacia que el cierre
   * diera siempre por debajo del real.
   */
  otherCharges?: number;
  /**
   * Lo que el banco saco del saldo sin que sea un pago: hoy, la
   * cuotificacion. Va adentro del saldo base y no afuera como el pago, porque
   * no es plata que la persona puso: es saldo que dejo de estar en la tarjeta.
   */
  credits?: number;
}): StatementClose {
  const previous = params.previousBalance || 0;
  const rate =
    params.monthlyRate != null && params.monthlyRate > 0
      ? params.monthlyRate
      : monthlyRateFromAnnual(params.annualRate);
  const interestRaw =
    params.declaredInterest != null && params.declaredInterest >= 0
      ? params.declaredInterest
      : previous * rate;
  const interest = Math.round(interestRaw);

  /*
   * El punitorio es una ESTIMACION, y solo vale cuando no hay resumen.
   *
   * El prototipo lo inventa: 3% sobre lo que falto para el minimo. Cuando el
   * resumen declara lo que cobro, ese 3% se suma encima de la cifra real y la
   * infla — en la Visa de septiembre eran $ 84.478 de mas sobre un cierre que
   * de otro modo daba exacto, y en la Patagonia $ 10.965. Lo que el banco
   * cobre por pagar de menos ya esta adentro de sus intereses y sus cargos.
   *
   * Por eso: si hay intereses declarados, no se estima nada.
   */
  const lateFee =
    params.declaredInterest == null &&
    params.amountPaid > 0 &&
    params.amountPaid < params.minimumPayment
      ? Math.round((params.minimumPayment - params.amountPaid) * LATE_FEE_RATE)
      : 0;

  const usdRaw = params.usdCharges ?? 0;
  const otherRaw = params.otherCharges ?? 0;
  const creditsRaw = params.credits ?? 0;
  const periodRaw = params.periodPayments ?? 0;

  /*
   * Se suma con los centavos y se redondea UNA vez.
   *
   * Redondear termino por termino y sumar despues desplazaba el cierre: con
   * los seis terminos de un resumen real la Visa daba un peso por encima de lo
   * que dice el banco. Un peso no rompe nada, pero el cierre es el saldo
   * anterior del mes que viene, y una comparacion que casi coincide no sirve
   * para detectar que algo se movio.
   */
  const usdCharges = Math.round(usdRaw);
  const otherCharges = Math.round(otherRaw);
  const credits = Math.round(creditsRaw);
  const periodPayments = Math.round(periodRaw);
  const grossBalance = Math.max(
    0,
    Math.round(
      previous + interestRaw + lateFee + params.newCharges + usdRaw + otherRaw - creditsRaw - periodRaw
    )
  );
  const newBalance = Math.max(0, grossBalance - Math.round(params.amountPaid));

  return {
    interest,
    lateFee,
    usdCharges,
    otherCharges,
    credits,
    periodPayments,
    grossBalance,
    newBalance,
    delta: newBalance - previous,
  };
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
