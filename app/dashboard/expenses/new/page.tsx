import { createClient } from "@/lib/supabase/server";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import { createExpense } from "../../cashflow/actions";
import { addOneOffCardCharge } from "../../debts/[id]/charges/actions";
import ExpenseTypeToggle from "../ExpenseTypeToggle";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function NewGenericExpensePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo tarjetas/préstamos de primer nivel — pagar un gasto fijo "a
  // través de" una cuota/refinanciación puntual no tiene sentido, esa
  // ya es su propio gasto.
  const { data: topLevelDebts } = user
    ? await supabase
        .from("debts")
        .select("id, name, debt_type")
        .eq("is_active", true)
        .is("parent_debt_id", null)
        .or(scenarioFilter(await getActiveScenario(supabase, user.id)))
        .order("name")
    : { data: null };

  const cardDebts = (topLevelDebts ?? []).filter((d) => d.debt_type === "credit_card");

  const fixedForm = (
    <form action={createExpense} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <input type="number" name="amount" required step="0.01" min="0" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
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
        <select name="paid_via_debt_id" defaultValue="" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
          <option value="">No, se paga en efectivo/transferencia</option>
          {(topLevelDebts ?? []).map((d) => (
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
  );

  const oneOffForm =
    cardDebts.length === 0 ? (
      <p style={{ color: "var(--on-surface-variant)" }}>
        Todavía no tenés ninguna tarjeta cargada —{" "}
        <Link href="/dashboard/debts/new">agregá una primero</Link>.
      </p>
    ) : (
      <form action={addOneOffCardCharge} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Tarjeta
          <select name="debt_id" required defaultValue="" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="" disabled>
              Elegí una tarjeta
            </option>
            {cardDebts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descripción
          <input
            type="text"
            name="description"
            required
            placeholder="ej: Nafta"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Monto
          <input type="number" name="amount" step="0.01" min="0.01" required style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Agregar gasto
        </button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--on-surface-variant)" }}>
          Se carga al mes en curso, como consumo real de la tarjeta — cuando llegue el resumen
          bancario de ese mes, revisá que el total de "consumos nuevos" que cargues ahí ya lo
          incluya, para no contarlo dos veces.
        </p>
      </form>
    );

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Agregar gasto
      </h1>
      <p style={{ color: "var(--on-surface-variant)", fontSize: 14 }}>
        ¿Es algo que se repite todos los meses, o un gasto suelto de una sola vez a una tarjeta?
      </p>

      {searchParams.error && (
        <p style={{ background: "var(--error-container)", color: "var(--on-error-container)", padding: "10px 14px", borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          {searchParams.error}
        </p>
      )}

      <ExpenseTypeToggle fixedForm={fixedForm} oneOffForm={oneOffForm} />
    </main>
  );
}
