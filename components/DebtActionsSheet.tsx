"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { archiveDebt } from "@/app/dashboard/debts/actions";

/**
 * El "⋯" de una tarjeta de deuda: las acciones que la tarjeta no hace.
 *
 * La tarjeta entera lleva a su detalle, así que estas cuatro necesitaban otro
 * lugar. Sin el menú, cargar el resumen de una tarjeta pedía entrar al detalle
 * y bajar hasta el pie — tres toques para lo que acá es uno.
 *
 * Va por un portal al `body` por lo mismo que el calendario: `Screen` anima su
 * opacidad al entrar y eso crea un contexto de apilado donde el z-index de un
 * panel deja de competir con el de la barra inferior.
 */

const OPTIONS = [
  {
    slug: "cuotas",
    label: "Cuotas y gastos",
    note: "Compras en cuotas y consumos del mes",
    glyph: "▤",
  },
  {
    slug: "resumen",
    label: "Cargar el resumen",
    note: "Cerrar el mes de esta tarjeta",
    glyph: "↑",
  },
  {
    slug: "editar",
    label: "Editar los datos",
    note: "Saldo, tasa, mínimo y vencimiento",
    glyph: "✎",
  },
] as const;

export function DebtActionsSheet({ debtId, debtName }: { debtId: string; debtName: string }) {
  const [open, setOpen] = useState(false);
  const [archiving, startArchiving] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function hrefFor(slug: (typeof OPTIONS)[number]["slug"]): string {
    if (slug === "cuotas") return `/dashboard/debts/${debtId}/cuotas`;
    if (slug === "resumen") return `/dashboard/statements/new?deuda=${debtId}`;
    return `/dashboard/debts/${debtId}/edit`;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Más acciones de ${debtName}`}
        onClick={() => setOpen(true)}
        /*
          `pointer-events-auto` y un z propio porque la tarjeta entera es un
          enlace por debajo: sin esto, tocar el ⋯ abriría el detalle.
        */
        className="pointer-events-auto absolute right-0.5 top-1 z-[4] flex h-11 w-11 items-center justify-center rounded-pill text-[17px] leading-none text-muted transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        ⋯
      </button>

      {open &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 animate-banner-in bg-[rgba(18,33,29,.5)]"
              data-motion
              aria-hidden
            />

            <div
              role="menu"
              aria-label={debtName}
              data-motion
              className="fixed inset-x-[26px] z-50 mx-auto max-w-[380px] animate-card-in overflow-hidden rounded-[22px] border border-[rgba(14,58,49,.1)] bg-surface"
              style={{
                bottom: "calc(84px + env(safe-area-inset-bottom))",
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,.7), 0 26px 54px -20px rgba(14,58,49,.6)",
              }}
            >
              <div className="px-[18px] pb-2 pt-4">
                <p className="truncate text-card text-ink">{debtName}</p>
              </div>

              {OPTIONS.map((option) => (
                <Link
                  key={option.slug}
                  href={hrefFor(option.slug)}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[62px] w-full items-center gap-[13px] border-t border-[#EDF1EC] bg-surface px-[18px] py-[14px] text-left transition-colors duration-150 ease-sd hover:bg-surface-sunken"
                >
                  <span
                    aria-hidden
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-pill bg-mint-wash font-mono text-[15px] text-leaf-deep"
                  >
                    {option.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-card text-ink">{option.label}</span>
                    <span className="block truncate text-[11px] text-muted">{option.note}</span>
                  </span>
                  <span aria-hidden className="shrink-0 text-muted">
                    ›
                  </span>
                </Link>
              ))}

              {/*
                Archivar, no borrar: los pagos y resúmenes de esta deuda son
                historial real, y borrarla los dejaría huérfanos. El botón dice
                "borrar" porque es lo que la persona cree que hace, y la ayuda
                de abajo aclara qué pasa de verdad.
              */}
              <div className="border-t border-[#EDF1EC] px-[18px] pb-4 pt-3">
                <button
                  type="button"
                  disabled={archiving}
                  onClick={() =>
                    startArchiving(async () => {
                      await archiveDebt(debtId);
                      setOpen(false);
                    })
                  }
                  className="min-h-touch w-full rounded-pill border px-[14px] py-[11px] text-[13px] font-semibold transition-colors duration-150 ease-sd disabled:opacity-60"
                  style={{ color: "#B14D3B", borderColor: "#F2C7BE" }}
                >
                  {archiving ? "Borrando…" : "Borrar esta deuda"}
                </button>
                <p className="help mt-2">
                  Sale de tus deudas y del cálculo. Sus pagos y resúmenes quedan guardados.
                </p>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
