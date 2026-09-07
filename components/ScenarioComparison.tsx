"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/calc/money";

export interface ComparisonScenario {
  id: string;
  name: string;
  isActive: boolean;
  canProject: boolean;
  firstGapMonth: string | null;
  worstCushion: number;
  finalCushion: number;
  finalMonth: string;
  averageNet: number;
}

/**
 * Comparación lado a lado.
 *
 * Va plegada porque no es la pregunta de siempre: casi todas las visitas a
 * esta pantalla son para cambiar de escenario, no para analizarlos. Cuando sí
 * es la pregunta, cuatro filas la responden mejor que abrir dos pantallas y
 * acordarse de la primera.
 *
 * El fondo verde marca el mejor valor de cada fila. Sin esa marca la tabla es
 * un montón de números que hay que comparar de a pares.
 */
export function ScenarioComparison({ scenarios }: { scenarios: ComparisonScenario[] }) {
  const [open, setOpen] = useState(false);

  const usable = scenarios.filter((s) => s.canProject);
  if (usable.length < 2) return null;

  // "Sin rojo" gana; entre dos con rojo, el que llega más tarde. El mes se
  // compara por su posición en la proyección, no alfabéticamente.
  const gapRank = (s: ComparisonScenario) =>
    s.firstGapMonth === null ? Infinity : usable.indexOf(s);

  const rows: { label: string; render: (s: ComparisonScenario) => string; score: (s: ComparisonScenario) => number }[] = [
    {
      label: "Primer mes en rojo",
      render: (s) => s.firstGapMonth ?? "ninguno",
      score: (s) => (s.firstGapMonth === null ? Infinity : gapRank(s)),
    },
    {
      label: "Peor colchón",
      render: (s) => formatMoney(s.worstCushion),
      score: (s) => s.worstCushion,
    },
    {
      label: `Colchón en ${usable[0].finalMonth}`,
      render: (s) => formatMoney(s.finalCushion),
      score: (s) => s.finalCushion,
    },
    {
      label: "Neto promedio",
      render: (s) => formatMoney(s.averageNet),
      score: (s) => s.averageNet,
    },
  ];

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-touch w-full items-center justify-between gap-2 rounded-surface border border-border bg-surface px-4 py-3 text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        <span>{open ? "Ocultar comparación" : "Comparar lado a lado"}</span>
        <span aria-hidden>⇄</span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-surface-lg border border-border bg-surface">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-label uppercase text-muted">Métrica</th>
                {usable.map((s) => (
                  <th key={s.id} className="px-3 py-2 text-right text-[11.5px] font-semibold text-ink">
                    {s.isActive && (
                      <span className="mr-1 text-leaf-deep" aria-label="escenario activo">
                        ●
                      </span>
                    )}
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = Math.max(...usable.map(row.score));
                return (
                  <tr key={row.label} className="border-t border-border-row">
                    <td className="px-3 py-2 text-[11.5px] text-muted">{row.label}</td>
                    {usable.map((s) => {
                      const isBest = row.score(s) === best;
                      return (
                        <td
                          key={s.id}
                          className="px-3 py-2 text-right font-mono text-[12px] tabular-nums"
                          style={{
                            backgroundColor: isBest ? "#E0F4E9" : undefined,
                            color: isBest ? "#175F42" : "#12211D",
                            fontWeight: isBest ? 600 : 400,
                          }}
                        >
                          {row.render(s)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="help border-t border-border-row px-3 py-2">
            El fondo verde marca el mejor valor de cada fila. El punto señala el escenario activo.
          </p>
        </div>
      )}
    </div>
  );
}
