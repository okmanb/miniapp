"use client";

import { ErrorBanner, Screen, SecondaryButton } from "@/components/ui";

/**
 * Estado de error del dashboard.
 *
 * No inventa un saldo ni muestra el último conocido: si no se pudo leer, se
 * dice que no se pudo leer. Una cifra vieja presentada como actual es peor
 * que ninguna cifra en una app donde la gente decide cuánto pagar.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Screen>
      <h1 className="mb-4 text-screen text-ink">No pudimos cargar tus deudas</h1>

      <ErrorBanner
        title="La lectura falló"
        note="No llegamos a leer los datos de este escenario, así que no mostramos ningún saldo: preferimos no mostrarte una cifra que puede estar vieja. Tus datos están intactos."
        action={<SecondaryButton onClick={reset}>Reintentar</SecondaryButton>}
      />

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted">Referencia: {error.digest}</p>
      )}
    </Screen>
  );
}
