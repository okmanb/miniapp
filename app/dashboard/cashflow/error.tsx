"use client";

import Link from "next/link";
import { ErrorBanner, Screen, SecondaryButton } from "@/components/ui";

/**
 * Una proyección a medias es peor que ninguna: si faltaran los ingresos o los
 * pagos del mes, los meses en verde estarían mintiendo. Por eso no se muestra
 * una proyección parcial.
 */
export default function CashflowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">No pudimos armar la proyección</h1>

      <div className="mt-4">
        <ErrorBanner
          title="Faltan datos para proyectar"
          note="No llegamos a leer todo lo que hace falta para encadenar los meses, así que no mostramos una proyección a medias: con los ingresos o los pagos incompletos, los meses en verde estarían de más. Tus datos están intactos."
          action={<SecondaryButton onClick={reset}>Reintentar</SecondaryButton>}
        />
      </div>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted">Referencia: {error.digest}</p>
      )}
    </Screen>
  );
}
