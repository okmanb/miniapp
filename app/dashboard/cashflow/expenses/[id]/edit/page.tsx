import { createClient } from "@/lib/supabase/server";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import { updateExpense } from "../../../actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: expense }, { data: debts }] = await Promise.all([
    supabase.from("fixed_expenses").select("*").eq("id", params.id).single(),
    // Solo tarjetas/préstamos de primer nivel — ver la misma nota en
    // cashflow/expenses/new/page.tsx.
    user
      ? supabase
          .from("debts")
          .select("id, name")
          .eq("is_active", true)
          .is("parent_debt_id", null)
          .or(scenarioFilter(await getActiveScenario(supabase, user.id)))
          .order("name")
      : Promise.resolve({ data: null }),
  ]);

  if (!expense) notFound();

  const boundUpdate = updateExpense.bind(null, params.id);

  return (
    <main style={{ maxWidth: 400, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/cashflow">← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Editar gasto
      </h1>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      <form action={boundUpdate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>
          Nombre
          <input
            type="text"
            name="name"
            required
            defaultValue={expense.name}
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
            defaultValue={expense.amount}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Vigente desde
          <input
            type="month"
            name="month"
            required
            defaultValue={expense.month.slice(0, 7)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label className="option-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="is_recurring" defaultChecked={expense.is_recurring} />
          Se repite todos los meses
        </label>
        <label>
          Se paga con esta tarjeta en vez de en efectivo (opcional)
          <select
            name="paid_via_debt_id"
            defaultValue={expense.paid_via_debt_id ?? ""}
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
          Guardar cambios
        </button>
      </form>
    </main>
  );
}
