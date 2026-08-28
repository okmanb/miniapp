import { createIncome } from "../../actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";

const INCOME_KIND_OPTIONS = [
  { value: "sueldo", label: "Sueldo" },
  { value: "adelanto", label: "Adelanto" },
  { value: "bono", label: "Bono" },
  { value: "aguinaldo", label: "Aguinaldo (SAC)" },
  { value: "changa", label: "Changa" },
  { value: "otro", label: "Otro" },
];

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function NewIncomePage() {
  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/cashflow">← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Agregar ingreso
      </h1>

      <form action={createIncome} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <label>
          Nombre
          <input
            type="text"
            name="name"
            required
            placeholder="ej: Sueldo, Adelanto"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Tipo
          <select name="kind" defaultValue="sueldo" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            {INCOME_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monto
          <input
            type="number"
            name="amount"
            required
            step="0.01"
            min="0"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Vigente desde
          <input
            type="month"
            name="month"
            required
            defaultValue={currentMonthInput()}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label className="option-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="is_recurring" defaultChecked />
          Se repite todos los meses (desmarcalo si es un ingreso puntual de este mes, como un bono)
        </label>
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Agregar ingreso
        </button>
      </form>
    </main>
  );
}
