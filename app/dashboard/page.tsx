import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth-actions";
import { deleteDebt } from "./debts/actions";
import DeleteDebtButton from "./DeleteDebtButton";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import {
  AlertTriangleIcon,
  BankIcon,
  CarIcon,
  CheckIcon,
  CircleIcon,
  ClipboardIcon,
  CreditCardIcon,
  FileUpIcon,
  HandshakeIcon,
  HomeIcon,
  ReceiptIcon,
  RefreshIcon,
  TargetIcon,
  BellIcon,
  WalletIcon,
  XCircleIcon,
} from "@/lib/icons";
import Link from "next/link";

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Tarjeta de crédito",
  personal_loan: "Préstamo personal",
  plan_v: "Refinanciación / cuotas",
  mortgage: "Hipoteca",
  prendario: "Prendario",
  informal: "Deuda informal",
};

// Un ícono por tipo — prendario es literalmente el auto en garantía en
// Argentina, así que el ícono de auto no es decorativo, es exacto.
const DEBT_TYPE_ICON: Record<string, typeof CreditCardIcon> = {
  credit_card: CreditCardIcon,
  personal_loan: BankIcon,
  plan_v: ReceiptIcon,
  mortgage: HomeIcon,
  prendario: CarIcon,
  informal: HandshakeIcon,
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckIcon }> = {
  mora: { label: "En mora", color: "var(--on-error-container)", bg: "var(--error-container)", Icon: AlertTriangleIcon },
  al_dia: { label: "Al día", color: "var(--on-primary-container)", bg: "var(--primary-container-pale)", Icon: CheckIcon },
  refinanciado: { label: "Refinanciado", color: "var(--on-secondary-container)", bg: "var(--secondary-container)", Icon: RefreshIcon },
  regularizado: { label: "Regularizado", color: "var(--on-primary-container)", bg: "var(--primary-container-pale)", Icon: CheckIcon },
  cancelado: { label: "Cancelado", color: "var(--on-surface-variant)", bg: "var(--surface-container-high)", Icon: XCircleIcon },
};
const STATUS_ORDER = ["mora", "al_dia", "refinanciado", "regularizado", "cancelado"];

// Un solo color fijo para la placa del ícono — el color no distingue
// nada (no es por banco, no es por severidad, esa ya la lleva el chip
// de estado arriba), así que rotarlo por fila solo generaba una
// pregunta sin respuesta. El ícono en sí ya distingue el tipo.
const AVATAR_TINT = { bg: "var(--secondary-container)", color: "var(--on-secondary-container)" };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Próxima fecha de vencimiento a partir del due_day de la deuda —
// si el día ya pasó este mes, cae en el mes que viene. Devuelve
// también cuántos días faltan, para poder alertar si es inminente.
function nextDueInfo(dueDay: number | null): { label: string; daysUntil: number | null } {
  if (!dueDay) return { label: "—", daysUntil: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (due < today) due.setMonth(due.getMonth() + 1);

  const daysUntil = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

  return { label, daysUntil };
}

// % ya pagado — dato real (original vs saldo actual), no una racha
// inventada. Se recorta a [0, 100] porque un ajuste de tasa puede
// hacer que el saldo actual supere al original.
function paidOffPercent(originalAmount: number, currentBalance: number): number {
  if (!originalAmount || originalAmount <= 0) return 0;
  const pct = ((originalAmount - currentBalance) / originalAmount) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scenario = user ? await getActiveScenario(supabase, user.id) : null;

  const [{ data: debts }, { count: incomeCount }, { count: expenseCount }] = await Promise.all([
    scenario
      ? supabase
          .from("debts")
          .select("*")
          .eq("is_active", true)
          .or(scenarioFilter(scenario))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase.from("income_sources").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  // El saldo total suma TODO (tarjetas + sus compras en cuotas
  // hijas), pero la tabla solo muestra las deudas de primer nivel —
  // las hijas (parent_debt_id set) se agrupan visualmente bajo su
  // tarjeta madre en vez de aparecer como filas sueltas.
  const totalBalance = (debts ?? []).reduce((sum, d) => sum + Number(d.current_balance), 0);
  const topLevelDebts = (debts ?? []).filter((d) => !d.parent_debt_id);
  const childDebtsByParent = new Map<string, typeof topLevelDebts>();
  for (const d of debts ?? []) {
    if (!d.parent_debt_id) continue;
    if (!childDebtsByParent.has(d.parent_debt_id)) childDebtsByParent.set(d.parent_debt_id, []);
    childDebtsByParent.get(d.parent_debt_id)!.push(d);
  }

  // Agrupadas por estado, no por entidad — lo que importa es la
  // urgencia, no el banco (spec §2.1).
  const groupedByStatus = STATUS_ORDER.map((status) => ({
    status,
    debts: topLevelDebts.filter((d) => (d.status ?? "al_dia") === status),
  })).filter((g) => g.debts.length > 0);

  const moraCount = groupedByStatus.find((g) => g.status === "mora")?.debts.length ?? 0;
  const alDiaCount = groupedByStatus.find((g) => g.status === "al_dia")?.debts.length ?? 0;
  const dueSoon = (debts ?? [])
    .map((d) => ({ debt: d, ...nextDueInfo(d.due_day) }))
    .filter((d) => d.daysUntil !== null && d.daysUntil <= 7);

  return (
    <main style={{ maxWidth: 880, margin: "56px auto", padding: "0 24px 80px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Dashboard</h1>
        <form action={logout}>
          <button type="submit" style={{ background: "white", padding: "8px 16px" }}>
            Cerrar sesión
          </button>
        </form>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <p style={{ color: "var(--on-surface-variant)", margin: 0, fontSize: 14 }}>{user?.email}</p>
        {scenario && (
          <Link
            href="/dashboard/scenarios"
            style={{
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--secondary-container)",
              color: "var(--on-secondary-container)",
              borderRadius: 999,
              padding: "6px 14px",
            }}
          >
            <ClipboardIcon width={14} height={14} />
            Viendo: <strong>{scenario.name}</strong> — cambiar escenario
          </Link>
        )}
      </div>

      {searchParams.error && (
        <p
          style={{
            background: "var(--error-container)",
            color: "var(--on-error-container)",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 14,
            marginTop: 12,
            fontWeight: 600,
          }}
        >
          {searchParams.error}
        </p>
      )}

      {/* --- Hero: saldo total --- */}
      {debts && debts.length > 0 && (
        <section
          className="hero-gradient"
          style={{
            marginTop: 24,
            padding: "24px",
            borderRadius: 12,
            color: "#ffffff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Saldo total de deuda
          </p>
          <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff" }}>
            {formatCurrency(totalBalance)}
          </p>

          <div
            style={{
              marginTop: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            {moraCount > 0 ? (
              <>
                <AlertTriangleIcon width={15} height={15} />
                {moraCount} {moraCount === 1 ? "deuda en mora" : "deudas en mora"}
                {dueSoon.length > 0 && ` · ${dueSoon.length} vencimiento${dueSoon.length > 1 ? "s" : ""} esta semana`}
              </>
            ) : dueSoon.length > 0 ? (
              <>
                <AlertTriangleIcon width={15} height={15} />
                {dueSoon.length} vencimiento{dueSoon.length > 1 ? "s" : ""} esta semana
              </>
            ) : (
              <>
                <CheckIcon width={15} height={15} />
                Todas tus deudas están al día
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Deudas activas</p>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "#ffffff" }}>{topLevelDebts.length}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Al día</p>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, color: "#ffffff" }}>{alDiaCount}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <Link href="/dashboard/debts/new">
              <button type="button" style={{ padding: "10px 18px" }}>
                + Agregar deuda
              </button>
            </Link>
            <Link href="/dashboard/expenses/new">
              <button type="button" style={{ padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <WalletIcon width={14} height={14} />
                Agregar gasto
              </button>
            </Link>
            <Link href="/dashboard/debts/new/upload">
              <button
                type="button"
                style={{
                  padding: "10px 18px",
                  background: "transparent",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.5)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <FileUpIcon width={14} height={14} />
                Agregar resumen
              </button>
            </Link>
          </div>
        </section>
      )}

      {(() => {
        const hasDebts = (debts?.length ?? 0) > 0;
        const hasIncome = (incomeCount ?? 0) > 0;
        const hasExpenses = (expenseCount ?? 0) > 0;

        if (hasDebts && hasIncome && hasExpenses) return null; // ya está todo cargado

        const steps = [
          {
            done: hasDebts,
            label: "Agregá tu primera deuda",
            hint: "Tarjeta, préstamo, lo que sea — podés subir el PDF del resumen o agregarla a mano.",
            href: "/dashboard/debts/new/upload",
            cta: "Subir resumen",
          },
          {
            done: hasIncome,
            label: "Agregá tu sueldo",
            hint: "Así el sistema puede calcular cuánto te queda disponible cada mes.",
            href: "/dashboard/cashflow/income/new",
            cta: "Agregar ingreso",
          },
          {
            done: hasExpenses,
            label: "Agregá tus gastos fijos",
            hint: "Alquiler, servicios, lo que pagás todos los meses sí o sí.",
            href: "/dashboard/expenses/new",
            cta: "Agregar gasto",
          },
        ];

        return (
          <section className="paper-card" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18 }}>Empecemos</h2>
            <p style={{ color: "var(--on-surface-variant)", marginTop: -4, fontSize: 14 }}>
              Tres pasos y ya vas a poder ver tu plan completo.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 4px",
                    borderBottom: i < steps.length - 1 ? "1px solid var(--border-soft)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {step.done ? (
                      <CheckIcon width={18} height={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <CircleIcon width={18} height={18} style={{ color: "var(--outline)", flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: step.done ? "var(--on-surface-variant)" : "var(--on-surface)" }}>
                        {step.label}
                      </p>
                      {!step.done && (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--on-surface-variant)" }}>{step.hint}</p>
                      )}
                    </div>
                  </div>

                  {!step.done && (
                    <Link href={step.href} style={{ flexShrink: 0 }}>
                      <button type="button" style={{ padding: "7px 14px", fontSize: 13 }}>
                        {step.cta}
                      </button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <hr className="ticket-divider" />

      <section style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2>Tus deudas</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* El saldo total (con sus botones de cargar deuda) solo
                aparece si ya hay al menos una deuda cargada — sin eso,
                esta es la única entrada manual disponible. */}
            {(!debts || debts.length === 0) && (
              <Link href="/dashboard/debts/new">
                <button type="button" style={{ padding: "9px 16px" }}>
                  + Agregar deuda
                </button>
              </Link>
            )}
            <NavButton href="/dashboard/cashflow" Icon={WalletIcon} label="Con qué te enfrentás" />
            <NavButton href="/dashboard/payoff-plan" Icon={TargetIcon} label="Plan destructor" />
            <NavButton href="/dashboard/alerts" Icon={BellIcon} label="Alertas" />
          </div>
        </div>

        {debts && debts.length > 0 && (
          <>
            {groupedByStatus.map((group) => {
              const meta = STATUS_META[group.status] ?? STATUS_META.al_dia;
              return (
                <div key={group.status} style={{ marginBottom: 28 }}>
                  <div
                    className="status-pill"
                    style={{ color: meta.color, background: meta.bg, marginBottom: 12, marginTop: 20 }}
                  >
                    <meta.Icon width={14} height={14} />
                    {meta.label} ({group.debts.length})
                  </div>
                  <div>
                    {group.debts.map((debt) => {
                      const { label, daysUntil } = nextDueInfo(debt.due_day);
                      const isDueSoon = daysUntil !== null && daysUntil <= 7;
                      const children = childDebtsByParent.get(debt.id) ?? [];
                      const TypeIcon = DEBT_TYPE_ICON[debt.debt_type] ?? CreditCardIcon;
                      // La tarjeta muestra un TODO: saldo propio + todas sus
                      // compras Plan V hijas, no solo el saldo revolving —
                      // el desglose por compra queda para el detalle de la
                      // tarjeta (Cronograma), no para este número grande.
                      const cardBalance =
                        Number(debt.current_balance) + children.reduce((sum, c) => sum + Number(c.current_balance), 0);
                      const cardOriginal =
                        Number(debt.original_amount) + children.reduce((sum, c) => sum + Number(c.original_amount), 0);
                      const pct = paidOffPercent(cardOriginal, cardBalance);

                      return (
                        <div
                          key={debt.id}
                          className="paper-card"
                          style={{ marginBottom: 10, padding: "16px 18px" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: "50%",
                                  background: AVATAR_TINT.bg,
                                  color: AVATAR_TINT.color,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <TypeIcon width={18} height={18} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {debt.name}
                                </p>
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginTop: 3,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--on-secondary-container)",
                                    background: "var(--secondary-container)",
                                    borderRadius: 999,
                                    padding: "2px 9px",
                                  }}
                                >
                                  {DEBT_TYPE_LABELS[debt.debt_type] ?? debt.debt_type}
                                  {debt.debt_type !== "credit_card" && debt.rate_type === "variable" && " · variable"}
                                  {debt.debt_type !== "credit_card" && debt.rate_type === "uva" && " · UVA"}
                                </span>
                                {children.length > 0 && (
                                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--on-surface-variant)" }}>
                                    incluye {children.length} compra{children.length > 1 ? "s" : ""} en cuotas:{" "}
                                    {formatCurrency(children.reduce((sum, c) => sum + Number(c.current_balance), 0))}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16 }}>
                                {formatCurrency(cardBalance)}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: isDueSoon ? "var(--on-error-container)" : "var(--on-surface-variant)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "flex-end",
                                  gap: 6,
                                }}
                              >
                                vto. {label}
                                {isDueSoon && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: "var(--error)",
                                      color: "var(--on-error)",
                                      borderRadius: 999,
                                      padding: "2px 8px",
                                    }}
                                  >
                                    {daysUntil === 0 ? "HOY" : `${daysUntil}d`}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {cardOriginal > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--on-surface-variant)", textAlign: "right" }}>
                                {pct}% pagado
                              </p>
                            </div>
                          )}

                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: "1px solid var(--border-soft)",
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                              fontSize: 13,
                              flexWrap: "wrap",
                            }}
                          >
                            {debt.debt_type === "credit_card" && (
                              <>
                                <Link href={`/dashboard/debts/${debt.id}/schedule`} className="action-pill">Cronograma</Link>
                                <Link href={`/dashboard/debts/${debt.id}/charges`} className="action-pill">Gastos</Link>
                              </>
                            )}
                            <Link href={`/dashboard/debts/${debt.id}/payments`} className="action-pill">Pagos</Link>
                            <Link href={`/dashboard/debts/${debt.id}/edit`} className="action-pill">Editar</Link>
                            <form action={deleteDebt} style={{ display: "inline" }}>
                              <input type="hidden" name="debt_id" value={debt.id} />
                              <DeleteDebtButton childCount={children.length} />
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {debts && debts.length > 0 && (
        <p style={{ marginTop: 24, color: "var(--on-surface-variant)", fontSize: 14 }}>
          Para ver ingresos, gastos fijos y el neto disponible mes a mes, andá a{" "}
          <Link href="/dashboard/cashflow">Con qué te enfrentás</Link>.
        </p>
      )}
    </main>
  );
}

function NavButton({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: typeof CheckIcon;
  label: string;
}) {
  return (
    <Link href={href}>
      <button
        type="button"
        style={{
          padding: "9px 16px",
          background: "white",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Icon width={14} height={14} />
        {label}
      </button>
    </Link>
  );
}
