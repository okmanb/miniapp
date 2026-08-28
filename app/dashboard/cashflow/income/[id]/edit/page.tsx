import { createClient } from "@/lib/supabase/server";
import { updateIncome } from "../../../actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";

const INCOME_KIND_OPTIONS = [
  { value: "sueldo", label: "Sueldo" },
  { value: "adelanto", label: "Adelanto" },
  { value: "bono", label: "Bono" },
  { value: "aguinaldo", label: "Aguinaldo (SAC)" },
  { value: "changa", label: "Changa" },
  { value: "otro", label: "Otro" },
];

export default async function EditIncomePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: income } = await supabase
    .from("incomes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!income) notFound();

  const boundUpdate = updateIncome.bind(null, params.id);

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/cashflow">← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Editar ingreso
      </h1>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      <form action={boundUpdate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>
          Nombre
          <input
            type="text"
            name="name"
            required
            defaultValue={income.name}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Tipo
          <select name="kind" defaultValue={income.kind} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
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
            defaultValue={income.amount}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Vigente desde
          <input
            type="month"
            name="month"
            required
            defaultValue={income.month.slice(0, 7)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label className="option-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="is_recurring" defaultChecked={income.is_recurring} />
          Se repite todos los meses
        </label>
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Guardar cambios
        </button>
      </form>
    </main>
  );
}
