"use client";

import { useState, useTransition } from "react";
import {
  updateExpenseAmount,
  endRecurringExpense,
  restoreExpense,
} from "@/app/dashboard/expenses/actions";
import { Spinner } from "./ui";

/**
 * Editar un gasto (regla 4 de PRODUCT-RULES.md).
 *
 * Cambiar el monto de un gasto fijo son dos cosas distintas y la app no puede
 * adivinar cuál es, así que las ofrece como dos opciones con consecuencias
 * escritas:
 *
 *  - Corregir siempre: era un error de carga, el monto viejo nunca fue cierto.
 *  - Desde este mes: aumentó de verdad. Se cierra el registro viejo con el mes
 *    en que dejó de valer y se abre uno nuevo — el historial no se reescribe.
 *
 * Para un consumo único no hay tal elección: entra una sola vez, así que solo
 * se puede corregir.
 */
export function ExpenseEditor({
  id,
  isRecurring,
  isArchived,
  currentAmount,
  alreadyEnded,
}: {
  id: string;
  isRecurring: boolean;
  isArchived: boolean;
  currentAmount: number;
  alreadyEnded: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<"siempre" | "desde_ahora">("siempre");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <>
      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-ink">Cambiar el monto</h2>

        <form
          className="mt-3"
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await updateExpenseAmount(formData);
              if (result && !result.ok) setError(result.message);
            })
          }
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="scope" value={isRecurring ? scope : "siempre"} />

          <div className="flex items-center rounded-surface border border-border-input bg-surface px-3">
            <span className="font-mono text-[15px] text-muted" aria-hidden>
              $
            </span>
            <input
              name="amount"
              required
              inputMode="numeric"
              defaultValue={currentAmount}
              aria-label="Monto nuevo"
              className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none"
            />
          </div>

          {isRecurring && (
            <fieldset className="mt-4">
              <legend className="text-label uppercase text-muted">Desde cuándo vale</legend>

              <ScopeOption
                checked={scope === "siempre"}
                onSelect={() => setScope("siempre")}
                title="Corregir el monto de siempre"
                note="Era un error de carga: el monto viejo nunca fue el correcto. Cambia también en los meses ya proyectados."
              />
              <ScopeOption
                checked={scope === "desde_ahora"}
                onSelect={() => setScope("desde_ahora")}
                title="Cambió desde este mes"
                note="Aumentó de verdad. El monto anterior sigue valiendo para los meses que ya pasaron; el historial no se toca."
              />
            </fieldset>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Guardar el monto
          </button>
        </form>
      </section>

      <section className="mt-6 space-y-2">
        {isRecurring && !alreadyEnded && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await endRecurringExpense(id);
                setStatus(result.ok ? "Listo: deja de contar desde este mes." : null);
                if (!result.ok) setError(result.message);
              })
            }
            className="flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken disabled:opacity-70"
          >
            Este gasto ya terminó
          </button>
        )}

        {isArchived && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await restoreExpense(id);
                setStatus(result.ok ? "Recuperado: vuelve a sumar al saldo de la tarjeta." : null);
                if (!result.ok) setError(result.message);
              })
            }
            className="flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken disabled:opacity-70"
          >
            El resumen no lo incluía — recuperarlo
          </button>
        )}

        {status && (
          <p role="status" className="text-[11.5px] text-leaf-deep">
            {status}
          </p>
        )}
      </section>
    </>
  );
}

function ScopeOption({
  checked,
  onSelect,
  title,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <label
      className="mt-2 flex cursor-pointer gap-3 rounded-surface border px-3 py-3"
      style={{
        backgroundColor: checked ? "#E0F4E9" : "#FFFFFF",
        borderColor: checked ? "#BEE1CE" : "#DEE3DD",
      }}
    >
      <input
        type="radio"
        name="scope_choice"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6B5C]"
      />
      <span>
        <span className="block text-card" style={{ color: checked ? "#175F42" : "#12211D" }}>
          {title}
        </span>
        <span className="mt-1 block text-[11px] leading-[1.45] text-muted">{note}</span>
      </span>
    </label>
  );
}
