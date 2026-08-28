import { uploadStatementForNewDebt } from "./actions";
import { FileUpIcon } from "@/lib/icons";
import Link from "next/link";

export default function UploadNewDebtStatementPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <FileUpIcon width={26} height={26} />
        Agregar tarjeta desde un resumen (PDF)
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Funciona con el formato de resumen de BBVA. Creamos la tarjeta y el
        primer resumen a partir de lo que el sistema lea — te muestro todo
        antes de guardar nada.
      </p>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      <form
        action={uploadStatementForNewDebt}
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}
      >
        <input type="file" name="file" accept="application/pdf" required />
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Analizar PDF
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        ¿Preferís agregarla a mano? <Link href="/dashboard/debts/new">Andá al formulario manual</Link>.
      </p>
    </main>
  );
}
