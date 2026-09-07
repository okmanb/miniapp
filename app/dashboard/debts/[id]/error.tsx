"use client";

import Link from "next/link";
import { ErrorBanner, Screen, SecondaryButton } from "@/components/ui";

export default function DebtDetailError({
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
        <span aria-hidden>←</span> Volver a tus deudas
      </Link>

      <h1 className="mt-2 text-screen text-ink">No pudimos cargar esta deuda</h1>

      <div className="mt-4">
        <ErrorBanner
          title="La lectura falló"
          note="No mostramos el saldo ni la comparación de pagos porque no pudimos leerlos: en una pantalla donde se decide cuánto pagar, un número desactualizado es peor que ninguno. La deuda y sus pagos están intactos."
          action={<SecondaryButton onClick={reset}>Reintentar</SecondaryButton>}
        />
      </div>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted">Referencia: {error.digest}</p>
      )}
    </Screen>
  );
}
