import { createClient } from "@/lib/supabase/server";
import { getActiveScenario } from "@/lib/scenarios";
import { createBridgeLoan, markBridgeLoanRepaid, deleteBridgeLoan } from "./actions";
import { BridgeIcon, CheckIcon } from "@/lib/icons";
import Link from "next/link";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BridgeLoansPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const scenario = await getActiveScenario(supabase, user.id);

  const { data: loans } = await supabase
    .from("bridge_loans")
    .select("*")
    .eq("scenario_id", scenario.id)
    .order("received_month");

  const loansById = new Map((loans ?? []).map((l) => [l.id, l]));

  return (
    <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/cashflow">← Volver a flujo de caja</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BridgeIcon width={26} height={26} />
        Préstamos puente
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Un préstamo corto para tapar un mes específico, con devolución programada — a veces
        encadenado (tomás uno para devolver el anterior). Escenario: {scenario.name}.
      </p>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      {loans && loans.some((l) => !l.repaid) && (
        <p style={{ marginTop: 20, marginBottom: 0 }}>
          <span className="stamp-total stamp-total--negative">
            PENDIENTE DE DEVOLVER: {formatCurrency(loans.filter((l) => !l.repaid).reduce((sum, l) => sum + Number(l.amount), 0))}
          </span>
        </p>
      )}

      <section style={{ marginTop: 24 }}>
        {(!loans || loans.length === 0) && (
          <p style={{ color: "var(--ink-muted)" }}>Todavía no agregaste ningún préstamo puente.</p>
        )}

        {loans && loans.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--board-seam)" }}>
                <th style={{ padding: "8px 4px" }}>Fuente</th>
                <th style={{ padding: "8px 4px" }}>Monto</th>
                <th style={{ padding: "8px 4px" }}>Recibido</th>
                <th style={{ padding: "8px 4px" }}>Devuelve</th>
                <th style={{ padding: "8px 4px" }}></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const chainedFrom = loan.chained_from_id ? loansById.get(loan.chained_from_id) : null;
                return (
                  <tr key={loan.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                    <td style={{ padding: "8px 4px" }}>
                      {loan.source}
                      {chainedFrom && (
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-muted)" }}>
                          ← encadenado de {chainedFrom.source}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(loan.amount))}</td>
                    <td style={{ padding: "8px 4px" }}>{loan.received_month.slice(0, 7)}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {loan.repay_month.slice(0, 7)}
                      {loan.repaid && (
                        <span
                          style={{
                            color: "var(--led-green)",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <CheckIcon width={11} height={11} /> devuelto
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>
                      {!loan.repaid && (
                        <form action={markBridgeLoanRepaid} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={loan.id} />
                          <button type="submit" style={{ background: "none", border: "none", color: "var(--led-green)", cursor: "pointer" }}>
                            Marcar devuelto
                          </button>
                        </form>
                      )}
                      <form action={deleteBridgeLoan} style={{ display: "inline", marginLeft: 8 }}>
                        <input type="hidden" name="id" value={loan.id} />
                        <button type="submit" style={{ background: "none", border: "none", color: "var(--led-red)", cursor: "pointer" }}>
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <hr className="ticket-divider" />

      <section style={{ marginTop: 32 }}>
        <h2>+ Nuevo préstamo puente</h2>
        <form action={createBridgeLoan} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
          <label>
            Fuente
            <input
              type="text"
              name="source"
              required
              placeholder="ej: MercadoPago, Brubank"
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
            Mes en que lo recibís
            <input
              type="month"
              name="received_month"
              required
              defaultValue={currentMonthInput()}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Mes en que lo devolvés
            <input
              type="month"
              name="repay_month"
              required
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Tasa estimada % mensual (opcional)
            <input
              type="number"
              name="estimated_rate"
              step="0.01"
              min="0"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            ¿Se toma para devolver otro préstamo puente? (opcional)
            <select name="chained_from_id" defaultValue="" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
              <option value="">No, es independiente</option>
              {(loans ?? [])
                .filter((l) => !l.repaid)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.source} — {formatCurrency(Number(l.amount))} (devuelve {l.repay_month.slice(0, 7)})
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
            Agregar préstamo puente
          </button>
        </form>
      </section>
    </main>
  );
}
