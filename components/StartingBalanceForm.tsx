"use client";

import { useState, useTransition } from "react";
import { setStartingBalance } from "@/app/dashboard/cashflow/actions";
import { Spinner } from "./ui";

/**
 * Saldo real de hoy. Es el punto de partida de toda la proyección, así que la
 * ayuda dice qué cuenta y para qué sirve, no solo qué escribir.
 *
 * inputMode="numeric" y no type="number": en el celular abre el teclado
 * numérico igual, pero deja escribir los puntos de miles como los escribe
 * cualquiera acá, y no arrastra las flechitas de incremento que en un monto
 * no significan nada.
 */
export function StartingBalanceForm({ initial }: { initial: number }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial ? initial.toLocaleString("es-AR") : "");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <form
      className="mt-4 rounded-surface-lg border border-border bg-surface px-4 py-4"
      action={(formData) =>
        startTransition(async () => {
          const result = await setStartingBalance(formData);
          setStatus(
            result.ok
              ? { ok: true, message: "Guardado. La proyección se rehizo desde este número." }
              : { ok: false, message: result.message }
          );
        })
      }
    >
      <label htmlFor="starting_balance" className="text-label uppercase text-muted">
        Saldo real hoy
      </label>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-surface border border-border-input px-3">
          <span className="font-mono text-[15px] text-muted" aria-hidden>
            $
          </span>
          <input
            id="starting_balance"
            name="starting_balance"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-touch items-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          Guardar
        </button>
      </div>

      <p className="help mt-2">Cuenta + efectivo. Es el punto de partida de la proyección.</p>

      {status && (
        <p
          role="status"
          className="mt-2 text-[11.5px]"
          style={{ color: status.ok ? "#175F42" : "#823123" }}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
