"use client";

import { useEffect } from "react";
import { FrownIcon } from "@/lib/icons";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Lo dejamos en la consola del servidor/browser para poder
    // diagnosticarlo — el usuario ve el mensaje amigable de abajo.
    console.error("Error en el dashboard:", error);
  }, [error]);

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <FrownIcon width={22} height={22} />
        Algo salió mal
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Hubo un error inesperado cargando esta pantalla. No debería haber
        pasado nada con tus datos — probá de nuevo.
      </p>
      <button type="button" onClick={() => reset()} style={{ padding: "10px 20px", cursor: "pointer", marginTop: 12 }}>
        Reintentar
      </button>
      <p style={{ marginTop: 24 }}>
        <a href="/dashboard">Volver al dashboard</a>
      </p>
    </main>
  );
}
