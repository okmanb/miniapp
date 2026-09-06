"use client";

import { useState, useTransition } from "react";
import {
  activateScenario,
  createScenario,
  duplicateScenario,
} from "@/app/dashboard/scenarios/actions";
import { Spinner } from "./ui";

/**
 * Acciones de un escenario. Copiar pide el nombre antes de hacer nada: una
 * copia llamada "Plan base (copia)" en una lista de escenarios que ya se
 * parecen entre sí no se distingue de nada.
 */
export function ScenarioActions({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-border-row pt-3">
      <div className="flex flex-wrap gap-2">
        {!isActive && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await activateScenario(id);
                if (!result.ok) setError(result.message);
              })
            }
            className="flex min-h-touch items-center gap-2 rounded-pill bg-teal px-[14px] py-2 text-[12px] font-semibold text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Usar este
          </button>
        )}

        <button
          type="button"
          onClick={() => setCopying((v) => !v)}
          aria-expanded={copying}
          className="min-h-touch rounded-pill border border-border bg-surface px-[14px] py-2 text-[12px] font-semibold text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          {copying ? "Cancelar" : "Copiar"}
        </button>
      </div>

      {copying && (
        <form
          className="mt-3 flex items-center gap-2"
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await duplicateScenario(formData);
              if (result.ok) setCopying(false);
              else setError(result.message);
            })
          }
        >
          <input type="hidden" name="source_id" value={id} />
          <input
            name="name"
            required
            autoFocus
            defaultValue={`${name} — variante`}
            aria-label="Nombre de la copia"
            className="min-h-touch flex-1 rounded-surface border border-border-input bg-surface px-3 text-[13px] text-ink outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-touch items-center gap-2 rounded-pill bg-teal px-[14px] py-2 text-[12px] font-semibold text-white hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Copiar
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function NewScenarioForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-ink">Crear uno vacío</h2>
      <p className="help mt-1">
        Arranca sin deudas ni gastos. Si querés partir de lo que ya tenés, copiá un escenario
        en vez de crear uno.
      </p>

      <form
        className="mt-3 flex items-center gap-2"
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const result = await createScenario(formData);
            if (result.ok) setDone(true);
            else setError(result.message);
          })
        }
      >
        <input
          name="name"
          required
          placeholder="Plan de contingencia"
          aria-label="Nombre del escenario"
          className="min-h-touch flex-1 rounded-surface border border-border-input bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-touch items-center gap-2 rounded-pill border border-border bg-surface px-[14px] py-2 text-[12px] font-semibold text-pine hover:bg-surface-sunken disabled:opacity-70"
        >
          {pending && <Spinner className="text-pine" />}
          Crear
        </button>
      </form>

      {done && (
        <p role="status" className="mt-2 text-[11.5px] text-leaf-deep">
          Listo. Está en la lista de arriba, todavía sin activar.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </section>
  );
}
