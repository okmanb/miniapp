import { createClient } from "@/lib/supabase/server";
import { createPayment, deletePayment } from "./actions";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR");
}

export default async function DebtPaymentsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();

  const { data: debt } = await supabase
    .from("debts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!debt) notFound();

  const { data: payments } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("debt_id", params.id)
    .order("payment_date", { ascending: false });

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const boundCreatePayment = createPayment.bind(null, params.id);
  const today = new Date().toISOString().split("T")[0];

  return (
    <main style={{ maxWidth: 600, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Pagos — {debt.name}
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Saldo actual: {formatCurrency(Number(debt.current_balance))}
      </p>

      {searchParams.error && (
        <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>
      )}

      <form
        action={boundCreatePayment}
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}
      >
        <h2 style={{ fontSize: 16 }}>Registrar un pago</h2>

        <label>
          Monto pagado
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
          Fecha del pago
          <input
            type="date"
            name="payment_date"
            required
            defaultValue={today}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Nota (opcional)
          <input
            type="text"
            name="note"
            placeholder="ej: pago parcial, adelanto"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          El monto se descuenta automáticamente del saldo actual de la deuda.
        </p>

        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Registrar pago
        </button>
      </form>

      <section style={{ marginTop: 40 }}>
        <h2>Historial</h2>

        {(!payments || payments.length === 0) && (
          <p style={{ color: "var(--ink-muted)" }}>Todavía no registraste ningún pago.</p>
        )}

        {payments && payments.length > 0 && (
          <>
            <p style={{ fontWeight: 600 }}>Total pagado: {formatCurrency(totalPaid)}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--board-seam)" }}>
                  <th style={{ padding: "8px 4px" }}>Fecha</th>
                  <th style={{ padding: "8px 4px" }}>Monto</th>
                  <th style={{ padding: "8px 4px" }}>Nota</th>
                  <th style={{ padding: "8px 4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                    <td style={{ padding: "8px 4px" }}>{formatDate(payment.payment_date)}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {formatCurrency(Number(payment.amount))}
                    </td>
                    <td style={{ padding: "8px 4px", color: "var(--ink-muted)" }}>{payment.note ?? "—"}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <form action={deletePayment}>
                        <input type="hidden" name="payment_id" value={payment.id} />
                        <input type="hidden" name="debt_id" value={params.id} />
                        <button
                          type="submit"
                          style={{
                            color: "var(--led-red)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </main>
  );
}
