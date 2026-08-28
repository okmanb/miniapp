import { createClient } from "@/lib/supabase/server";
import { categorizeCharge, addCardCharge } from "./actions";
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

// El cian queda reservado exclusivamente para datos estimados (La
// Regla del Cian Único) — "fijo/necesario" es un consumo real ya
// categorizado, no una proyección, así que va en tiza (ink) plano.
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  fijo_necesario: { label: "Fijo / necesario", color: "var(--ink)" },
  discrecional: { label: "Discrecional", color: "var(--led-amber)" },
  sin_categorizar: { label: "Sin categorizar", color: "var(--ink-muted)" },
};

export default async function CardChargesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: debt } = await supabase.from("debts").select("*").eq("id", params.id).single();
  if (!debt) notFound();

  const { data: charges } = await supabase
    .from("card_statement_charges")
    .select("*")
    .eq("debt_id", params.id)
    .order("period", { ascending: false })
    .order("amount", { ascending: false });

  const boundCategorize = categorizeCharge.bind(null, params.id);
  const boundAddCharge = addCardCharge.bind(null, params.id);

  const totals = (charges ?? []).reduce(
    (acc, c) => {
      acc[c.category as keyof typeof acc] += Number(c.amount);
      return acc;
    },
    { fijo_necesario: 0, discrecional: 0, sin_categorizar: 0 }
  );

  const byPeriod = new Map<string, typeof charges>();
  for (const c of charges ?? []) {
    const key = c.period.slice(0, 7);
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key)!.push(c);
  }

  return (
    <main style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px" }}>
      <p>
        {debt.debt_type === "credit_card" ? (
          <Link href={`/dashboard/debts/${params.id}/schedule`}>← Volver al cronograma</Link>
        ) : (
          <Link href="/dashboard">← Volver al dashboard</Link>
        )}
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Gastos — {debt.name}
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Categorizá cada consumo como fijo/necesario o discrecional para ver cuánto se puede
        recortar realmente — no siempre alcanza, aunque se recorte todo lo discrecional.
      </p>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      <form
        action={boundAddCharge}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 20, padding: 14, border: "1px solid var(--board-seam)", borderRadius: 6 }}
      >
        <label style={{ flex: "2 1 200px" }}>
          Descripción
          <input
            type="text"
            name="description"
            required
            placeholder="ej: Nafta"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ flex: "1 1 120px" }}>
          Monto
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            required
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Agregar gasto
        </button>
        <p style={{ width: "100%", margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>
          Se carga al mes en curso.
          {debt.debt_type === "credit_card" &&
            " Cuando llegue el resumen bancario de ese mes, revisá que el total de \"consumos nuevos\" que cargues ahí ya lo incluya, para no contarlo dos veces."}
        </p>
      </form>

      {(!charges || charges.length === 0) && (
        <p style={{ color: "var(--ink-muted)", marginTop: 24 }}>
          Todavía no hay consumos detallados cargados. Agregalos arriba a medida que pasan
          {debt.debt_type === "credit_card" && (
            <>
              {" "}
              — o se completan solos cuando subís un resumen en PDF (BBVA o Banco Patagonia) desde{" "}
              <Link href={`/dashboard/debts/${params.id}/schedule/upload`}>Subir resumen</Link>
            </>
          )}
          .
        </p>
      )}

      {charges && charges.length > 0 && (
        <>
          <section style={{ marginTop: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }}>Fijo / necesario</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
                {formatCurrency(totals.fijo_necesario)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                Discrecional — lo recortable
              </p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--led-amber)" }}>
                {formatCurrency(totals.discrecional)}
              </p>
            </div>
            {totals.sin_categorizar > 0 && (
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }}>Sin categorizar</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink-muted)" }}>
                  {formatCurrency(totals.sin_categorizar)}
                </p>
              </div>
            )}
          </section>

          <hr className="ticket-divider" />

          {Array.from(byPeriod.entries()).map(([period, periodCharges]) => (
            <section key={period} style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 16, textTransform: "capitalize" }}>{period}</h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {(periodCharges ?? []).map((charge) => {
                    const meta = CATEGORY_META[charge.category] ?? CATEGORY_META.sin_categorizar;
                    return (
                      <tr key={charge.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                        <td style={{ padding: "8px 4px" }}>{charge.description}</td>
                        <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(charge.amount))}</td>
                        <td style={{ padding: "8px 4px" }}>
                          {charge.category === "sin_categorizar" ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <form action={boundCategorize}>
                                <input type="hidden" name="id" value={charge.id} />
                                <input type="hidden" name="category" value="fijo_necesario" />
                                <button
                                  type="submit"
                                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer", background: "white", color: "var(--ink)", borderColor: "var(--ink-faint)" }}
                                >
                                  Fijo/necesario
                                </button>
                              </form>
                              <form action={boundCategorize}>
                                <input type="hidden" name="id" value={charge.id} />
                                <input type="hidden" name="category" value="discrecional" />
                                <button
                                  type="submit"
                                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer", background: "white", color: "var(--led-amber)", borderColor: "var(--led-amber)" }}
                                >
                                  Discrecional
                                </button>
                              </form>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                              <form action={boundCategorize}>
                                <input type="hidden" name="id" value={charge.id} />
                                <input type="hidden" name="category" value="sin_categorizar" />
                                <button
                                  type="submit"
                                  style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: 12 }}
                                >
                                  cambiar
                                </button>
                              </form>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
