"use client";

import { useState, useTransition } from "react";
import { updateIncomeAmount, endIncome } from "@/app/dashboard/incomes/actions";
import { Spinner } from "./ui";

/**
 * Cambiar el monto de un ingreso — la pantalla del aumento de sueldo.
 *
 * Es la misma decisión que con el monto de un gasto fijo (`ExpenseEditor`), y
 * la app no puede adivinarla: un monto distinto puede ser una corrección o un
 * aumento, y no significan lo mismo para los meses que ya pasaron. Así que se
 * ofrecen como dos opciones con la consecuencia escrita al lado.
 *
 * **La elección solo aparece si hay historial que conservar.** Un ingreso
 * cargado este mismo mes no tiene meses anteriores que defender: ahí cambiar
 * el monto es corregirlo, y ofrecer lo otro sería ofrecer una fila muerta. La
 * regla es del prototipo, que muestra el selector de alcance solo cuando el
 * registro es de un mes anterior.
 */
export function IncomeEditor({
  id,
  currentAmount,
  hayHistorial,
  desdeMes,
}: {
  id: string;
  currentAmount: number;
  /** El ingreso empezó en un mes anterior: cambiarlo ahora parte la historia en dos. */
  hayHistorial: boolean;
  /** Este mes, escrito. Va en el texto de la opción, para que diga desde cuándo. */
  desdeMes: string;
}) {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<"siempre" | "desde_ahora">(
    hayHistorial ? "desde_ahora" : "siempre"
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-ink">Cambiar el monto</h2>

        <form
          className="mt-3"
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await updateIncomeAmount(formData);
              if (result && !result.ok) setError(result.message);
            })
          }
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="scope" value={hayHistorial ? scope : "siempre"} />

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

          {hayHistorial && (
            <fieldset className="mt-4">
              <legend className="text-label uppercase text-muted">Desde cuándo vale</legend>

              <ScopeOption
                checked={scope === "desde_ahora"}
                onSelect={() => setScope("desde_ahora")}
                title={`Te aumentaron: vale desde ${desdeMes}`}
                note="Lo que cobrabas antes sigue valiendo para los meses que ya pasaron. El historial no se toca."
              />
              <ScopeOption
                checked={scope === "siempre"}
                onSelect={() => setScope("siempre")}
                title="Corregir el monto de siempre"
                note="Era un error de carga: el monto viejo nunca fue el correcto. Cambia también en los meses ya proyectados."
              />
            </fieldset>
          )}

          {!hayHistorial && (
            <p className="help mt-3">
              Lo cargaste este mes, así que todavía no hay meses anteriores que defender:
              cambiar el monto acá lo corrige y nada más.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Guardar el monto
          </button>
        </form>
      </section>

      <section className="mt-6 space-y-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              // Si sale bien no vuelve: la acción redirige a la lista.
              const result = await endIncome(id);
              if (result && !result.ok) setError(result.message);
            })
          }
          className="flex min-h-[51px] w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken disabled:opacity-70"
        >
          Este ingreso ya no entra
        </button>

        <p className="help">
          {hayHistorial
            ? "No se borra: los meses que ya pasaron contaron con esa plata y eso sigue siendo cierto. Sale de la lista y deja de sumar desde este mes."
            : "Como lo cargaste este mes y todavía no contó en ningún mes cerrado, se borra."}
        </p>
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
