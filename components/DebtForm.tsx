"use client";

import { useActionState, useState } from "react";
import { saveDebt } from "@/app/dashboard/debts/actions";
import { EMPTY_STATE, type DebtFormState } from "@/app/dashboard/debts/form-state";
import { DEBT_KINDS } from "@/app/dashboard/debts/validation";
import { formatArgNumber } from "@/lib/calc/money";
import { Spinner } from "./ui";
import { CalendarField } from "./CalendarField";
import { ChoiceGroup } from "./ChoiceGroup";
import { StatementImport, stashParsedStatement } from "./StatementImport";

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
  monthlyPayment?: number | null;
  installmentsTotal?: number | null;
  installmentsPaid?: number | null;
}

export function DebtForm({ initial = {} }: { initial?: DebtFormValues }) {
  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(saveDebt, EMPTY_STATE);
  const editing = Boolean(initial.id);
  const [dueDay, setDueDay] = useState(initial.dueDay != null ? String(initial.dueDay) : "");
  const [kind, setKind] = useState(initial.kind ?? "tarjeta");

  // Lo que el PDF prellena. Son controlados solo desde que se importa: antes
  // van sin valor para que el navegador conserve lo tipeado si la pagina se
  // rehidrata.
  const [name, setName] = useState(initial.name ?? "");
  const [balance, setBalance] = useState(
    initial.baseBalance != null ? String(Math.round(initial.baseBalance)) : ""
  );
  const [rate, setRate] = useState(
    initial.annualRate != null ? formatArgNumber(initial.annualRate) : ""
  );
  const [monthlyPayment, setMonthlyPayment] = useState(
    initial.monthlyPayment != null ? String(Math.round(initial.monthlyPayment)) : ""
  );

  return (
    <form action={formAction} className="mt-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {/*
        Importar va primero porque es el camino corto: seis campos que salen
        del PDF en vez de copiarse a mano del resumen. Solo para tarjetas
        nuevas — una deuda ya creada se actualiza cargando su resumen, que es
        otra pantalla, y un prestamo no tiene resumen que leer.
      */}
      {!editing && kind === "tarjeta" && (
        <div className="mb-6">
          <StatementImport
            title="Importar resumen"
            note="Si tenés el PDF a mano, de ahí salen el nombre, el saldo, la tasa y el día de vencimiento. Podés cargarlos a mano igual."
            onParsed={(parsed) => {
              if (parsed.cardName) {
                setName(
                  parsed.accountLast4
                    ? `${parsed.cardName} …${parsed.accountLast4}`
                    : parsed.cardName
                );
              }
              if (parsed.statementBalance != null) {
                setBalance(String(Math.round(parsed.statementBalance)));
              }
              if (parsed.annualRate != null) setRate(formatArgNumber(parsed.annualRate));
              if (parsed.dueDate) {
                const day = Number(parsed.dueDate.slice(8, 10));
                if (day >= 1 && day <= 31) setDueDay(String(day));
              }
              // El resto del resumen viaja a la pantalla siguiente: pedir el
              // mismo PDF dos veces es justo el trabajo manual que esto evita.
              stashParsedStatement(parsed);
            }}
          />
        </div>
      )}

      {/*
        Las tres secciones salen del prototipo. No son decoración: separan lo
        que identifica la deuda de lo que se calcula con ella, y sin ellas
        siete campos seguidos se leen todos con el mismo peso.
      */}
      <Section title="Identificación" first />

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className="min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
        />
      </Field>

      {/*
        Seis opciones apiladas: son más que las tres del prototipo porque el
        modelo tiene prendario, hipotecario y otro, que ahí no existen. La
        forma es la del prototipo igual — a todo el ancho y radio 12 — porque
        es la que aguanta etiquetas largas, y escala a seis sin cambiar nada.
      */}
      <ChoiceGroup
        name="kind"
        label="Tipo"
        value={kind}
        onChange={setKind}
        options={DEBT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        layout="stack"
        error={state.errors.kind}
      />

      <Section title="Montos" />

      <Field
        id="base_balance"
        label="Saldo actual"
        error={state.errors.baseBalance}
        help="El del último resumen. Los gastos que cargues después se suman solos; no hace falta actualizarlo a mano."
      >
        <MoneyInput id="base_balance" name="base_balance" value={balance} onChange={setBalance} />
      </Field>

      <Section title="Tasa y pago" />

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
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="98,03"
            className="min-h-touch w-full bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <span className="font-mono text-[15px] text-muted" aria-hidden>
            %
          </span>
        </div>
      </Field>

      {/*
        La cuota es el único dato que hace pesar a un préstamo en la
        proyección: no tiene resumen del que sacarle un mínimo. Sin esto
        entraba al flujo con cero y el mes daba más holgado de lo que es.
      */}
      <Field
        id="monthly_payment"
        label="Pago mensual estimado"
        error={state.errors.monthlyPayment}
        help="Para un préstamo, la cuota que pagás todos los meses. Una tarjeta no lo necesita: su mínimo sale del resumen y pisa este valor."
      >
        <MoneyInput
          id="monthly_payment"
          name="monthly_payment"
          value={monthlyPayment}
          onChange={setMonthlyPayment}
          optional
        />
      </Field>

      <div className="mt-5">
        <CalendarField
          id="due_day"
          name="due_day"
          label="Día de vencimiento"
          mode="day"
          value={dueDay}
          onChange={setDueDay}
          kicker="Día de vencimiento"
          note="Se repite todos los meses. Elegí el día en que cierra el resumen."
          help="Si cae 31, en los meses cortos se usa el último día. Un préstamo con cuota fija puede no tener día: dejalo vacío."
        />
        {state.errors.dueDay && (
          <p className="mt-1.5 text-[11.5px] text-brick-ink">{state.errors.dueDay}</p>
        )}
      </div>

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

      <SubmitButton editing={editing} pending={pending} />
    </form>
  );
}

function SubmitButton({ editing, pending }: { editing: boolean; pending: boolean }) {
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
  value,
  onChange,
  optional = false,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center rounded-surface border border-border-input bg-surface px-3">
      <span className="font-mono text-[15px] text-muted" aria-hidden>
        $
      </span>
      <input
        id={id}
        name={name}
        required={!optional}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
      />
    </div>
  );
}

function Section({ title, first = false }: { title: string; first?: boolean }) {
  return (
    <h2
      className={`text-label uppercase text-muted ${first ? "" : "mt-8 border-t border-border-row pt-5"}`}
    >
      {title}
    </h2>
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
