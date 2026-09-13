"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/dashboard/settings/actions";
import { DELETE_CONFIRMATION } from "@/app/dashboard/settings/confirmation";
import { Spinner } from "./ui";

/**
 * Borrar la cuenta.
 *
 * Va debajo de "Borrar todos mis datos" y no en su lugar: son dos decisiones
 * distintas —vaciar y irse— y quien quiere empezar de cero no quiere lo
 * segundo. El orden importa: primero la reversible de las dos.
 *
 * Mismo patrón que la otra: plegado detrás de un toque, pide escribir una
 * palabra, y el aviso dice exactamente qué se va. Acá además hay que decir que
 * el mail queda libre, porque es lo que permite volver a empezar algún día y
 * es lo primero que uno se pregunta.
 *
 * Al terminar recarga la raíz con `window.location`. No sirve `router.push`:
 * la sesión se cerró del lado del servidor y el router traería una pantalla
 * cacheada de una cuenta que ya no existe.
 */
export function DeleteAccountForm({ esDePrueba }: { esDePrueba: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 flex min-h-[51px] w-full items-center justify-center rounded-pill border border-brick-border bg-surface px-[14px] py-[11px] text-card text-brick-ink transition-colors duration-150 ease-sd hover:bg-brick-bg"
        >
          Borrar mi cuenta
        </button>
        <p className="help mt-2">
          {esDePrueba
            ? "La cuenta de prueba y todo lo que tenga adentro, ahora y no en 24 horas."
            : "La cuenta y todo lo que tenga adentro. No hace falta pedirlo por mail."}
        </p>
      </>
    );
  }

  return (
    <form
      className="mt-2 rounded-surface border border-brick-border bg-brick-bg px-4 py-3"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await deleteAccount(formData);
          if (result.ok) window.location.href = "/";
          else setError(result.message);
        })
      }
    >
      <div className="text-card text-brick-head">Esto borra la cuenta entera</div>
      <p className="mt-1 text-[11.5px] text-brick-ink">
        Se van tus deudas, pagos, resúmenes, cuotas, gastos, ingresos y escenarios, y también
        la cuenta: no vas a poder volver a entrar.
        {esDePrueba
          ? " Esta cuenta de prueba no tiene mail, así que no hay nada que recuperar después."
          : " Tu mail queda libre por si algún día querés arrancar de nuevo."}
      </p>

      <label htmlFor="confirm_account" className="mt-3 block text-label uppercase text-brick-ink">
        Escribí {DELETE_CONFIRMATION} para confirmar
      </label>
      <input
        id="confirm_account"
        name="confirm"
        autoComplete="off"
        autoFocus
        className="mt-2 min-h-touch w-full rounded-surface border border-brick-border bg-surface px-3 font-mono text-[15px] text-ink outline-none"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-pill px-[14px] py-[10px] text-[12.5px] font-semibold text-white transition-opacity duration-150 ease-sd hover:opacity-90 disabled:opacity-70"
          style={{ backgroundColor: "#94362A" }}
        >
          {pending && <Spinner className="text-white" />}
          Borrar mi cuenta
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="min-h-[51px] rounded-pill border border-border bg-surface px-[14px] py-[10px] text-[12.5px] font-semibold text-pine"
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
