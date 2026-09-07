/**
 * Borrador del onboarding (pantalla 00).
 *
 * El prototipo dice, con todas las letras, "no hace falta crear cuenta". Así
 * que los tres pasos funcionan sin sesión y lo cargado vive en el navegador
 * hasta que la persona decida guardarlo. Recién ahí se pide la cuenta.
 *
 * Es un borrador, no datos: vive en localStorage, se puede perder si se borra
 * el navegador, y la pantalla 3 lo dice. No se usa para nada más que sembrar
 * el primer escenario cuando la cuenta existe.
 */

export type OnboardingDebtKind = "tarjeta" | "prestamo_personal" | "familiar" | "servicio";

export interface DebtTypeOption {
  value: OnboardingDebtKind;
  label: string;
  /** La segunda línea de la tarjeta: cómo se paga, no qué es. */
  note: string;
  /** Tasa típica, prellenada. Es una estimación declarada, no un dato. */
  annualRate: number;
  dueDay: number;
  /** El tipo del esquema al que corresponde. "familiar" no tiene uno propio. */
  schemaKind: "tarjeta" | "prestamo_personal" | "otro";
}

/**
 * Los cuatro tipos, con los valores que prellena el prototipo. No son
 * caprichos: son el punto de partida para que alguien que no tiene el resumen
 * a mano igual pueda ver algo. Cada pantalla que los use tiene que decir que
 * son estimaciones.
 */
export const DEBT_TYPES: DebtTypeOption[] = [
  {
    value: "tarjeta",
    label: "Tarjeta de crédito",
    note: "resumen mensual",
    annualRate: 83.8,
    dueDay: 10,
    schemaKind: "tarjeta",
  },
  {
    value: "prestamo_personal",
    label: "Préstamo personal",
    note: "cuota fija",
    annualRate: 95,
    dueDay: 5,
    schemaKind: "prestamo_personal",
  },
  {
    value: "familiar",
    label: "Familiar o amigo",
    note: "en cuotas, sin interés",
    annualRate: 0,
    dueDay: 30,
    schemaKind: "otro",
  },
  {
    value: "servicio",
    label: "Servicio atrasado",
    note: "plan de pago",
    annualRate: 60,
    dueDay: 15,
    schemaKind: "otro",
  },
];

export function debtTypeOf(kind: OnboardingDebtKind): DebtTypeOption {
  return DEBT_TYPES.find((t) => t.value === kind) ?? DEBT_TYPES[0];
}

export interface OnboardingDraft {
  kind: OnboardingDebtKind;
  balance: number;
  annualRate: number;
  dueDay: number;
  monthlyIncome: number;
  fixedExpenses: number;
}

export const STORAGE_KEY = "llegas.onboarding.v1";

export function emptyDraft(): OnboardingDraft {
  const card = DEBT_TYPES[0];
  return {
    kind: card.value,
    balance: 0,
    annualRate: card.annualRate,
    dueDay: card.dueDay,
    monthlyIncome: 0,
    fixedExpenses: 0,
  };
}

export function readDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    // Un borrador a medias es peor que ninguno: si no tiene saldo, no hay
    // nada que sembrar y la app arranca vacía como corresponde.
    if (typeof parsed.balance !== "number" || parsed.balance <= 0) return null;
    return { ...emptyDraft(), ...parsed } as OnboardingDraft;
  } catch {
    return null;
  }
}

export function writeDraft(draft: OnboardingDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Modo privado o almacenamiento lleno. El onboarding sigue funcionando en
    // memoria; lo único que se pierde es poder cerrar y volver.
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/* -------------------------------------------------------------------------- */
/* Lo que el onboarding deriva                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Mínimo estimado de tarjeta: 8% del saldo, que es lo que usa el prototipo.
 *
 * Es una estimación gruesa a propósito. El mínimo real sale de la letra chica
 * del banco (interés del período + porcentajes por tipo de consumo), y eso
 * necesita el detalle del resumen, que en el onboarding todavía no existe.
 * Cuando la persona cargue un resumen, ese mínimo reemplaza a este.
 */
export const ESTIMATED_MINIMUM_RATE = 0.08;

export function estimatedMinimum(balance: number): number {
  return Math.round(balance * ESTIMATED_MINIMUM_RATE);
}

export function monthlyInterest(balance: number, annualRate: number): number {
  return Math.round(balance * (annualRate / 100 / 12));
}

/** Lo que queda para deuda: lo que entra menos lo que se va en vivir. */
export function paymentCapacity(draft: OnboardingDraft): number {
  return draft.monthlyIncome - draft.fixedExpenses;
}
