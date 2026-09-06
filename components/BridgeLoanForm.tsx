"use client";

import { useState, useTransition } from "react";
import { createBridgeLoan } from "@/app/dashboard/bridge-loans/actions";
import { Spinner } from "./ui";

export function BridgeLoanForm() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-ink">Simular uno</h2>

      <form
        className="mt-3"
        action={(formData) =>
          startTransition(async () => {
            const result = await createBridgeLoan(formData);
            setStatus(
              result.ok
                ? { ok: true, message: "Cargado. Miralo en el flujo: el mes de la devolución es el que hay que revisar." }
                : { ok: false, message: result.message }
            );
          })
        }
      >
        <label htmlFor="lender" className="block text-label uppercase text-muted">
          De quién
        </label>
        <input
          id="lender"
          name="lender"
          required
          autoComplete="off"
          placeholder="Un familiar, el banco, un adelanto"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        <label htmlFor="amount" className="mt-5 block text-label uppercase text-muted">
          Cuánto
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

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="taken_period" className="block text-label uppercase text-muted">
              Entra en
            </label>
            <input
              id="taken_period"
              name="taken_period"
              type="month"
              required
              className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[14px] text-ink outline-none"
            />
          </div>
          <div>
            <label htmlFor="repay_period" className="block text-label uppercase text-muted">
              Se devuelve en
            </label>
            <input
              id="repay_period"
              name="repay_period"
              type="month"
              className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[14px] text-ink outline-none"
            />
          </div>
        </div>
        <p className="help mt-1.5">
          El mes de la devolución es el que importa: ahí el puente se cobra entero.
        </p>

        <label htmlFor="note" className="mt-5 block text-label uppercase text-muted">
          Nota (opcional)
        </label>
        <input
          id="note"
          name="note"
          autoComplete="off"
          placeholder="Qué acordaste"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          Simular este puente
        </button>

        {status && (
          <p
            role="status"
            className="mt-3 text-[11.5px]"
            style={{ color: status.ok ? "#175F42" : "#823123" }}
          >
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
