/**
 * Validación del formulario de carga de deuda. Se usa server-side
 * (antes de tocar la DB) para no depender solo de las validaciones
 * HTML del browser, que un usuario puede saltarse fácil.
 */

const DEBT_TYPES = ["credit_card", "personal_loan", "plan_v", "mortgage", "prendario", "informal"] as const;
const RATE_TYPES = ["fixed", "uva", "variable"] as const;
const DEBT_STATUSES = ["al_dia", "mora", "refinanciado", "regularizado", "cancelado"] as const;

export interface DebtFormValues {
  name: string;
  debt_type: string;
  status: string;
  original_amount: string;
  current_balance: string;
  rate_type: string;
  annual_interest_rate: string;
  installments_total: string;
  installments_paid: string;
  monthly_payment: string;
  due_day: string;
}

export interface ValidatedDebt {
  name: string;
  debt_type: (typeof DEBT_TYPES)[number];
  status: (typeof DEBT_STATUSES)[number];
  original_amount: number;
  current_balance: number;
  rate_type: (typeof RATE_TYPES)[number];
  annual_interest_rate: number | null;
  installments_total: number | null;
  installments_paid: number;
  monthly_payment: number | null;
  due_day: number | null;
}

export type ValidationErrors = Partial<Record<keyof DebtFormValues, string>>;

export function extractFormValues(formData: FormData): DebtFormValues {
  return {
    name: (formData.get("name") as string) ?? "",
    debt_type: (formData.get("debt_type") as string) ?? "",
    status: (formData.get("status") as string) ?? "al_dia",
    original_amount: (formData.get("original_amount") as string) ?? "",
    current_balance: (formData.get("current_balance") as string) ?? "",
    rate_type: (formData.get("rate_type") as string) ?? "",
    annual_interest_rate: (formData.get("annual_interest_rate") as string) ?? "",
    installments_total: (formData.get("installments_total") as string) ?? "",
    installments_paid: (formData.get("installments_paid") as string) ?? "",
    monthly_payment: (formData.get("monthly_payment") as string) ?? "",
    due_day: (formData.get("due_day") as string) ?? "",
  };
}

export function validateDebtForm(
  values: DebtFormValues
): { valid: true; data: ValidatedDebt } | { valid: false; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  // --- Nombre ---
  const name = values.name.trim();
  if (!name) {
    errors.name = "El nombre es obligatorio.";
  } else if (name.length > 100) {
    errors.name = "El nombre es demasiado largo (máx. 100 caracteres).";
  }

  // --- Tipo de deuda ---
  const debtType = values.debt_type as (typeof DEBT_TYPES)[number];
  if (!DEBT_TYPES.includes(debtType)) {
    errors.debt_type = "Elegí un tipo de deuda válido.";
  }
  const isCreditCard = debtType === "credit_card";

  // --- Estado ---
  const status = (values.status || "al_dia") as (typeof DEBT_STATUSES)[number];
  if (!DEBT_STATUSES.includes(status)) {
    errors.status = "Elegí un estado válido.";
  }

  // --- Montos ---
  const originalAmount = Number(values.original_amount);
  if (!values.original_amount || Number.isNaN(originalAmount)) {
    errors.original_amount = "Ingresá un monto original válido.";
  } else if (originalAmount <= 0) {
    errors.original_amount = "El monto original tiene que ser mayor a 0.";
  } else if (originalAmount > 1_000_000_000_000) {
    errors.original_amount = "Ese monto parece demasiado alto, revisalo.";
  }

  const currentBalance = Number(values.current_balance);
  if (!values.current_balance || Number.isNaN(currentBalance)) {
    errors.current_balance = "Ingresá un saldo actual válido.";
  } else if (currentBalance < 0) {
    errors.current_balance = "El saldo actual no puede ser negativo.";
  } else if (!errors.original_amount && currentBalance > originalAmount * 1.5) {
    // Margen de 1.5x para permitir intereses acumulados sobre el
    // monto original — pero si es mucho más, seguro es un typo.
    errors.current_balance =
      "El saldo actual es mucho mayor al monto original — revisá si es correcto.";
  }

  // --- Tasa (aplica a todos los tipos; en tarjetas es la tasa
  // punitoria sobre lo que queda impago) ---
  let rateType: (typeof RATE_TYPES)[number] =
    (values.rate_type || "fixed") as (typeof RATE_TYPES)[number];
  if (!RATE_TYPES.includes(rateType)) {
    errors.rate_type = "Elegí un tipo de tasa válido.";
  }

  let annualInterestRate: number | null = null;
  if (values.annual_interest_rate) {
    annualInterestRate = Number(values.annual_interest_rate);
    if (Number.isNaN(annualInterestRate)) {
      errors.annual_interest_rate = "La tasa tiene que ser un número.";
    } else if (annualInterestRate < 0 || annualInterestRate > 500) {
      errors.annual_interest_rate = "La tasa anual tiene que estar entre 0% y 500%.";
    }
  }

  // --- Cuotas de préstamo (no aplica a tarjetas — las cuotas de
  // una tarjeta se manejan con el módulo de Plan V) ---
  let installmentsTotal: number | null = null;
  let installmentsPaid = 0;
  if (!isCreditCard) {
    if (values.installments_total) {
      installmentsTotal = Number(values.installments_total);
      if (!Number.isInteger(installmentsTotal) || installmentsTotal <= 0) {
        errors.installments_total = "La cantidad de cuotas tiene que ser un entero mayor a 0.";
      } else if (installmentsTotal > 600) {
        errors.installments_total = "Esa cantidad de cuotas parece demasiado alta (máx. 600).";
      }
    }

    if (values.installments_paid) {
      installmentsPaid = Number(values.installments_paid);
      if (!Number.isInteger(installmentsPaid) || installmentsPaid < 0) {
        errors.installments_paid = "Las cuotas pagadas tienen que ser un entero, 0 o más.";
      } else if (
        installmentsTotal !== null &&
        !errors.installments_total &&
        installmentsPaid > installmentsTotal
      ) {
        errors.installments_paid = "No podés haber pagado más cuotas de las que tiene el plan.";
      }
    }
  }

  // --- Pago mensual (solo aplica a tarjetas) ---
  let monthlyPayment: number | null = null;
  if (isCreditCard && values.monthly_payment) {
    monthlyPayment = Number(values.monthly_payment);
    if (Number.isNaN(monthlyPayment) || monthlyPayment < 0) {
      errors.monthly_payment = "Ingresá un pago mensual válido.";
    }
  }

  // --- Día de vencimiento ---
  let dueDay: number | null = null;
  if (values.due_day) {
    dueDay = Number(values.due_day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      errors.due_day = "El día de vencimiento tiene que estar entre 1 y 31.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name,
      debt_type: debtType,
      status,
      original_amount: originalAmount,
      current_balance: currentBalance,
      rate_type: rateType,
      annual_interest_rate: annualInterestRate,
      installments_total: installmentsTotal,
      installments_paid: installmentsPaid,
      monthly_payment: monthlyPayment,
      due_day: dueDay,
    },
  };
}
