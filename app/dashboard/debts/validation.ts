/**
 * Validación del formulario de deuda, compartida por el alta y la edición.
 *
 * Devuelve errores por campo y no un booleano: un formulario que solo dice
 * "algo está mal" obliga a buscar qué. Los mensajes explican qué se espera,
 * no repiten el nombre del campo.
 *
 * Vive aparte del componente porque la validación real corre en el servidor:
 * la del cliente es una cortesía para no hacer ida y vuelta, no la que manda.
 */

export type DebtKind =
  | "tarjeta"
  | "prestamo_personal"
  | "prendario"
  | "hipotecario"
  | "plan_v"
  | "otro";

export const DEBT_KINDS: { value: DebtKind; label: string }[] = [
  { value: "tarjeta", label: "Tarjeta de crédito" },
  { value: "prestamo_personal", label: "Préstamo personal" },
  { value: "prendario", label: "Prendario" },
  { value: "hipotecario", label: "Hipotecario" },
  { value: "plan_v", label: "Refinanciación" },
  { value: "otro", label: "Otro" },
];

export type DebtStatus = "al_dia" | "en_mora";

/**
 * Al día o en mora. Lo dice la persona y no la app: la app puede ver que el
 * vencimiento pasó, pero no sabe si el pago entró al banco.
 */
export const DEBT_STATUSES: { value: DebtStatus; label: string }[] = [
  { value: "al_dia", label: "Al día" },
  { value: "en_mora", label: "En mora" },
];

export interface DebtInput {
  name: string;
  kind: string;
  status: string;
  originalAmount: number | null;
  baseBalance: number | null;
  annualRate: number | null;
  dueDay: number | null;
  installmentsTotal: number | null;
  installmentsPaid: number | null;
  monthlyPayment: number | null;
}

export type FieldErrors = Partial<Record<keyof DebtInput, string>>;

/**
 * Formato argentino: "5.710.670,92" -> 5710670.92.
 *
 * Un punto solo, seguido de una o dos cifras y sin ninguna coma en el texto,
 * se toma como decimal y no como separador de miles: un grupo de miles tiene
 * siempre tres cifras, así que "68.63" no puede ser sesenta y ocho mil. Sin
 * esta excepción se leía 6863, y con una tasa de dos cifras enteras —"83.8"
 * -> 838— ni siquiera saltaba el tope de 1000: se guardaba mal en silencio.
 *
 * "1.500" sigue siendo mil quinientos, que es lo que quiere decir acá.
 */
export function parseArgNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const decimalDot = !trimmed.includes(",") && /^-?\d+\.\d{1,2}$/.test(trimmed);
  const normalized = decimalDot
    ? trimmed
    : trimmed.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isNaN(value) ? null : value;
}

export function readDebtInput(formData: FormData): DebtInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "otro"),
    status: String(formData.get("status") ?? "al_dia"),
    originalAmount: parseArgNumber(String(formData.get("original_amount") ?? "")),
    baseBalance: parseArgNumber(String(formData.get("base_balance") ?? "")),
    annualRate: parseArgNumber(String(formData.get("annual_interest_rate") ?? "")),
    dueDay: parseArgNumber(String(formData.get("due_day") ?? "")),
    installmentsTotal: parseArgNumber(String(formData.get("installments_total") ?? "")),
    installmentsPaid: parseArgNumber(String(formData.get("installments_paid") ?? "")),
    monthlyPayment: parseArgNumber(String(formData.get("monthly_payment") ?? "")),
  };
}

export function validateDebt(input: DebtInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name) {
    errors.name = "Poné un nombre que puedas reconocer en la lista.";
  }

  if (!DEBT_KINDS.some((k) => k.value === input.kind)) {
    errors.kind = "Elegí uno de los tipos de la lista.";
  }

  if (!DEBT_STATUSES.some((s) => s.value === input.status)) {
    errors.status = "Elegí si está al día o en mora.";
  }

  // El monto original es opcional: una deuda puede no saber con cuánto empezó.
  // Lo que no puede es ser menor que lo que todavía se debe.
  if (input.originalAmount !== null && input.originalAmount < 0) {
    errors.originalAmount = "El monto original no puede ser negativo.";
  } else if (
    input.originalAmount !== null &&
    input.baseBalance !== null &&
    input.originalAmount < input.baseBalance
  ) {
    errors.originalAmount = "No puede ser menor que el saldo actual.";
  }

  if (input.baseBalance === null) {
    errors.baseBalance = "Escribí el saldo, aunque sea aproximado.";
  } else if (input.baseBalance < 0) {
    errors.baseBalance = "El saldo no puede ser negativo.";
  }

  // La tasa puede faltar: hay deudas sin interés y otras cuya tasa no se
  // conoce todavía. Lo que no puede es ser negativa o absurda. Cero es una
  // tasa real conocida —una cuota sin interés— y se acepta.
  if (input.annualRate !== null) {
    if (input.annualRate < 0) {
      errors.annualRate = "La tasa no puede ser negativa.";
    } else if (input.annualRate > 1000) {
      errors.annualRate = "Esa tasa parece un error de tipeo. Va la anual, no la del período.";
    }
  }

  if (input.dueDay !== null && (input.dueDay < 1 || input.dueDay > 31)) {
    errors.dueDay = "El día de vencimiento va entre 1 y 31.";
  }

  if (input.installmentsTotal !== null && input.installmentsTotal < 1) {
    errors.installmentsTotal = "Si tiene plazo, es de al menos una cuota.";
  }

  if (input.installmentsPaid !== null) {
    if (input.installmentsPaid < 0) {
      errors.installmentsPaid = "No puede ser negativo.";
    } else if (
      input.installmentsTotal !== null &&
      input.installmentsPaid > input.installmentsTotal
    ) {
      errors.installmentsPaid = "No podés tener más cuotas pagadas que el total.";
    }
  }

  if (input.monthlyPayment !== null && input.monthlyPayment < 0) {
    errors.monthlyPayment = "La cuota no puede ser negativa.";
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
