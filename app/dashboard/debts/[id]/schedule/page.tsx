import { createClient } from "@/lib/supabase/server";
import { createPlanVDebt, deactivatePlanVDebt, createStatement } from "./actions";
import { currentPeriodString } from "@/lib/card-statements";
import { calculateBreakeven } from "@/lib/debt-engine/schedule";
import {
  AlertTriangleIcon,
  BankIcon,
  CarIcon,
  ChartIcon,
  CreditCardIcon,
  DownloadIcon,
  FileUpIcon,
  HandshakeIcon,
  HeartIcon,
  HistoryIcon,
  HomeIcon,
  LightbulbIcon,
  ReceiptIcon,
  TrendingUpIcon,
} from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

const KIND_LABELS: Record<string, string> = {
  cuota_fija: "Cuota fija",
  pago_variable: "Pago variable",
  minimo_estimado: "Mínimo + margen",
  unico: "Pago único",
};

const DEBT_TYPE_ICON: Record<string, typeof CreditCardIcon> = {
  credit_card: CreditCardIcon,
  personal_loan: BankIcon,
  plan_v: ReceiptIcon,
  mortgage: HomeIcon,
  prendario: CarIcon,
  informal: HandshakeIcon,
};

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Tarjeta de crédito",
  personal_loan: "Préstamo personal",
  plan_v: "Refinanciación / cuotas",
  mortgage: "Hipoteca",
  prendario: "Prendario",
  informal: "Deuda informal",
};

// Próxima fecha de vencimiento a partir del due_day — igual que en
// app/dashboard/page.tsx.
function nextDueInfo(dueDay: number | null): { label: string; daysUntil: number | null } {
  if (!dueDay) return { label: "—", daysUntil: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (due < today) due.setMonth(due.getMonth() + 1);
  const daysUntil = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  return { label, daysUntil };
}

// Simulación simple de "si pagara siempre este monto fijo": meses
// hasta llegar a $0 e interés total pagado en el camino. A
// propósito NO usa la fórmula real de mínimo bancario (que baja a
// medida que el saldo baja) — es una comparación ilustrativa entre
// dos montos fijos, por eso se muestra siempre marcada como
// estimación. Si el pago no alcanza a cubrir ni el interés del mes,
// el saldo nunca baja — se devuelve null en vez de inventar un
// número (spec: nunca fabricar un dato de la nada).
function simulateFixedPayoff(balance: number, monthlyRate: number, payment: number, maxMonths = 600) {
  if (payment <= balance * monthlyRate) return { months: null, totalInterest: null };
  let b = balance;
  let totalInterest = 0;
  let months = 0;
  while (b > 0.5 && months < maxMonths) {
    const interest = b * monthlyRate;
    totalInterest += interest;
    b = b + interest - payment;
    months++;
  }
  if (b > 0.5) return { months: null, totalInterest: null };
  return { months, totalInterest: Math.round(totalInterest) };
}

export default async function DebtSchedulePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();

  const { data: debt } = await supabase.from("debts").select("*").eq("id", params.id).single();
  if (!debt) notFound();

  const [{ data: planVDebts }, { data: statements }, { data: scheduleEntries }] = await Promise.all([
    supabase
      .from("debts")
      .select("*")
      .eq("parent_debt_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("card_statements")
      .select("*")
      .eq("debt_id", params.id)
      .order("period", { ascending: false }),
    supabase
      .from("debt_schedule_entries")
      .select("*")
      .eq("debt_id", params.id)
      .order("month", { ascending: false }),
  ]);

  const thisPeriod = currentPeriodString();
  const boundCreatePlan = createPlanVDebt.bind(null, params.id);
  const boundCreateStatement = createStatement.bind(null, params.id);

  const monthlyRate = debt.annual_interest_rate ? Number(debt.annual_interest_rate) / 100 / 12 : 0;
  const breakeven = calculateBreakeven({
    balance: Number(debt.current_balance),
    monthlyRate,
    estimatedNewSpend: 0,
  });

  // --- Datos para la cabecera de salud de deuda ---
  const TypeIcon = DEBT_TYPE_ICON[debt.debt_type] ?? CreditCardIcon;
  const cardBalance =
    Number(debt.current_balance) + (planVDebts ?? []).reduce((sum, c) => sum + Number(c.current_balance), 0);
  const { label: dueLabel, daysUntil } = nextDueInfo(debt.due_day);
  const lastStatement = statements?.[0] ?? null;

  let healthMessage: { text: string; tone: "warning" | "positive" | "neutral" };
  if (debt.status === "mora") {
    healthMessage = { text: "Está en mora — el interés punitorio sigue corriendo sobre todo el saldo.", tone: "warning" };
  } else if (lastStatement && Number(lastStatement.amount_paid) < Number(lastStatement.total_due) - 0.5) {
    healthMessage = { text: "Pagaste menos del total del último resumen — el saldo va a seguir creciendo con interés.", tone: "warning" };
  } else if (lastStatement) {
    healthMessage = { text: "Pagaste el total del último resumen — no hay saldo financiado generando interés.", tone: "positive" };
  } else {
    healthMessage = { text: "Todavía no cargaste ningún resumen de esta tarjeta.", tone: "neutral" };
  }

  // --- Estimación de pago (solo si hay tasa y saldo real) — dos
  // montos fijos de comparación, siempre marcada como estimación
  // simplificada (ver comentario en simulateFixedPayoff). ---
  const minPayment = lastStatement?.minimum_payment != null ? Number(lastStatement.minimum_payment) : null;
  const payoffMin = minPayment != null && monthlyRate > 0 ? simulateFixedPayoff(cardBalance, monthlyRate, minPayment) : null;
  const payoffDouble =
    minPayment != null && monthlyRate > 0 ? simulateFixedPayoff(cardBalance, monthlyRate, minPayment * 2) : null;

  // --- Historial real de saldo, un punto por resumen cargado (no
  // se inventan meses intermedios que no se cargaron). ---
  const balanceHistory = [...(statements ?? [])]
    .slice(0, 6)
    .reverse()
    .map((s) => ({ period: s.period as string, totalDue: Number(s.total_due) }));
  const maxBalanceInHistory = Math.max(...balanceHistory.map((h) => h.totalDue), 1);

  // --- Actividad reciente real, derivada de cada resumen cargado. ---
  type ActivityItem = { period: string; label: string; amount: number; sign: 1 | -1; icon: typeof TrendingUpIcon };
  const activity: ActivityItem[] = [];
  for (const s of statements ?? []) {
    if (Number(s.interest_charged) > 0) {
      activity.push({ period: s.period, label: "Interés cargado", amount: Number(s.interest_charged), sign: 1, icon: TrendingUpIcon });
    }
    if (Number(s.new_charges) > 0) {
      activity.push({ period: s.period, label: "Consumos nuevos", amount: Number(s.new_charges), sign: 1, icon: ReceiptIcon });
    }
    if (Number(s.amount_paid) > 0) {
      activity.push({ period: s.period, label: "Pago realizado", amount: Number(s.amount_paid), sign: -1, icon: DownloadIcon });
    }
  }
  activity.sort((a, b) => b.period.localeCompare(a.period));
  const recentActivity = activity.slice(0, 6);

  return (
    <main style={{ maxWidth: 880, margin: "60px auto", padding: "0 24px 80px" }}>
      <p>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--on-surface-variant)" }}>
          ← Volver al dashboard
        </Link>
      </p>

      {/* --- Cabecera: ícono, nombre, saldo combinado --- */}
      <div className="paper-card" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, #004538 0%, #006b5f 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TypeIcon width={28} height={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>{debt.name}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--on-surface-variant)" }}>
              {DEBT_TYPE_LABELS[debt.debt_type] ?? debt.debt_type}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Saldo actual
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 24, color: "var(--primary)" }}>
            {formatCurrency(cardBalance)}
          </p>
        </div>
      </div>

      {/* --- Salud de deuda + estimación de pago --- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        <section className="hero-gradient" style={{ borderRadius: "var(--radius-lg)", padding: 24, color: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
              <HeartIcon width={18} height={18} />
              Salud de la deuda
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {debt.status === "mora" ? "En mora" : debt.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {debt.annual_interest_rate != null && (
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Tasa (TNA)</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{Number(debt.annual_interest_rate).toFixed(2)}%</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Próximo vencimiento</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                {dueLabel}
                {daysUntil !== null && daysUntil <= 7 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: "var(--error)", color: "var(--on-error)", borderRadius: 999, padding: "2px 8px" }}>
                    {daysUntil <= 0 ? "HOY" : `${daysUntil}d`}
                  </span>
                )}
              </span>
            </div>
            {minPayment != null && (
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Mínimo del último resumen</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{formatCurrency(minPayment)}</span>
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: "var(--radius)",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 13,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            {healthMessage.tone === "warning" && <AlertTriangleIcon width={15} height={15} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{healthMessage.text}</span>
          </div>
        </section>

        {payoffMin && payoffDouble && minPayment != null && (
          <section className="paper-card">
            <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <LightbulbIcon width={17} height={17} style={{ color: "var(--tertiary)" }} />
              Estimación de pago
            </h2>
            <p style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--on-surface-variant)" }}>
              Comparación simplificada — asume que pagás siempre el mismo monto fijo (no la fórmula
              real del banco, que baja con el saldo). Estimado, no una proyección exacta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>
                    Pagando {formatCurrency(minPayment)}/mes (mínimo)
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--on-surface-variant)" }}>
                    {payoffMin.months} meses para saldar
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--error)" }}>
                    {formatCurrency(payoffMin.totalInterest ?? 0)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--on-surface-variant)" }}>interés total</p>
                </div>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "var(--radius)", border: "1.5px solid var(--primary)", background: "rgba(0,107,88,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>
                    Pagando {formatCurrency(minPayment * 2)}/mes (el doble)
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--on-surface-variant)" }}>
                    {payoffDouble.months} meses para saldar
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>
                    ahorrás {formatCurrency(Math.max((payoffMin.totalInterest ?? 0) - (payoffDouble.totalInterest ?? 0), 0))}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--on-surface-variant)" }}>en interés</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {balanceHistory.length > 1 && (
          <section className="paper-card">
            <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <ChartIcon width={17} height={17} style={{ color: "var(--primary)" }} />
              Evolución del saldo
            </h2>
            <p style={{ margin: "4px 0 16px", fontSize: 12, color: "var(--on-surface-variant)" }}>
              Un punto por cada resumen que cargaste — no se completan meses que no cargaste.
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
              {balanceHistory.map((h, i) => {
                const isLast = i === balanceHistory.length - 1;
                const heightPct = Math.max((h.totalDue / maxBalanceInHistory) * 100, 4);
                return (
                  <div key={h.period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--on-surface-variant)" }}>
                      {formatCurrency(h.totalDue).replace(/\s/g, "")}
                    </p>
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                        background: isLast ? "var(--primary)" : "var(--surface-container-high)",
                      }}
                    />
                    <p style={{ margin: 0, fontSize: 11, fontWeight: isLast ? 700 : 500, color: isLast ? "var(--primary)" : "var(--on-surface-variant)", textTransform: "capitalize" }}>
                      {new Date(h.period).toLocaleDateString("es-AR", { month: "short" })}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="paper-card" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="#agregar-resumen" style={{ flex: "1 1 200px" }}>
            <button type="button" style={{ width: "100%", padding: "10px 18px" }}>
              + Agregar resumen del mes
            </button>
          </a>
          <Link href={`/dashboard/debts/${params.id}/charges`} style={{ flex: "1 1 200px" }}>
            <button type="button" style={{ width: "100%", padding: "10px 18px", background: "white" }}>
              Ver gastos
            </button>
          </Link>
        </section>

        {recentActivity.length > 0 && (
          <section className="paper-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
              <h2 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <HistoryIcon width={17} height={17} style={{ color: "var(--secondary)" }} />
                Actividad reciente
              </h2>
            </div>
            <div>
              {recentActivity.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: i < recentActivity.length - 1 ? "1px solid var(--border-soft)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: item.sign === -1 ? "var(--primary-container-pale)" : "var(--surface-container)",
                      color: item.sign === -1 ? "var(--on-primary-container)" : "var(--on-surface-variant)",
                    }}
                  >
                    <item.icon width={15} height={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--on-surface-variant)", textTransform: "capitalize" }}>
                      {new Date(item.period).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: item.sign === -1 ? "var(--primary)" : "var(--on-surface)" }}>
                    {item.sign === -1 ? "−" : "+"}
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <p style={{ color: "var(--ink-muted)", marginTop: 24 }}>
        Punto de equilibrio este mes: {formatCurrency(breakeven)}
        {monthlyRate > 0 && (
          <>
            {" "}(lo mínimo para que el
            saldo no siga creciendo)
          </>
        )}
      </p>
      <p>
        <Link
          href={`/dashboard/debts/${params.id}/schedule/upload`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <FileUpIcon width={13} height={13} />
          Subir resumen en PDF (auto-completa los datos)
        </Link>
        {" · "}
        <Link href={`/dashboard/debts/${params.id}/charges`}>Ver desglose de gastos</Link>
      </p>

      {searchParams.error && <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>}

      {/* --- Cuotas y refinanciación (antes "Plan V") --- */}
      <section style={{ marginTop: 32 }}>
        <h2>Cuotas y refinanciación</h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: -8 }}>
          Cada compra en cuotas o refinanciación es su propia deuda, ligada a esta tarjeta — así
          se amortiza sola con su propio plazo y tasa, sin que tengas que cargarla mes a mes.
          Refinanciación tiene tasa (TNA); una cuota fija del comercio, no.
        </p>

        {planVDebts && planVDebts.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, marginTop: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--board-seam)" }}>
                <th style={{ padding: "8px 4px" }}>Descripción</th>
                <th style={{ padding: "8px 4px" }}>Tipo</th>
                <th style={{ padding: "8px 4px" }}>Saldo</th>
                <th style={{ padding: "8px 4px" }}>Cuotas</th>
                <th style={{ padding: "8px 4px" }}></th>
              </tr>
            </thead>
            <tbody>
              {planVDebts.map((plan) => {
                const isRefinanciacion = Number(plan.annual_interest_rate) > 0;
                return (
                <tr key={plan.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                  <td style={{ padding: "8px 4px" }}>
                    {plan.name}
                    {!plan.is_active && <span style={{ color: "var(--ink-muted)", fontSize: 12 }}> (inactivo)</span>}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    <span
                      className="status-pill"
                      style={{
                        fontSize: 11,
                        padding: "3px 9px",
                        background: isRefinanciacion ? "var(--secondary-container)" : "var(--surface-container)",
                        color: isRefinanciacion ? "var(--on-secondary-container)" : "var(--on-surface-variant)",
                      }}
                    >
                      {isRefinanciacion ? `Refinanciación · ${Number(plan.annual_interest_rate).toFixed(2)}% TNA` : "Cuota sin interés"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(plan.current_balance))}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {/* installments_paid guarda cuotas YA pagadas (ver
                        Cuotas ya pagadas en DebtForm) — acá se muestra la
                        cuota actual (paid + 1) para que coincida con la
                        convención "N/M" que ya usó la pantalla de revisión
                        del resumen, no el conteo de pagadas. */}
                    {Math.min(plan.installments_paid + 1, plan.installments_total)} / {plan.installments_total}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    {plan.is_active && (
                      <form action={deactivatePlanVDebt}>
                        <input type="hidden" name="plan_debt_id" value={plan.id} />
                        <input type="hidden" name="card_debt_id" value={params.id} />
                        <button
                          type="submit"
                          style={{ background: "none", border: "none", color: "var(--led-red)", cursor: "pointer" }}
                        >
                          Dar de baja
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <details>
          <summary style={{ cursor: "pointer", color: "var(--led-green)", fontWeight: 600 }}>
            + Agregar compra en cuotas
          </summary>
          <form
            action={boundCreatePlan}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxWidth: 360 }}
          >
            <label>
              Descripción
              <input
                type="text"
                name="description"
                required
                placeholder="ej: Notebook 12 cuotas"
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Cantidad de cuotas
              <input
                type="number"
                name="total_installments"
                required
                min="1"
                max="60"
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Monto de cada cuota
              <input
                type="number"
                name="installment_amount"
                required
                step="0.01"
                min="0"
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              TNA (si la conocés)
              <input
                type="number"
                name="tna"
                step="0.01"
                min="0"
                style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
              Agregar compra
            </button>
          </form>
        </details>
      </section>

      {/* --- Agregar resumen mensual --- */}
      <section id="agregar-resumen" style={{ marginTop: 40, scrollMarginTop: 80 }}>
        <h2>Agregar resumen del mes</h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          El saldo anterior y el interés punitorio se calculan solos. Vos cargás los consumos
          nuevos (sin contar cuotas), el pago mínimo, y cuánto pagaste realmente.
        </p>

        <form
          action={boundCreateStatement}
          style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, marginTop: 12 }}
        >
          <label>
            Mes del resumen
            <input
              type="month"
              name="period"
              required
              defaultValue={thisPeriod}
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Consumos nuevos (sin contar cuotas)
            <input
              type="number"
              name="new_charges"
              step="0.01"
              min="0"
              defaultValue="0"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Pago mínimo (según el resumen)
            <input
              type="number"
              name="minimum_payment"
              step="0.01"
              min="0"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Cuánto pagaste realmente (0 si todavía no pagaste)
            <input
              type="number"
              name="amount_paid"
              step="0.01"
              min="0"
              defaultValue="0"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Tipo de pago
            <select name="payment_kind" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
              <option value="pago_variable">Pago variable (lo que pude pagar)</option>
              <option value="minimo_estimado">Mínimo + margen</option>
              <option value="unico">Pago único (cancela todo)</option>
            </select>
          </label>
          <label>
            Fecha de vencimiento
            <input
              type="date"
              name="due_date"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
            Agregar resumen
          </button>
        </form>
      </section>

      {/* --- Cronograma confirmado --- */}
      {scheduleEntries && scheduleEntries.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2>Cronograma de pagos</h2>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: -8 }}>
            Esto es lo que alimenta la proyección de flujo de caja. "Total" es lo que decía el
            resumen ese mes (saldo anterior + interés + consumos + cuotas); "Pagado" es lo que
            realmente pusiste — si no coinciden, la diferencia se arrastra como saldo al mes
            siguiente con su propio interés.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--board-seam)" }}>
                <th style={{ padding: "8px 4px" }}>Mes</th>
                <th style={{ padding: "8px 4px" }}>Total</th>
                <th style={{ padding: "8px 4px" }}>Pagado</th>
                <th style={{ padding: "8px 4px" }}>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {scheduleEntries.map((e) => {
                const statement = (statements ?? []).find((s) => s.period.slice(0, 7) === e.month.slice(0, 7));
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                    <td style={{ padding: "8px 4px" }}>{e.month.slice(0, 7)}</td>
                    <td style={{ padding: "8px 4px", color: "var(--ink-muted)" }}>
                      {statement ? formatCurrency(Number(statement.total_due)) : "—"}
                    </td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(e.amount))}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {KIND_LABELS[e.kind] ?? e.kind}
                      {e.is_estimate && <span style={{ color: "var(--cyan-estimate)", fontSize: 12 }}> (estimado)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* --- Detalle del resumen (interés / saldo arrastrado) --- */}
      {statements && statements.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <details>
            <summary style={{ cursor: "pointer", color: "var(--led-green)", fontWeight: 600 }}>
              Ver detalle de cómo se calculó cada resumen
            </summary>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--board-seam)" }}>
                  <th style={{ padding: "8px 4px" }}>Mes</th>
                  <th style={{ padding: "8px 4px" }}>Anterior</th>
                  <th style={{ padding: "8px 4px" }}>Interés</th>
                  <th style={{ padding: "8px 4px" }}>Consumos</th>
                  <th style={{ padding: "8px 4px" }}>Cuotas</th>
                  <th style={{ padding: "8px 4px" }}>Total</th>
                  <th style={{ padding: "8px 4px" }}>Pagado</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--board-seam)" }}>
                    <td style={{ padding: "8px 4px" }}>{s.period.slice(0, 7)}</td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(s.previous_balance))}</td>
                    <td style={{ padding: "8px 4px", color: Number(s.interest_charged) > 0 ? "var(--led-red)" : undefined }}>
                      {formatCurrency(Number(s.interest_charged))}
                    </td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(s.new_charges))}</td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(s.installments_charge))}</td>
                    <td style={{ padding: "8px 4px", fontWeight: 600 }}>{formatCurrency(Number(s.total_due))}</td>
                    <td style={{ padding: "8px 4px" }}>{formatCurrency(Number(s.amount_paid))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
    </main>
  );
}
