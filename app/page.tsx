import Link from "next/link";
import { WalletIcon } from "@/lib/icons";

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={28} height={28} style={{ color: "var(--primary)" }} />
        Simulador de deudas
      </h1>
      <p style={{ color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
        Cargá tus deudas y gastos y mantené el estado de tu situación
        financiera actualizado automáticamente a medida que cambian los
        datos reales — sin recalcular nada a mano.
      </p>
      <p style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <Link href="/login">
          <button type="button">Iniciar sesión</button>
        </Link>
        <Link href="/signup">
          <button type="button" style={{ background: "white" }}>Crear cuenta</button>
        </Link>
      </p>
    </main>
  );
}
