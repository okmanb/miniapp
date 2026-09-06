"use client";

import { useActionState } from "react";
import {
  saveStatement,
  EMPTY_STATEMENT_STATE,
  type StatementState,
} from "@/app/dashboard/statements/actions";
import { formatMoney } from "@/lib/calc/money";
import { Spinner } from "./ui";

/**
 * Carga del resumen del mes (pantalla 06).
 *
 * Cuando el servidor detecta posible doble conteo, el formulario no se
 * reenvía solo: aparece la lista de los gastos que se van a archivar y el
 * botón cambia de texto. Confirmar es un acto aparte, porque la consecuencia
 * (que esos gastos dejen de sumar al saldo) no se ve hasta después.
 */
export function StatementForm({
  cards,
  defaultDebtId,
  defaultPeriod,
}: {
  cards: { id: string; name: string }[];
  defaultDebtId?: string;
  defaultPeriod: string;
}) {
  const [state, formAction, pending] = useActionState<StatementState, FormData>(
    saveStatement,
    EMPTY_STATEMENT_STATE
  );

  const needsConfirm = Boolean(state.pendingDuplicates?.length);

  return (
    <form action={formAction} className="mt-4">
      {/* Al confirmar se reenvía todo el formulario con esta bandera puesta. */}
      {needsConfirm && <input type="hidden" name="confirmed" value="1" />}

      <label htmlFor="debt_id" className="block text-label uppercase text-muted">
        Tarjeta
      </label>
      <select
        id="debt_id"
        name="debt_id"
        required
        defaultValue={defaultDebtId}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
      >
        <option value="">Elegí una</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label htmlFor="period" className="mt-5 block text-label uppercase text-muted">
        Mes del resumen
      </label>
      <input
        id="period"
        name="period"
        type="month"
        required
        defaultValue={defaultPeriod}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
      />

      <MoneyField
        id="new_charges"
        label="Consumos del período"
        help="Lo que gastaste en el mes, sin contar las cuotas que ya venían."
      />
      <MoneyField
        id="minimum_payment"
        label="Pago mínimo"
        help="El que exige el banco. Es el que usamos para avisarte si el saldo va a crecer."
      />
      <MoneyField
        id="amount_paid"
        label="Cuánto pagaste"
        help="Dejalo en cero si todavía no pagaste este resumen."
      />

      {state.message && (
        <div
          role="alert"
          className="mt-5 rounded-surface border px-3 py-3"
          style={{
            backgroundColor: needsConfirm ? "#FCF4E7" : "#FFE9E4",
            borderColor: needsConfirm ? "#EBD9B8" : "#F2C7BE",
          }}
        >
          <p className="text-[12px] font-semibold" style={{ color: needsConfirm ? "#A77530" : "#8E3B2C" }}>
            {needsConfirm ? "Ojo con el doble conteo" : "No se pudo guardar"}
          </p>
          <p className="mt-1 text-[11.5px]" style={{ color: needsConfirm ? "#7A5116" : "#823123" }}>
            {state.message}
          </p>

          {state.pendingDuplicates && (
            <>
              <ul className="mt-2 space-y-1">
                {state.pendingDuplicates.map((expense) => (
                  <li key={expense.id} className="flex justify-between gap-3 text-[11.5px] text-gold-ink">
                    <span className="truncate">{expense.description}</span>
                    <span className="shrink-0 font-mono">{formatMoney(expense.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-gold-ink">
                Si confirmás, estos gastos se archivan: dejan de sumar al saldo porque el
                resumen ya los trae adentro. No se borran — podés recuperarlos desde la lista
                de gastos si el resumen no los incluía.
              </p>
            </>
          )}
        </div>
      )}

      <SubmitButton needsConfirm={needsConfirm} pending={pending} />
    </form>
  );
}

function SubmitButton({ needsConfirm, pending }: { needsConfirm: boolean; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
    >
      {pending && <Spinner className="text-white" />}
      {needsConfirm ? "Entiendo, archivar esos gastos y guardar" : "Guardar el resumen"}
    </button>
  );
}

function MoneyField({ id, label, help }: { id: string; label: string; help: string }) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className="help mt-1.5">{help}</p>
    </div>
  );
}
