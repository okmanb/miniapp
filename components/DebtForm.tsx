"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveDebt, EMPTY_STATE, type DebtFormState } from "@/app/dashboard/debts/actions";
import { DEBT_KINDS } from "@/app/dashboard/debts/validation";
import { Spinner } from "./ui";

/**
 * Formulario de deuda, compartido por el alta y la edición.
 *
 * Los campos de plazo (cuotas totales y pagadas) solo tienen sentido para una
 * deuda con plazo conocido; para una tarjeta revolving no existe tal cosa. Se
 * muestran igual pero la ayuda dice cuándo dejarlos vacíos, en vez de
 * esconderlos y que parezca que la app perdió el dato.
 */

export interface DebtFormValues {
  id?: string;
  name?: string;
  kind?: string;
  baseBalance?: number | null;
  annualRate?: number | null;
  dueDay?: number | null;
  installmentsTotal?: number | null;
  installmentsPaid?: number | null;
}

export function DebtForm({ initial = {} }: { initial?: DebtFormValues }) {
  const [state, formAction] = useFormState<DebtFormState, FormData>(saveDebt, EMPTY_STATE);
  const editing = Boolean(initial.id);

  return (
    <form action={formAction} className="mt-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Field
        id="name"
        label="Nombre"
        error={state.errors.name}
        help="Como lo reconocés en el resumen: “Visa Signature …2166”."
      >
        <input
          id="name"
          name="name"
          required
          defaultValue={initial.name}
          autoComplete="off"
          className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
        />
      </Field>

      <Field id="kind" label="Tipo" error={state.errors.kind}>
        <select
          id="kind"
          name="kind"
          defaultValue={initial.kind ?? "tarjeta"}
          className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
        >
          {DEBT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="base_balance"
        label="Saldo actual"
        error={state.errors.baseBalance}
        help="El del último resumen. Los gastos que cargues después se suman solos; no hace falta actualizarlo a mano."
      >
        <MoneyInput id="base_balance" name="base_balance" defaultValue={initial.baseBalance} />
      </Field>

      <Field
        id="annual_interest_rate"
        label="Tasa anual (TNA)"
        error={state.errors.annualRate}
        help="La anual, no la del mes. Dejalo vacío si no la sabés todavía; cero es válido si de verdad no tiene interés."
      >
        <div className="flex items-center rounded-surface border border-border-input bg-surface px-3">
          <input
            id="annual_interest_rate"
            name="annual_interest_rate"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial.annualRate ?? ""}
            placeholder="98,03"
            className="min-h-touch w-full bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <span className="font-mono text-[15px] text-muted" aria-hidden>
            %
          </span>
        </div>
      </Field>

      <Field
        id="due_day"
        label="Día de vencimiento"
        error={state.errors.dueDay}
        help="Solo el día del mes. Si cae 31, en los meses cortos se usa el último día."
      >
        <input
          id="due_day"
          name="due_day"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={initial.dueDay ?? ""}
          placeholder="10"
          className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </Field>

      <fieldset className="mt-6">
        <legend className="text-label uppercase text-muted">Plazo (si lo tiene)</legend>
        <p className="help mt-1">
          Para un préstamo con cuotas contadas. Una tarjeta no tiene plazo: dejalos vacíos y la
          app calcula el pago mes a mes en vez de una cuota fija.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field id="installments_total" label="Cuotas totales" error={state.errors.installmentsTotal}>
            <input
              id="installments_total"
              name="installments_total"
              inputMode="numeric"
              defaultValue={initial.installmentsTotal ?? ""}
              className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
            />
          </Field>
          <Field id="installments_paid" label="Ya pagadas" error={state.errors.installmentsPaid}>
            <input
              id="installments_paid"
              name="installments_paid"
              inputMode="numeric"
              defaultValue={initial.installmentsPaid ?? ""}
              className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
            />
          </Field>
        </div>
      </fieldset>

      {state.message && (
        <p
          role="alert"
          className="mt-4 rounded-surface border border-brick-border bg-brick-bg px-3 py-2 text-[11.5px] text-brick-ink"
        >
          {state.message}
        </p>
      )}

      <SubmitButton editing={editing} />
    </form>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
    >
      {pending && <Spinner className="text-white" />}
      {editing ? "Guardar cambios" : "Agregar deuda"}
    </button>
  );
}

function MoneyInput({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
}) {
  return (
    <div className="flex items-center rounded-surface border border-border-input bg-surface px-3">
      <span className="font-mono text-[15px] text-muted" aria-hidden>
        $
      </span>
      <input
        id={id}
        name={name}
        required
        inputMode="numeric"
        autoComplete="off"
        defaultValue={defaultValue ?? ""}
        placeholder="0"
        className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
      />
    </div>
  );
}

function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {/* El error reemplaza a la ayuda: dos textos debajo del mismo campo compiten. */}
      {error ? (
        <p role="alert" className="mt-1.5 text-[11.5px] text-brick-ink">
          {error}
        </p>
      ) : help ? (
        <p className="help mt-1.5">{help}</p>
      ) : null}
    </div>
  );
}
