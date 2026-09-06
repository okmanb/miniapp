"use client";

import { useState, useTransition } from "react";
import { createExpense } from "@/app/dashboard/expenses/actions";
import { Spinner } from "./ui";

/**
 * Alta de un gasto (pantalla 05).
 *
 * El selector de arriba no es una etiqueta: elige comportamiento. "Gasto
 * fijo" suma a todos los meses de la proyección; "único a una tarjeta" suma
 * una sola vez, al mes en curso. Por eso la ayuda de cada campo cambia con la
 * elección en vez de describir las dos cosas a la vez.
 */

export interface CardOption {
  id: string;
  name: string;
}

export function ExpenseForm({ cards }: { cards: CardOption[] }) {
  const [kind, setKind] = useState<"fijo" | "unico">("fijo");
  const [debtId, setDebtId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOneOff = kind === "unico";

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          // Un consumo único siempre va a una tarjeta: el select de abajo se
          // oculta y el valor viaja igual.
          const result = await createExpense(formData);
          if (result && !result.ok) setError(result.message);
        })
      }
    >
      <input type="hidden" name="kind" value={kind} />

      <p className="help mt-2">
        ¿Es algo que se repite todos los meses, o un gasto suelto de una sola vez a una
        tarjeta?
      </p>

      <SegmentedToggle
        value={kind}
        onChange={(next) => {
          setKind(next);
          // Volver a "fijo" no debe arrastrar una tarjeta elegida sin querer.
          if (next === "fijo") setDebtId("");
        }}
      />

      <label htmlFor="description" className="mt-5 block text-label uppercase text-muted">
        Nombre
      </label>
      <input
        id="description"
        name="description"
        required
        autoComplete="off"
        placeholder={isOneOff ? "Heladera nueva" : "Colegio"}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
      />
      <p className="help mt-1.5">
        {isOneOff
          ? "Entra una sola vez, en el mes en curso."
          : "Se repite todos los meses. Podés terminarlo más adelante sin borrar el historial."}
      </p>

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
          autoComplete="off"
          placeholder="0"
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      <label htmlFor="debt_id" className="mt-5 block text-label uppercase text-muted">
        {isOneOff ? "A qué tarjeta va" : "Se paga con esta tarjeta en vez de en efectivo (opcional)"}
      </label>
      <select
        id="debt_id"
        name="debt_id"
        required={isOneOff}
        value={debtId}
        onChange={(e) => setDebtId(e.target.value)}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
      >
        {!isOneOff && <option value="">Efectivo o transferencia</option>}
        {isOneOff && <option value="">Elegí una tarjeta</option>}
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="help mt-1.5">
        Si lo pagás con tarjeta, el gasto entra en el resumen de esa tarjeta y no en efectivo:
        no se descuenta dos veces.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-surface border border-brick-border bg-brick-bg px-3 py-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
      >
        {pending && <Spinner className="text-white" />}
        Agregar gasto
      </button>
    </form>
  );
}

/**
 * Selector segmentado. La pastilla activa se mueve con clip-path y la curva
 * cubic-bezier(.77,0,.175,1) — la única excepción documentada a la curva del
 * sistema, porque acá el movimiento tiene que sentirse mecánico y no elástico.
 *
 * Son dos botones reales, no un input escondido: se puede llegar con teclado
 * y el estado se anuncia con aria-pressed.
 */
function SegmentedToggle({
  value,
  onChange,
}: {
  value: "fijo" | "unico";
  onChange: (next: "fijo" | "unico") => void;
}) {
  const index = value === "fijo" ? 0 : 1;

  return (
    <div className="relative mt-3 grid grid-cols-2 rounded-pill border border-border bg-surface-alt p-1">
      <span
        data-motion-move
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-pill bg-pine"
        style={{
          width: "calc(50% - 4px)",
          transform: `translateX(${index * 100}%)`,
          transition: "transform 260ms cubic-bezier(.77,0,.175,1)",
        }}
      />
      {(["fijo", "unico"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className="relative z-10 min-h-touch rounded-pill px-3 text-card transition-colors duration-200 ease-sd"
          style={{ color: value === option ? "#FFFFFF" : "#5C6B65" }}
        >
          {option === "fijo" ? "Gasto fijo" : "Único a una tarjeta"}
        </button>
      ))}
    </div>
  );
}
