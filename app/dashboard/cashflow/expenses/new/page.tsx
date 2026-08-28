import { createClient } from "@/lib/supabase/server";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import { createExpense } from "../../actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function NewExpensePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo tarjetas/préstamos de primer nivel — pagar un gasto fijo "a
  // través de" una cuota/refinanciación puntual no tiene sentido, esa
  // ya es su propio gasto (ver payoff-plan del cupón); lo que existe
  // para pagar algo con es la tarjeta madre.
  const debts = user
    ? (
        await supabase
          .from("debts")
          .select("id, name")
          .eq("is_active", true)
          .is("parent_debt_id", null)
          .or(scenarioFilter(await getActiveScenario(supabase, user.id)))
          .order("name")
      ).data
    : null;

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/cashflow">← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Agregar gasto
      </h1>

      <form action={createExpense} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <label>
          Nombre
          <input
            type="text"
            name="name"
            required
            placeholder="ej: Colegio, Súper, Cuota a mi hija"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
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
          Se repite todos los meses (desmarcalo si es un pago puntual de este mes — ej. una de dos
          cuotas de un atraso partido)
        </label>
        <label>
          Se paga con esta tarjeta en vez de en efectivo (opcional)
          <select
            name="paid_via_debt_id"
            defaultValue=""
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="">No, se paga en efectivo/transferencia</option>
            {(debts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Agregar gasto
        </button>
      </form>
    </main>
  );
}
