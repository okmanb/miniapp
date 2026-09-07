"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createIncome } from "@/app/dashboard/incomes/actions";
import { EMPTY_INCOME_STATE, type IncomeState } from "@/app/dashboard/incomes/form-state";
import { Spinner } from "./ui";
import { CalendarField } from "./CalendarField";

/**
 * Alta de un ingreso. El selector de mes solo aparece para un bono: para el
 * sueldo no significa nada y para el aguinaldo ya está decidido (junio y
 * diciembre). Un campo que no aplica confunde más que uno que falta.
 */
export function IncomeForm() {
  const [state, formAction, pending] = useActionState<IncomeState, FormData>(
    createIncome,
    EMPTY_INCOME_STATE
  );
  const [bonusMonth, setBonusMonth] = useState("");
  const [kind, setKind] = useState("mensual");

  return (
    <form action={formAction} className="mt-3">
      <label htmlFor="description" className="block text-label uppercase text-muted">
        Nombre
      </label>
      <input
        id="description"
        name="description"
        required
        autoComplete="off"
        placeholder="Sueldo"
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
      />

      <label htmlFor="amount" className="mt-5 block text-label uppercase text-muted">
        Monto
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

      <label htmlFor="kind" className="mt-5 block text-label uppercase text-muted">
        Cuándo entra
      </label>
      <select
        id="kind"
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
      >
        <option value="mensual">Todos los meses</option>
        <option value="aguinaldo">Aguinaldo — junio y diciembre</option>
        <option value="bono">Bono — un mes al año</option>
      </select>

      {kind === "bono" && (
        <div className="mt-5">
          <CalendarField
            id="bonus_month"
            name="bonus_month"
            label="En qué mes"
            mode="monthOfYear"
            value={bonusMonth}
            onChange={setBonusMonth}
            kicker="Mes del bono"
            note="Entra una vez al año, en el mes que elijas."
          />
        </div>
      )}

      <p className="help mt-1.5">
        Un aguinaldo o un bono no se reparte entre los meses: entra entero en el suyo.
      </p>

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
      Agregar ingreso
    </button>
  );
}
