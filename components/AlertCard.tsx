"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { snoozeAlert, unsnoozeAllAlerts } from "@/app/dashboard/alerts/actions";
import { useToast } from "./Toast";
import { formatMoney } from "@/lib/calc/money";
import type { DerivedAlert } from "@/lib/calc/alerts";
import { Amount, Spinner } from "./ui";

const SEVERITY = {
  brick: { bg: "#FDF0EC", border: "#EFCDC3", fg: "#B14D3B", ink: "#823123", iconBg: "#FFE9E4" },
  gold: { bg: "#FCF4E7", border: "#EBD9B8", fg: "#A77530", ink: "#7A5116", iconBg: "#FCEEDC" },
} as const;

/**
 * Una alerta.
 *
 * Tres cosas que no son decoración: la cifra dice cuánto duele, el botón dice
 * dónde se resuelve, y "Posponer" existe porque una alerta que no se puede
 * bajar del camino se vuelve ruido y deja de leerse.
 */
export function AlertCard({ alert }: { alert: DerivedAlert }) {
  const c = SEVERITY[alert.severity];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const showToast = useToast((s) => s.show);

  return (
    <div
      data-motion
      className="animate-card-in rounded-surface-lg px-4 py-3"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-pill font-mono text-[13px]"
          style={{ backgroundColor: c.iconBg, color: c.fg }}
          aria-hidden
        >
          {alert.icon}
        </span>
        <div className="min-w-0">
          <div className="text-card" style={{ color: c.fg }}>
            {alert.title}
          </div>
          <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: c.ink }}>
            {alert.body}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t pt-2" style={{ borderColor: c.border }}>
        <span className="text-label uppercase" style={{ color: c.ink }}>
          {alert.metricLabel}
        </span>
        <Amount className="text-[15px] font-semibold" style={{ color: c.fg }}>
          {formatMoney(alert.metricValue)}
        </Amount>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href={alert.href}
          className="flex min-h-touch flex-1 items-center justify-between gap-2 rounded-pill border border-border bg-[#F7FAF7] px-4 py-[10px] text-[12.5px] font-semibold text-pine transition-colors duration-150 ease-sd hover:bg-surface"
        >
          <span>{alert.ctaLabel}</span>
          <span aria-hidden>→</span>
        </Link>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await snoozeAlert(alert.kind, alert.subjectId, alert.debtId);
              if (!result.ok) {
                setError(result.message);
                return;
              }

              /*
               * Los dos mensajes del prototipo. La diferencia no es cosmética:
               * posponer se acorta solo cuando el vencimiento aprieta, y si no
               * se dice, quien pospone se queda creyendo que tiene un día
               * entero de silencio cuando en realidad la alerta vuelve antes.
               *
               * El umbral es el mismo que usa él: si vuelve apreciablemente
               * antes de las 24 horas, fue por la víspera del vencimiento.
               */
              const until = result.until ? new Date(result.until).getTime() : 0;
              const acortada = until > 0 && until < Date.now() + 86_400_000 - 60_000;

              showToast(
                acortada
                  ? "Pospuesta hasta un día antes del vencimiento"
                  : "Pospuesta hasta mañana"
              );
            })
          }
          className="flex min-h-touch shrink-0 items-center gap-2 rounded-pill border border-border bg-surface px-[14px] py-[10px] text-[12.5px] font-semibold text-muted transition-colors duration-150 ease-sd hover:text-pine disabled:opacity-70"
        >
          {pending && <Spinner className="text-muted" />}
          Posponer
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11.5px]" style={{ color: c.ink }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * La fila de las pospuestas. Existe para que posponer no sea un agujero: si no
 * se ve cuántas hay escondidas, la lista vacía miente.
 */
export function SnoozedRow({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-surface border border-border bg-surface-sunken px-4 py-3">
      <span className="text-[11.5px] leading-[1.4] text-muted">
        {count === 1
          ? "1 alerta pospuesta. Vuelve mañana, o antes si el vencimiento aprieta."
          : `${count} alertas pospuestas. Vuelven mañana, o antes si el vencimiento aprieta.`}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await unsnoozeAllAlerts()))}
        className="flex min-h-touch shrink-0 items-center gap-2 text-[12px] font-semibold text-pine transition-colors duration-150 ease-sd hover:text-leaf disabled:opacity-60"
      >
        {pending && <Spinner className="text-pine" />}
        Reactivar
      </button>
    </div>
  );
}
