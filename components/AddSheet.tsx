"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Hoja de "Agregar" que abre el botón central de la barra.
 *
 * El botón no lleva directo a cargar un gasto: las cinco cosas que se pueden
 * agregar son distintas entre sí y ninguna es tan obviamente "la principal"
 * como para robarse el botón. Cada una dice qué hace debajo del nombre,
 * porque "Cargar resumen" y "Registrar un pago" se confunden si solo se lee
 * el título.
 */

/**
 * Valores del botón central, medidos sobre el prototipo. El relleno no es
 * mint plano: es un degradado con la luz arriba a la izquierda, que es lo que
 * le da volumen. La sombra son dos capas — un pelo de mint por fuera del
 * anillo y un resplandor mint hacia abajo.
 */
const FAB_RING = "#0E3A31";
const FAB_FILL =
  "radial-gradient(120% 120% at 30% 10%, #B6ECCF 0%, #97DCBA 55%, #6FC7A0 100%)";
const FAB_SHADOW =
  "0 0 0 1px rgba(151,220,186,.35), 0 14px 26px -10px rgba(111,199,160,.65)";

const OPTIONS = [
  { href: "/dashboard/debts/new", label: "Agregar deuda", note: "Tarjeta, préstamo, servicio atrasado", glyph: "+" },
  { href: "/dashboard/statements/new", label: "Cargar resumen", note: "Subir el PDF del mes", glyph: "↑" },
  { href: "/dashboard/expenses/new", label: "Agregar gasto", note: "Gasto fijo o consumo del mes", glyph: "−" },
  { href: "/dashboard/payments/new", label: "Registrar un pago", note: "Bajá el saldo de una deuda", glyph: "✓" },
  { href: "/dashboard/incomes", label: "Agregar ingreso", note: "Sueldo, alquiler, freelance", glyph: "↓" },
];

export function AddSheet() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape cierra y el foco vuelve al botón: si no, el foco queda perdido en
  // una hoja que ya no está.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-ondark
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Agregar"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[58px] w-[58px] items-center justify-center rounded-pill text-pine"
        style={{
          // El borde grueso en pine es lo que hace el anillo: recorta el botón
          // contra la barra en vez de apoyarlo encima. Sin él, el FAB es un
          // círculo pegado y pierde el relieve.
          border: `5px solid ${FAB_RING}`,
          backgroundImage: FAB_FILL,
          boxShadow: FAB_SHADOW,
          marginBottom: 8,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Tocar afuera cierra. Es un fondo, no un diálogo: no atrapa el foco. */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-pine/20"
          />

          <div
            ref={panelRef}
            role="menu"
            data-motion
            className="animate-card-in fixed inset-x-0 bottom-[89px] z-40 mx-auto max-w-[430px] px-[18px]"
          >
            <div className="rounded-surface-lg border border-border bg-surface p-2 shadow-card">
              <div className="flex items-baseline justify-between px-2 pb-1 pt-1">
                <span className="text-label uppercase text-muted">Agregar</span>
                <span className="text-[11px] text-muted">Tocá afuera para cerrar</span>
              </div>

              {OPTIONS.map((option) => (
                <Link
                  key={option.href}
                  href={option.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex min-h-touch items-center gap-3 rounded-row px-2 py-2.5 transition-colors duration-150 ease-sd hover:bg-surface-sunken"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-mint-wash font-mono text-[14px] text-leaf-deep"
                    aria-hidden
                  >
                    {option.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-card text-ink">{option.label}</span>
                    <span className="block truncate text-[11px] text-muted">{option.note}</span>
                  </span>
                  <span className="shrink-0 text-muted" aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
