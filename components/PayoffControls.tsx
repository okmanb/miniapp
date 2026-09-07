"use client";

import { useState } from "react";
import type { Strategy } from "@/lib/calc/payoff";

const METHODS: { value: Strategy; icon: string; label: string; note: string }[] = [
  {
    value: "avalancha",
    icon: "❄",
    label: "Avalancha",
    note: "Ataca primero la deuda con la tasa más alta: pagás menos interés total, es la opción matemáticamente óptima.",
  },
  {
    value: "bola_de_nieve",
    icon: "◎",
    label: "Bola de nieve",
    note: "Ataca primero el saldo más chico: pagás más interés, pero cancelás deudas antes, y para mucha gente es lo que sostiene el plan.",
  },
];

/**
 * Método y extra por mes.
 *
 * El extra va como campo libre y no como fila de montos fijos: la pregunta que
 * responde —cuánto podés meter por mes— tiene una respuesta distinta para cada
 * persona, y una lista de opciones la obliga a elegir la más parecida en vez
 * de la suya.
 *
 * El plan se calcula al apretar, no al escribir. Un plan que se rearma con
 * cada tecla convierte una decisión en un tanteo.
 */
export function PayoffControls({
  extra,
  strategy,
}: {
  extra: number;
  strategy: Strategy;
}) {
  const [selected, setSelected] = useState<Strategy>(strategy);
  const method = METHODS.find((m) => m.value === selected)!;

  return (
    <form method="get" action="/dashboard/payoff-plan" className="mt-5">
      <input type="hidden" name="estrategia" value={selected} />

      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setSelected(m.value)}
            aria-pressed={selected === m.value}
            className="flex min-h-touch items-center justify-center gap-2 rounded-pill border px-3 py-[10px] text-card transition-colors duration-150 ease-sd"
            style={{
              backgroundColor: selected === m.value ? "#0E3A31" : "#FFFFFF",
              borderColor: selected === m.value ? "#0E3A31" : "#DEE3DD",
              color: selected === m.value ? "#FFFFFF" : "#5C6B65",
            }}
          >
            <span aria-hidden>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <p className="help mt-2">{method.note}</p>

      <label htmlFor="extra" className="mt-5 block text-label uppercase text-muted">
        Extra mensual disponible (por encima de los mínimos)
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id="extra"
          name="extra"
          inputMode="numeric"
          defaultValue={extra || ""}
          placeholder="ej: 500000"
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      <button
        type="submit"
        className="mt-5 flex min-h-touch w-full items-center justify-center rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
      >
        Calcular plan
      </button>
    </form>
  );
}
