"use client";

import { useState, useTransition } from "react";
import { deleteAllData } from "@/app/dashboard/settings/actions";
import { DELETE_CONFIRMATION } from "@/app/dashboard/settings/confirmation";
import { Spinner } from "./ui";

/**
 * Borrar todos los datos.
 *
 * Va plegado detrás de un primer toque y pide escribir una palabra. Es la
 * única acción de la app sin vuelta atrás —en todo el resto se archiva, no se
 * borra— y un botón suelto al final de Ajustes se toca sin querer.
 */
export function DeleteAllDataForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" className="mt-3 text-[11.5px] text-muted">
        Listo: no quedó ningún escenario. La cuenta sigue abierta — creá uno nuevo cuando
        quieras volver a empezar.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-touch w-full items-center justify-center rounded-pill border border-brick-border bg-surface px-[14px] py-[11px] text-card text-brick-ink transition-colors duration-150 ease-sd hover:bg-brick-bg"
      >
        Borrar todos mis datos
      </button>
    );
  }

  return (
    <form
      className="mt-2 rounded-surface border border-brick-border bg-brick-bg px-4 py-3"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await deleteAllData(formData);
          if (result.ok) setDone(true);
          else setError(result.message);
        })
      }
    >
      <div className="text-card text-brick-head">Esto no se puede deshacer</div>
      <p className="mt-1 text-[11.5px] text-brick-ink">
        Se van tus escenarios y con ellos las deudas, los pagos, los resúmenes cargados, las
        cuotas, los gastos, los ingresos y los puentes. La cuenta queda abierta y vacía.
      </p>

      <label htmlFor="confirm" className="mt-3 block text-label uppercase text-brick-ink">
        Escribí {DELETE_CONFIRMATION} para confirmar
      </label>
      <input
        id="confirm"
        name="confirm"
        autoComplete="off"
        autoFocus
        className="mt-2 min-h-touch w-full rounded-surface border border-brick-border bg-surface px-3 font-mono text-[15px] text-ink outline-none"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-pill px-[14px] py-[10px] text-[12.5px] font-semibold text-white transition-opacity duration-150 ease-sd hover:opacity-90 disabled:opacity-70"
          style={{ backgroundColor: "#94362A" }}
        >
          {pending && <Spinner className="text-white" />}
          Borrar todo
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="min-h-touch rounded-pill border border-border bg-surface px-[14px] py-[10px] text-[12.5px] font-semibold text-pine"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </form>
  );
}
