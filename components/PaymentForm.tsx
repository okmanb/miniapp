"use client";

import { useActionState, useState } from "react";
import { createPayment } from "@/app/dashboard/payments/actions";
import { EMPTY_PAYMENT_STATE, type PaymentState } from "@/app/dashboard/payments/form-state";
import { Spinner } from "./ui";
import { CalendarField } from "./CalendarField";
import { ChoiceGroup } from "./ChoiceGroup";

export function PaymentForm({
  debts,
  defaultDebtId,
}: {
  debts: { id: string; name: string }[];
  defaultDebtId?: string;
}) {
  const [state, formAction, pending] = useActionState<PaymentState, FormData>(
    createPayment,
    EMPTY_PAYMENT_STATE
  );

  // Hoy por defecto: un pago se registra el día que se hizo, y corregir la
  // fecha es la excepción.
  const [paidOn, setPaidOn] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  });

  const [kind, setKind] = useState("pago_variable");

  return (
    <form action={formAction} className="mt-4">
      <label htmlFor="debt_id" className="block text-label uppercase text-muted">
        A qué deuda
      </label>
      <select
        id="debt_id"
        name="debt_id"
        required
        defaultValue={defaultDebtId}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
      >
        <option value="">Elegí una</option>
        {debts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <label htmlFor="amount" className="mt-5 block text-label uppercase text-muted">
        Cuánto pagaste
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id="amount"
          name="amount"
          required
          inputMode="numeric"
          placeholder="0"
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-5">
        <CalendarField
          id="paid_on"
          name="paid_on"
          label="Cuándo"
          mode="date"
          value={paidOn}
          onChange={setPaidOn}
          kicker="Fecha del pago"
          note="Cuándo salió la plata de tu cuenta."
        />
      </div>

      {/*
        Apilado y no en dos columnas como el prototipo: sus cuatro etiquetas
        son de dos palabras y las nuestras son frases. Se respeta la regla del
        prototipo —la forma la decide el largo de la etiqueta— en vez de
        copiar la grilla y dejar que el texto se parta en tres renglones.
      */}
      <ChoiceGroup
        name="kind"
        label="Qué tipo de pago"
        value={kind}
        onChange={setKind}
        layout="stack"
        options={[
          { value: "pago_variable", label: "Un pago cualquiera" },
          { value: "minimo_estimado", label: "El mínimo del resumen" },
          { value: "cuota_fija", label: "La cuota fija" },
          { value: "unico", label: "Un pago extra, de una vez" },
        ]}
        help="Solo puede haber un pago mínimo por deuda por mes: así el atajo del dashboard no se aplica dos veces sin que se note."
      />

      {state.message && (
        <p
          role="alert"
          className="mt-4 rounded-surface border border-brick-border bg-brick-bg px-3 py-2 text-[11.5px] text-brick-ink"
        >
          {state.message}
        </p>
      )}

      <Submit pending={pending} />
    </form>
  );
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
    >
      {pending && <Spinner className="text-white" />}
      Registrar el pago
    </button>
  );
}
