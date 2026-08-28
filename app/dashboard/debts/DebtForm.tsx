"use client";

import { useState } from "react";
import type { DebtFormValues, ValidationErrors } from "./validation";

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Tarjeta de crédito",
  personal_loan: "Préstamo personal",
  plan_v: "Refinanciación / cuotas",
  mortgage: "Hipoteca",
  prendario: "Prendario",
};

const STATUS_LABELS: Record<string, string> = {
  al_dia: "Al día",
  mora: "En mora",
  refinanciado: "Refinanciado",
  regularizado: "Regularizado",
  cancelado: "Cancelado",
};

const EMPTY_VALUES: DebtFormValues = {
  name: "",
  debt_type: "credit_card",
  status: "al_dia",
  original_amount: "",
  current_balance: "",
  rate_type: "fixed",
  annual_interest_rate: "",
  installments_total: "",
  installments_paid: "",
  monthly_payment: "",
  due_day: "",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p style={{ color: "var(--led-red)", fontSize: 13, marginTop: 2 }}>{message}</p>;
}

export default function DebtForm({
  errors,
  values,
  action,
}: {
  errors?: ValidationErrors;
  values?: DebtFormValues;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const initial = values ?? EMPTY_VALUES;
  const [debtType, setDebtType] = useState(initial.debt_type || "credit_card");
  const [rateType, setRateType] = useState(initial.rate_type || "fixed");

  const isCreditCard = debtType === "credit_card";
  const isMortgage = debtType === "mortgage";

  const hasErrors = errors && Object.keys(errors).length > 0;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hasErrors && (
        <p style={{ color: "var(--led-red)", fontSize: 14 }}>
          Revisá los campos marcados abajo.
        </p>
      )}

      <label>
        Nombre
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          placeholder="ej: Tarjeta Visa BBVA"
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
        <FieldError message={errors?.name} />
      </label>

      <label>
        Tipo de deuda
        <select
          name="debt_type"
          value={debtType}
          onChange={(e) => {
            setDebtType(e.target.value);
            if (e.target.value === "mortgage") setRateType("uva");
          }}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        >
          {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError message={errors?.debt_type} />
      </label>

      <label>
        Estado
        <select
          name="status"
          defaultValue={initial.status || "al_dia"}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError message={errors?.status} />
      </label>

      <label>
        Monto original
        <input
          type="number"
          name="original_amount"
          required
          step="0.01"
          min="0"
          defaultValue={initial.original_amount}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
        <FieldError message={errors?.original_amount} />
      </label>

      <label>
        Saldo actual
        <input
          type="number"
          name="current_balance"
          required
          step="0.01"
          min="0"
          defaultValue={initial.current_balance}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
        <FieldError message={errors?.current_balance} />
      </label>

      <label>
        Tipo de tasa
        <select
          name="rate_type"
          value={rateType}
          onChange={(e) => setRateType(e.target.value)}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        >
          <option value="fixed">Fija</option>
          <option value="variable">Variable</option>
          <option value="uva">UVA</option>
        </select>
        <FieldError message={errors?.rate_type} />
      </label>

      {rateType === "variable" && !isCreditCard && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: -6 }}>
          El banco puede cambiarla en cualquier momento — cuando te avisen un
          ajuste, volvé a esta pantalla y actualizá el valor de abajo.
        </p>
      )}

      <label>
        {isCreditCard ? "Tasa de interés punitorio anual (%)" : "Tasa de interés anual (%)"}
        <input
          type="number"
          name="annual_interest_rate"
          step="0.01"
          min="0"
          max="500"
          defaultValue={initial.annual_interest_rate}
          placeholder={
            isCreditCard
              ? "ej: 130 (lo que te cobran por no pagar el resumen completo)"
              : rateType === "uva"
                ? "ej: 8 (tasa sobre UVA)"
                : rateType === "variable"
                  ? "ej: 55 (tasa actual — puede cambiar)"
                  : "ej: 65.5"
          }
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
        <FieldError message={errors?.annual_interest_rate} />
      </label>

      {!isCreditCard && (
        <>
          <label>
            Cantidad total de cuotas
            <input
              type="number"
              name="installments_total"
              min="1"
              max="600"
              defaultValue={initial.installments_total}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
            <FieldError message={errors?.installments_total} />
          </label>

          <label>
            Cuotas ya pagadas
            <input
              type="number"
              name="installments_paid"
              min="0"
              defaultValue={initial.installments_paid || "0"}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
            <FieldError message={errors?.installments_paid} />
          </label>
        </>
      )}

      {isCreditCard && (
        <label>
          Pago mensual estimado
          <input
            type="number"
            name="monthly_payment"
            step="0.01"
            min="0"
            defaultValue={initial.monthly_payment}
            placeholder="Lo que pagás habitualmente por mes"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
          <FieldError message={errors?.monthly_payment} />
        </label>
      )}

      <label>
        Día de vencimiento (1-31)
        <input
          type="number"
          name="due_day"
          min="1"
          max="31"
          defaultValue={initial.due_day}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
        <FieldError message={errors?.due_day} />
      </label>

      {isMortgage && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          Nota: para hipotecas se asume tasa UVA por default. Ingresá el saldo
          actual en pesos — el sistema lo convierte a UVAs usando el valor
          UVA más reciente del BCRA.
        </p>
      )}

      <button type="submit" style={{ padding: 10, marginTop: 8, cursor: "pointer" }}>
        Guardar deuda
      </button>
    </form>
  );
}
