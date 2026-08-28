import { uploadAndParseStatement } from "./actions";
import { FileUpIcon } from "@/lib/icons";
import Link from "next/link";

export default function UploadStatementPage({
  params,
}: {
  params: { id: string };
}) {
  const boundUpload = uploadAndParseStatement.bind(null, params.id);

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href={`/dashboard/debts/${params.id}/schedule`}>← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <FileUpIcon width={26} height={26} />
        Subir resumen (PDF)
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Funciona con el formato de resumen de BBVA y Banco Patagonia. El sistema va a leer los
        montos automáticamente y te va a mostrar una vista previa editable antes de guardar nada.
      </p>

      <form
        action={boundUpload}
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}
      >
        <input type="file" name="file" accept="application/pdf" required />
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Analizar PDF
        </button>
      </form>
    </main>
  );
}
