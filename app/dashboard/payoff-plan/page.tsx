import { createClient } from "@/lib/supabase/server";
import { calculatePayoffPlan, type PayoffStrategy } from "@/lib/debt-engine/payoff-plan";
import type { Debt } from "@/lib/debt-engine";
import type { DebtScheduleEntry } from "@/lib/debt-engine/schedule";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import {
  ArrowLeftIcon,
  AvalancheIcon,
  BankIcon,
  CarIcon,
  CreditCardIcon,
  HandshakeIcon,
  HomeIcon,
  AlertTriangleIcon,
  ReceiptIcon,
  SnowballIcon,
  TargetIcon,
} from "@/lib/icons";
import Link from "next/link";

// Mismo mapeo ícono-por-tipo que app/dashboard/page.tsx — prendario es
// literalmente el auto en garantía, no una elección decorativa.
const DEBT_TYPE_ICON: Record<string, typeof CreditCardIcon> = {
  credit_card: CreditCardIcon,
  personal_loan: BankIcon,
  plan_v: ReceiptIcon,
  mortgage: HomeIcon,
  prendario: CarIcon,
  informal: HandshakeIcon,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonths(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} meses`;
  if (rest === 0) return `${years} años`;
  return `${years} años y ${rest} meses`;
}

export default async function PayoffPlanPage({
  searchParams,
}: {
  searchParams: { strategy?: string; extra?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const scenario = await getActiveScenario(supabase, user.id);

  const { data: debtsData } = await supabase
    .from("debts")
    .select("*")
    .eq("is_active", true)
    .gt("current_balance", 0)
    .or(scenarioFilter(scenario));

  const debts = (debtsData ?? []) as Debt[];
  const debtsById = new Map(debts.map((d) => [d.id, d]));
  const debtIds = debts.map((d) => d.id);

  const { data: entries } =
    debtIds.length > 0
      ? await supabase.from("debt_schedule_entries").select("*").in("debt_id", debtIds)
      : { data: [] as DebtScheduleEntry[] };

  const scheduleEntriesByDebt = new Map<string, DebtScheduleEntry[]>();
  for (const entry of entries ?? []) {
    const list = scheduleEntriesByDebt.get(entry.debt_id) ?? [];
    list.push(entry as DebtScheduleEntry);
    scheduleEntriesByDebt.set(entry.debt_id, list);
  }

  const strategy = (searchParams.strategy as PayoffStrategy) || null;
  const extra = searchParams.extra ? Number(searchParams.extra) : 0;
  const selectedStrategy: PayoffStrategy = strategy === "snowball" ? "snowball" : "avalanche";

  let plan: Awaited<ReturnType<typeof calculatePayoffPlan>> | null = null;
  let planError: string | null = null;

  if (strategy && debts.length > 0) {
    try {
      plan = await calculatePayoffPlan(debts, scheduleEntriesByDebt, strategy, extra);
    } catch (err) {
      planError = err instanceof Error ? err.message : "Error calculando el plan";
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "56px auto", padding: "0 24px 80px" }}>
      <Link
        href="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--on-surface-variant)" }}
      >
        <ArrowLeftIcon width={15} height={15} />
        Volver al dashboard
      </Link>

      <h1 style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <TargetIcon width={24} height={24} style={{ color: "var(--primary)" }} />
        Plan destructor de deudas
      </h1>

      {debts.length === 0 && (
        <div className="paper-card" style={{ marginTop: 20 }}>
          <p style={{ margin: 0, color: "var(--on-surface-variant)" }}>
            Todavía no tenés deudas agregadas.{" "}
            <Link href="/dashboard/debts/new" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Agregá una acá
            </Link>
            .
          </p>
        </div>
      )}

      {debts.length > 0 && (
        <>
          <p style={{ color: "var(--on-surface-variant)", fontSize: 15, lineHeight: 1.5 }}>
            Elegí un método y cuánto podés meter de extra por mes por encima de los pagos
            mínimos. El sistema simula el orden en que vas a cancelar cada deuda.
          </p>

          <form method="get" style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
            <div>
              <div className="strategy-toggle">
                <input
                  type="radio"
                  id="strategy-avalanche"
                  name="strategy"
                  value="avalanche"
                  defaultChecked={strategy !== "snowball"}
                />
                <label htmlFor="strategy-avalanche">
                  <AvalancheIcon width={15} height={15} />
                  Avalancha
                </label>

                <input
                  type="radio"
                  id="strategy-snowball"
                  name="strategy"
                  value="snowball"
                  defaultChecked={strategy === "snowball"}
                />
                <label htmlFor="strategy-snowball">
                  <SnowballIcon width={15} height={15} />
                  Bola de nieve
                </label>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--on-surface-variant)" }}>
                {selectedStrategy === "avalanche"
                  ? "Ataca primero la deuda con la tasa más alta: pagás menos interés total, es la opción matemáticamente óptima."
                  : "Ataca primero la deuda con el saldo más chico: pagás algo más de interés, pero cancelás deudas completas más rápido."}
              </p>
            </div>

            <label htmlFor="extra" style={{ marginBottom: -8 }}>
              Extra mensual disponible (por encima de los mínimos)
            </label>
            <input
              id="extra"
              type="number"
              name="extra"
              min="0"
              step="1000"
              defaultValue={extra || ""}
              placeholder="ej: 50000"
              style={{ width: "100%", padding: "10px 12px" }}
            />

            <button type="submit" style={{ alignSelf: "flex-start" }}>
              Calcular plan
            </button>
          </form>

          {planError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--error-container)",
                color: "var(--on-error-container)",
                padding: "12px 16px",
                borderRadius: "var(--radius)",
                fontSize: 14,
                fontWeight: 600,
                marginTop: 24,
              }}
            >
              <AlertTriangleIcon width={16} height={16} />
              {planError}
            </div>
          )}

          {plan && (
            <section style={{ marginTop: 32 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
                {plan.strategy === "avalanche" ? <AvalancheIcon width={18} height={18} /> : <SnowballIcon width={18} height={18} />}
                Resultado — {plan.strategy === "avalanche" ? "Avalancha" : "Bola de nieve"}
              </h2>

              <div className="paper-card" style={{ display: "flex", gap: 32, marginTop: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Quedás libre de deudas en
                  </p>
                  <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700 }}>
                    {formatMonths(plan.monthsToPayoff)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Interés total pagado
                  </p>
                  <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700 }}>
                    {formatCurrency(plan.totalInterestPaid)}
                  </p>
                </div>
              </div>

              <h3 style={{ marginTop: 28, fontSize: 15 }}>Orden en que cancelás cada deuda</h3>
              <div style={{ marginTop: 10 }}>
                {plan.payoffOrder.map((item, i) => {
                  const debt = debtsById.get(item.id);
                  const TypeIcon = (debt && DEBT_TYPE_ICON[debt.debt_type]) ?? CreditCardIcon;
                  // Un Plan V vive dentro de una tarjeta, pero acá se
                  // mantiene en su lugar cronológico real (puede saldarse
                  // antes o después que el saldo revolving de su madre,
                  // por tener otra tasa) — solo se marca de quién es.
                  const parentDebt = debt?.parent_debt_id ? debtsById.get(debt.parent_debt_id) : null;

                  return (
                    <div
                      key={item.id}
                      className="paper-card"
                      style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, padding: "14px 16px" }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--secondary-container)",
                          color: "var(--on-secondary-container)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "var(--surface-container)",
                          color: "var(--on-surface-variant)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <TypeIcon width={16} height={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.name}
                        </p>
                        {((debt?.annual_interest_rate ?? 0) > 0 || parentDebt) && (
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--on-surface-variant)" }}>
                            {/* TNA en 0 en una deuda plan_v significa "cuota
                                sin interés" (ver bbva.ts / patagonia.ts), no
                                un dato faltante — no se muestra "0.00% TNA"
                                para no dar a entender que hay una tasa real. */}
                            {(debt?.annual_interest_rate ?? 0) > 0 && (
                              <span style={{ fontFamily: "var(--font-mono)" }}>{debt!.annual_interest_rate!.toFixed(2)}% TNA</span>
                            )}
                            {(debt?.annual_interest_rate ?? 0) > 0 && parentDebt && " · "}
                            {parentDebt && `de ${parentDebt.name}`}
                          </p>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--on-surface-variant)", textAlign: "right", flexShrink: 0 }}>
                        Te la sacás de encima en{" "}
                        <strong style={{ fontFamily: "var(--font-mono)", color: "var(--on-surface)" }}>{formatMonths(item.monthPaidOff)}</strong>
                      </p>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 13, color: "var(--on-surface-variant)", marginTop: 20 }}>
                Nota: si tenés deudas UVA, el cálculo usa el valor UVA actual como referencia
                constante hacia adelante — es una estimación, no una proyección exacta, porque la
                UVA real va a variar mes a mes.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
