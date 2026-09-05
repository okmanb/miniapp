"use client";

import { useState, useTransition } from "react";
import { payMinimum } from "@/app/dashboard/actions";
import { formatMoney } from "@/lib/calc/money";
import { Spinner } from "./ui";

/**
 * Atajo dentro de la bandeja de alertas: registrar el mínimo de la deuda que
 * un pago puede destrabar.
 *
 * Cuando ya está registrado no desaparece ni se deshabilita en silencio: pasa
 * a decir que ya está y queda como confirmación. Un botón que se esfuma
 * después de tocarlo deja la duda de si llegó a hacer algo.
 */
export function PayMinimumButton({
  debtId,
  debtName,
  amount,
  alreadyPaid,
}: {
  debtId: string;
  debtName: string;
  amount: number;
  alreadyPaid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyPaid);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p
        className="mt-2 rounded-pill border px-[15px] py-2 text-[11.5px] font-semibold"
        style={{ backgroundColor: "#E0F4E9", borderColor: "#BEE1CE", color: "#175F42" }}
      >
        Mínimo de {debtName} registrado
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await payMinimum(debtId);
            if (result.ok) setDone(true);
            else setError(result.message);
          })
        }
        className="mt-2 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface px-[15px] py-2 text-[11.5px] font-semibold text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken disabled:opacity-70"
      >
        {pending && <Spinner className="text-pine" />}
        Pagar el mínimo de {debtName} · {formatMoney(amount)}
      </button>

      {error && (
        <p role="alert" className="mt-1.5 text-[11px] text-brick-ink">
          {error}
        </p>
      )}
    </>
  );
}
