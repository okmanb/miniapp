"use client";

import { useActionState, useState } from "react";
import { saveDebt } from "@/app/dashboard/debts/actions";
import { EMPTY_STATE, type DebtFormState } from "@/app/dashboard/debts/form-state";
import { DEBT_KINDS, DEBT_STATUSES } from "@/app/dashboard/debts/validation";
import { formatArgNumber } from "@/lib/calc/money";
import { Spinner } from "./ui";
import { CalendarField } from "./CalendarField";
import { ChoiceGroup } from "./ChoiceGroup";

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
  status?: string;
  originalAmount?: number | null;
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
  const [status, setStatus] = useState(initial.status ?? "al_dia");
  const [originalAmount, setOriginalAmount] = useState(
    initial.originalAmount != null ? String(Math.round(initial.originalAmount)) : ""
  );

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
        Acá NO va el importador de PDF. El prototipo tiene el bloque del PDF en
        una sola pantalla, la del resumen, y ahí ahora también se da de alta la
        tarjeta. Tenerlo en los dos lados partía en dos el camino más común:
        cargabas el archivo acá, guardabas, y la pantalla siguiente te pedía
        los montos del mismo resumen.
      */}
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
        help="Así la vas a ver en el dashboard y las notificaciones — poné algo que reconozcas de un vistazo."
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
        label="Tipo de deuda"
        value={kind}
        onChange={setKind}
        options={DEBT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        layout="stack"
        error={state.errors.kind}
      />

      <ChoiceGroup
        name="status"
        label="Estado"
        value={status}
        onChange={setStatus}
        layout="grid"
        options={DEBT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        help="Lo decís vos, no la app: la app ve que el vencimiento pasó, pero no sabe si el pago entró al banco."
        error={state.errors.status}
      />

      <Section title="Montos" />

      {/*
        MONTO ORIGINAL va antes que SALDO ACTUAL, como el prototipo. No se
        deriva ni se puede: el modelo solo conoce los pagos hechos desde que la
        app existe, así que sin este dato el "% saldado" de una deuda que
        arrancó antes cuenta de menos.
      */}
      <Field
        id="original_amount"
        label="Monto original"
        error={state.errors.originalAmount}
        help="Con cuánto arrancó esta deuda, si lo sabés. Sirve para que el porcentaje saldado cuente también lo que pagaste antes de usar la app."
      >
        <MoneyInput
          id="original_amount"
          name="original_amount"
          value={originalAmount}
          onChange={setOriginalAmount}
          optional
        />
      </Field>

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
        label="Tasa de interés punitorio anual (%)"
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
          label="Día de vencimiento (1–31)"
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

      {/*
        El prototipo no tiene plazo, cuotas totales ni ya pagadas, así que acá
        tampoco. Las columnas siguen en la base: las únicas que las leían son
        las de `lib/debt-engine/`, el motor viejo que queda como control
        cruzado, y el motor vivo (`lib/calc/`) nunca las miró. Si algún día hay
        que volver a cargarlas, el formulario es lo único que falta.
      */}
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
