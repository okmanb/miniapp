import { createClient } from "@/lib/supabase/server";
import { deleteIncome, deleteExpense } from "./actions";
import { updateStartingBalance } from "../scenarios/actions";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import { projectPersonalCashFlow, type DebtForCashFlow } from "@/lib/debt-engine/personal-cashflow";
import { projectDebtSchedule, type DebtScheduleEntry } from "@/lib/debt-engine/schedule";
import { currentPeriodString } from "@/lib/card-statements";
import CashFlowChart from "./CashFlowChart";
import HealthRibbon from "./HealthRibbon";
import MonthTabs from "./MonthTabs";
import { BankIcon, BridgeIcon, CarIcon, CreditCardIcon, HandshakeIcon, HomeIcon, ReceiptIcon, WalletIcon } from "@/lib/icons";
import Link from "next/link";

const DEBT_TYPE_ICON: Record<string, typeof CreditCardIcon> = {
  credit_card: CreditCardIcon,
  personal_loan: BankIcon,
  plan_v: ReceiptIcon,
  mortgage: HomeIcon,
  prendario: CarIcon,
  informal: HandshakeIcon,
};

// Un solo color fijo para la placa del ícono — no distingue nada por
// sí mismo (no es por banco), el ícono ya distingue el tipo de deuda.
const AVATAR_TINT = { bg: "var(--secondary-container)", color: "var(--on-secondary-container)" };

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Tarjeta de crédito",
  personal_loan: "Préstamo personal",
  plan_v: "Refinanciación / cuotas",
  mortgage: "Hipoteca",
  prendario: "Prendario",
  informal: "Deuda informal",
};

const INCOME_KIND_LABELS: Record<string, string> = {
  sueldo: "Sueldo",
  adelanto: "Adelanto",
  bono: "Bono",
  aguinaldo: "Aguinaldo",
  changa: "Changa",
  otro: "Otro",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default async function CashflowPage({
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
  const filter = scenarioFilter(scenario);

  const [{ data: debts }, { data: incomes }, { data: expenses }, { data: bridgeLoans }] = await Promise.all([
    supabase.from("debts").select("*").eq("is_active", true).gt("current_balance", 0).or(filter),
    supabase.from("incomes").select("*").or(filter).order("month"),
    supabase.from("fixed_expenses").select("*").or(filter).order("month"),
    supabase.from("bridge_loans").select("*").eq("scenario_id", scenario.id),
  ]);

  const debtIds = (debts ?? []).map((d) => d.id);
  const { data: allScheduleEntries } =
    debtIds.length > 0
      ? await supabase.from("debt_schedule_entries").select("*").in("debt_id", debtIds)
      : { data: [] as DebtScheduleEntry[] };

  const scheduleEntriesByDebt = new Map<string, DebtScheduleEntry[]>();
  for (const entry of allScheduleEntries ?? []) {
    const list = scheduleEntriesByDebt.get(entry.debt_id) ?? [];
    list.push(entry as DebtScheduleEntry);
    scheduleEntriesByDebt.set(entry.debt_id, list);
  }

  // Gastos sueltos que ya cargaste este mes desde "Gastos por
  // tarjeta" (nafta, super, lo que sea) — sin esto el saldo
  // proyectado asumía que dejabas de gastar apenas cargabas el
  // primer resumen. Solo cuentan los del mes calendario en curso: los
  // de meses ya cerrados con un resumen real quedan reflejados en el
  // total_due de ese resumen, no acá (ver el "existing ? 0 : newSpend"
  // en projectDebtSchedule).
  const currentPeriod = `${currentPeriodString()}-01`;
  const { data: currentMonthCharges } =
    debtIds.length > 0
      ? await supabase.from("card_statement_charges").select("debt_id, description, amount").in("debt_id", debtIds).eq("period", currentPeriod)
      : { data: [] as { debt_id: string; description: string; amount: number }[] };

  const newSpendByDebt = new Map<string, number>();
  const pendingChargesByDebt = new Map<string, { description: string; amount: number }[]>();
  for (const c of currentMonthCharges ?? []) {
    newSpendByDebt.set(c.debt_id, (newSpendByDebt.get(c.debt_id) ?? 0) + Number(c.amount));
    const list = pendingChargesByDebt.get(c.debt_id) ?? [];
    list.push({ description: c.description, amount: Number(c.amount) });
    pendingChargesByDebt.set(c.debt_id, list);
  }

  // El saldo que NO pagaste del último resumen real cerrado (pagaste
  // el mínimo, no el total) también sigue creciendo con interés en
  // el ciclo en curso — igual de real que un gasto nuevo, pero es
  // deuda que ya existía, no un consumo fresco, así que se muestra
  // aparte para no confundir los dos.
  const { data: latestStatements } =
    debtIds.length > 0
      ? await supabase
          .from("card_statements")
          .select("debt_id, period, total_due, amount_paid")
          .in("debt_id", debtIds)
          .order("period", { ascending: false })
      : { data: [] as { debt_id: string; period: string; total_due: number; amount_paid: number }[] };

  const carriedUnpaidByDebt = new Map<string, { unpaid: number; totalDue: number; paid: number; period: string }>();
  for (const s of latestStatements ?? []) {
    if (carriedUnpaidByDebt.has(s.debt_id)) continue; // ya vimos el más reciente de este debt (ordenado desc)
    const unpaid = Number(s.total_due) - Number(s.amount_paid);
    if (unpaid > 0) {
      carriedUnpaidByDebt.set(s.debt_id, { unpaid, totalDue: Number(s.total_due), paid: Number(s.amount_paid), period: s.period.slice(0, 7) });
    }
  }

  const months = 6;
  const debtsForCashFlow: DebtForCashFlow[] = (debts ?? []).map((d) => ({
    id: d.id,
    current_balance: Number(d.current_balance),
    annual_interest_rate: d.annual_interest_rate,
    tem: d.tem,
    installments_total: d.installments_total,
    installments_paid: d.installments_paid,
    estimatedNewSpendPerMonth: newSpendByDebt.get(d.id),
  }));

  const cashFlow = projectPersonalCashFlow({
    incomes: (incomes ?? []).map((i) => ({ name: i.name, kind: i.kind, month: i.month, amount: Number(i.amount), is_recurring: i.is_recurring })),
    expenses: (expenses ?? []).map((e) => ({ name: e.name, month: e.month, amount: Number(e.amount), is_recurring: e.is_recurring })),
    debts: debtsForCashFlow,
    scheduleEntriesByDebt,
    bridgeLoans: (bridgeLoans ?? []).map((b) => ({
      amount: Number(b.amount),
      received_month: b.received_month,
      repay_month: b.repay_month,
    })),
    months,
    startingBalance: Number(scenario.starting_cash_balance),
  });

  const upcomingMonths = cashFlow.map((m) => m.month);

  // El primer mes de la ventana que todavía no tiene una entry real
  // cargada — el resumen que está en curso, todavía sin cerrar. El
  // saldo que arrastrás por haber pagado solo el mínimo del último
  // resumen YA ESTÁ creciendo con interés en este mes (es deuda que
  // ya existía), así que ese ítem va acá. Un gasto nuevo cargado a
  // mano, en cambio, entra en este mismo resumen pero se factura
  // recién en el que cierra DESPUÉS de este — un mes más adelante
  // (ver pendingChargeMonthIndex, y el mismo criterio en
  // projectDebtSchedule).
  function firstOpenMonthIndex(debtId: string): number {
    const closedMonths = new Set((scheduleEntriesByDebt.get(debtId) ?? []).map((e) => e.month.slice(0, 7)));
    for (let i = 0; i < upcomingMonths.length; i++) {
      if (!closedMonths.has(upcomingMonths[i])) return i;
    }
    return upcomingMonths.length - 1;
  }
  function pendingChargeMonthIndex(debtId: string): number {
    return Math.min(firstOpenMonthIndex(debtId) + 1, upcomingMonths.length - 1);
  }

  const debtBreakdown = debtsForCashFlow.map((debt) => {
    const projection = projectDebtSchedule({
      debt,
      entries: scheduleEntriesByDebt.get(debt.id) ?? [],
      months,
      estimatedNewSpendPerMonth: debt.estimatedNewSpendPerMonth,
    });
    const monthlyAmounts: Record<string, number> = {};
    const monthlyEndingBalance: Record<string, number> = {};
    for (const p of projection) {
      monthlyAmounts[p.month] = p.amount;
      monthlyEndingBalance[p.month] = p.endingBalance;
    }
    const original = (debts ?? []).find((d) => d.id === debt.id)!;
    return { debt: original, monthlyAmounts, monthlyEndingBalance };
  });

  // Agrupadas por tarjeta madre — igual que en el dashboard, para no
  // mostrar cada cuota/refinanciación como si fuera una deuda suelta
  // sin relación con la tarjeta que la originó.
  const topLevelBreakdown = debtBreakdown.filter((b) => !b.debt.parent_debt_id);
  const childBreakdownByParent = new Map<string, typeof debtBreakdown>();
  for (const b of debtBreakdown) {
    if (!b.debt.parent_debt_id) continue;
    if (!childBreakdownByParent.has(b.debt.parent_debt_id)) childBreakdownByParent.set(b.debt.parent_debt_id, []);
    childBreakdownByParent.get(b.debt.parent_debt_id)!.push(b);
  }

  // Un mes sin monto puede significar dos cosas bien distintas — hay
  // que decir cuál, no dejar un "—" ambiguo:
  // - la deuda tiene plazo conocido (cuota fija) y ya se terminó de
  //   pagar dentro de esta misma ventana proyectada ("Ya pagada");
  // - es una tarjeta (sin plazo fijo) y todavía no se cargó el
  //   resumen de ese mes, porque ni existe ("Sin resumen cargado").
  function monthStatus(debt: { installments_total: number | null; installments_paid: number }, amount: number | undefined, monthIndex: number) {
    if (amount) return { kind: "amount" as const, value: amount };
    const remaining = debt.installments_total != null ? Math.max(debt.installments_total - debt.installments_paid, 0) : null;
    if (remaining != null && monthIndex >= remaining) return { kind: "paid_off" as const };
    return { kind: "no_data" as const };
  }

  function statusLabel(status: ReturnType<typeof monthStatus>): { text: string; color: string } {
    if (status.kind === "amount") return { text: formatCurrency(status.value), color: "var(--on-surface)" };
    if (status.kind === "paid_off") return { text: "Ya pagada", color: "var(--on-primary-container)" };
    return { text: "Sin resumen", color: "var(--on-surface-variant)" };
  }

  const totalMonthlyIncome = cashFlow[0]?.income ?? 0;
  const totalMonthlyExpenses = cashFlow[0]?.fixedExpenses ?? 0;

  return (
    <main style={{ maxWidth: 880, margin: "56px auto", padding: "0 24px 80px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Con qué te enfrentás cada mes
      </h1>
      <p style={{ color: "var(--on-surface-variant)" }}>
        Ingresos menos gastos fijos menos cuotas de deuda = lo que te queda disponible. Escenario:{" "}
        <Link href="/dashboard/scenarios">{scenario.name}</Link>.
      </p>

      {searchParams.error && (
        <p style={{ background: "var(--error-container)", color: "var(--on-error-container)", padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 600 }}>
          {searchParams.error}
        </p>
      )}

      {/* --- Acciones principales, arriba de todo --- */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <Link href="/dashboard/cashflow/income/new">
          <button type="button" style={{ padding: "10px 18px" }}>
            + Agregar ingreso
          </button>
        </Link>
        <Link href="/dashboard/expenses/new">
          <button type="button" style={{ padding: "10px 18px", background: "white" }}>
            + Agregar gasto
          </button>
        </Link>
        <Link href="/dashboard/debts/new">
          <button type="button" style={{ padding: "10px 18px", background: "white" }}>
            + Agregar deuda
          </button>
        </Link>
        <Link href="/dashboard/bridge-loans">
          <button
            type="button"
            style={{
              padding: "10px 18px",
              background: "white",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <BridgeIcon width={14} height={14} />
            Préstamos puente
          </button>
        </Link>
      </div>

      {/* --- Saldo real de partida --- */}
      <section className="paper-card" style={{ marginTop: 24, padding: "16px 20px" }}>
        <form
          action={updateStartingBalance}
          style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}
        >
          <input type="hidden" name="scenario_id" value={scenario.id} />
          <label style={{ fontSize: 13 }}>
            Saldo real hoy (cuenta + efectivo)
            <input
              type="number"
              name="starting_cash_balance"
              step="0.01"
              defaultValue={scenario.starting_cash_balance}
              style={{ display: "block", width: 200, padding: 10, marginTop: 4 }}
            />
          </label>
          <button type="submit" style={{ padding: "10px 16px" }}>
            Guardar
          </button>
        </form>
      </section>

      {/* --- Ribbon de salud financiera --- */}
      {cashFlow.length > 0 && (incomes?.length ?? 0) > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18 }}>¿En qué mes me quedo sin plata?</h2>
          <HealthRibbon months={cashFlow} />
        </section>
      )}

      {/* --- Proyección combinada --- */}
      {cashFlow.length > 0 && (incomes?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <p style={{ marginBottom: 20 }}>
            <span
              className={`stamp-total ${cashFlow[0].netAvailable >= 0 ? "stamp-total--positive" : "stamp-total--negative"}`}
              style={{ fontSize: 16 }}
            >
              ESTE MES TE {cashFlow[0].netAvailable >= 0 ? "SOBRAN" : "FALTAN"}:{" "}
              {formatCurrency(Math.abs(cashFlow[0].netAvailable))}
            </span>
          </p>
          <CashFlowChart data={cashFlow} />
          <p style={{ fontSize: 12, color: "var(--on-surface-variant)", marginTop: 4 }}>
            Verde = te sobra, rojo = te falta. • = mes con aguinaldo cargado.
          </p>

          <div style={{ marginTop: 20 }}>
            <MonthTabs
              months={upcomingMonths}
              bonusMonths={cashFlow.filter((m) => m.isBonusMonth).map((m) => m.month)}
            >
              {cashFlow.map((m) => {
                const rows: { label: string; value: number; signed: boolean; emphasize?: boolean }[] = [
                  { label: "Ingresos", value: m.income, signed: false },
                  { label: "Gastos fijos", value: m.fixedExpenses, signed: false },
                  { label: "Deudas", value: m.debtPayments, signed: false },
                  ...((bridgeLoans?.length ?? 0) > 0
                    ? [{ label: "Préstamos puente", value: m.bridgeLoanNet, signed: true }]
                    : []),
                  { label: "Neto disponible", value: m.netAvailable, signed: true, emphasize: true },
                ];
                return (
                  <div key={m.month}>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--on-surface-variant)", textTransform: "capitalize" }}>
                      {formatMonthLabel(m.month)}
                      {m.isBonusMonth && (
                        <span style={{ marginLeft: 6, color: "var(--on-primary-container)", fontWeight: 700 }}>
                          + aguinaldo
                        </span>
                      )}
                    </p>
                    {rows.map((row) => (
                      <div
                        key={row.label}
                        className="paper-card"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                          padding: "13px 16px",
                          background: row.emphasize ? "var(--surface-container-low)" : undefined,
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: row.emphasize ? 700 : 600, fontSize: 14 }}>{row.label}</p>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            fontSize: 15,
                            color: row.signed ? (row.value >= 0 ? "var(--on-primary-container)" : "var(--on-error-container)") : "var(--on-surface)",
                          }}
                        >
                          {row.signed && row.value === 0 ? "—" : formatCurrency(row.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </MonthTabs>
          </div>
        </section>
      )}

      {(incomes?.length ?? 0) === 0 && (
        <p style={{ color: "var(--on-surface-variant)", marginTop: 24 }}>Agregá al menos un ingreso para ver la proyección.</p>
      )}

      <hr className="ticket-divider" />

      {/* --- Deudas: desglose mes a mes, no solo el total --- */}
      <section style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Con qué te enfrentás por deuda, mes a mes</h2>
          <Link href="/dashboard" style={{ fontSize: 14 }}>
            Gestionar deudas →
          </Link>
        </div>
        <p style={{ color: "var(--on-surface-variant)", fontSize: 14 }}>
          Esto es lo que vas a tener que pagar cada mes por cada una — no confundir con el "saldo
          proyectado" chico debajo de cada monto (todo lo que va a quedar debiéndose de esa deuda
          para ese mes, no lo que hay que pagar ese mes puntual; incluye interés y los gastos
          sueltos que vayas cargando en "Gastos por tarjeta"). "Ya pagada" significa que esa
          cuota puntual termina antes de este mes; "Sin resumen" significa que es una tarjeta y
          todavía no cargaste el resumen de ese mes.
        </p>

        {(!debts || debts.length === 0) && (
          <p style={{ color: "var(--on-surface-variant)" }}>Todavía no tenés deudas activas.</p>
        )}

        {debts && debts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <MonthTabs months={upcomingMonths}>
              {upcomingMonths.map((month, monthIndex) => {
                const monthTotal = debtBreakdown.reduce((sum, { monthlyAmounts }) => sum + (monthlyAmounts[month] ?? 0), 0);
                return (
                  <div key={month}>
                    {topLevelBreakdown.map(({ debt, monthlyAmounts, monthlyEndingBalance }) => {
                      const children = childBreakdownByParent.get(debt.id) ?? [];
                      const status = statusLabel(monthStatus(debt, monthlyAmounts[month], monthIndex));
                      const TypeIcon = DEBT_TYPE_ICON[debt.debt_type] ?? CreditCardIcon;
                      const projectedBalance = monthlyEndingBalance[month] ?? Number(debt.current_balance);

                      return (
                        <div key={debt.id} className="paper-card" style={{ marginBottom: 8, padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  background: AVATAR_TINT.bg,
                                  color: AVATAR_TINT.color,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <TypeIcon width={17} height={17} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {debt.name}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--on-surface-variant)" }}>
                                  {DEBT_TYPE_LABELS[debt.debt_type] ?? debt.debt_type}
                                </p>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, color: status.color }}>
                                {status.text}
                              </p>
                              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--on-surface-variant)" }}>
                                {monthIndex === 0 ? "saldo hoy" : "saldo proyectado"} {formatCurrency(projectedBalance)}
                              </p>
                            </div>
                          </div>

                          {(() => {
                            // Proyectada, no la cuota actual fija: para el
                            // tab de un mes futuro hay que sumarle los
                            // meses que ya pasaron (monthIndex) — sin esto
                            // el número quedaba clavado en el mismo valor
                            // en los 6 tabs. Y si para ese mes ya se
                            // habrían terminado sus cuotas, la fila
                            // directamente no se muestra (no tiene sentido
                            // seguir listando algo que ya no existe ese mes).
                            const visibleChildren = children.filter(({ debt: child }) => {
                              if (child.installments_total == null) return true;
                              const remaining = Math.max(child.installments_total - child.installments_paid, 0);
                              return monthIndex < remaining;
                            });
                            // El enfoque de esta sección es "a qué te vas a
                            // enfrentar" a mes vencido: el mes en curso ya lo
                            // resolviste (pagaste el resumen anterior), así
                            // que tanto el saldo que quedó sin pagar de ese
                            // resumen como los gastos sueltos que vayas
                            // cargando caen juntos en el mismo mes — el
                            // próximo que todavía no cerró. Ninguno de los
                            // dos se repite en los meses siguientes, ya
                            // quedan absorbidos en el saldo proyectado.
                            const pendingCharges = monthIndex === pendingChargeMonthIndex(debt.id) ? pendingChargesByDebt.get(debt.id) ?? [] : [];
                            const carriedUnpaid = monthIndex === pendingChargeMonthIndex(debt.id) ? carriedUnpaidByDebt.get(debt.id) : undefined;
                            if (visibleChildren.length === 0 && pendingCharges.length === 0 && !carriedUnpaid) return null;
                            return (
                            <div
                              style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: "1px solid var(--border-soft)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              {visibleChildren.map(({ debt: child, monthlyAmounts: childAmounts, monthlyEndingBalance: childEndingBalance }) => {
                                const childStatus = statusLabel(monthStatus(child, childAmounts[month], monthIndex));
                                const childProjectedBalance = childEndingBalance[month] ?? Number(child.current_balance);
                                const cuotaProgress =
                                  child.installments_total != null
                                    ? `cuota ${Math.min(child.installments_paid + monthIndex + 1, child.installments_total)}/${child.installments_total}`
                                    : null;
                                return (
                                  <div key={child.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 16, gap: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {child.name}
                                      </p>
                                      <p style={{ margin: 0, fontSize: 11, color: "var(--on-surface-variant)" }}>
                                        {[cuotaProgress, Number(child.annual_interest_rate) > 0 ? `${Number(child.annual_interest_rate).toFixed(2)}% TNA` : null]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    </div>
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, color: childStatus.color }}>
                                        {childStatus.text}
                                      </p>
                                      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--on-surface-variant)" }}>
                                        {monthIndex === 0 ? "saldo hoy" : "saldo proyectado"} {formatCurrency(childProjectedBalance)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                              {carriedUnpaid ? (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 16, gap: 10 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--tertiary)" }}>
                                      Saldo sin pagar del resumen anterior
                                    </p>
                                    <p style={{ margin: 0, fontSize: 11, color: "var(--on-surface-variant)" }}>
                                      resumen {formatCurrency(carriedUnpaid.totalDue)} · pagaste {formatCurrency(carriedUnpaid.paid)} — se traslada con interés
                                    </p>
                                  </div>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 600,
                                      fontSize: 13,
                                      color: "var(--on-tertiary-container)",
                                      background: "var(--tertiary-container-pale)",
                                      borderRadius: "var(--radius-sm)",
                                      padding: "4px 10px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {formatCurrency(carriedUnpaid.unpaid)}
                                  </span>
                                </div>
                              ) : null}
                              {pendingCharges.map((charge, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 16, gap: 10 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--tertiary)" }}>
                                      {charge.description}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 11, color: "var(--on-surface-variant)" }}>
                                      pendiente — se liquida en el próximo resumen
                                    </p>
                                  </div>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 600,
                                      fontSize: 13,
                                      color: "var(--on-tertiary-container)",
                                      background: "var(--tertiary-container-pale)",
                                      borderRadius: "var(--radius-sm)",
                                      padding: "4px 10px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {formatCurrency(charge.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    <div
                      className="paper-card"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "13px 16px",
                        background: "var(--surface-container-low)",
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 700 }}>Total este mes</p>
                      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15 }}>
                        {monthTotal ? formatCurrency(monthTotal) : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </MonthTabs>
          </div>
        )}
      </section>

      {/* --- Ingresos --- */}
      <section style={{ marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Ingresos</h2>
          <Link href="/dashboard/cashflow/income/new" style={{ fontSize: 14 }}>
            + Agregar
          </Link>
        </div>
        <p style={{ color: "var(--on-surface-variant)" }}>Total este mes: {formatCurrency(totalMonthlyIncome)}</p>

        {(!incomes || incomes.length === 0) && (
          <p style={{ color: "var(--on-surface-variant)" }}>Todavía no agregaste ningún ingreso.</p>
        )}

        {incomes && incomes.length > 0 && (
          <div>
            {incomes.map((income) => (
              <div
                key={income.id}
                className="paper-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  padding: "14px 18px",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {income.name}
                    <span style={{ color: "var(--on-surface-variant)", fontSize: 12, fontWeight: 500 }}>
                      {" "}
                      · {INCOME_KIND_LABELS[income.kind] ?? income.kind}
                    </span>
                  </p>
                  <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--on-surface-variant)" }}>
                    {formatCurrency(Number(income.amount))} ·{" "}
                    {income.is_recurring ? `desde ${income.month.slice(0, 7)}` : `solo ${income.month.slice(0, 7)}`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <Link href={`/dashboard/cashflow/income/${income.id}/edit`}>
                    <button type="button" style={{ padding: "6px 14px", fontSize: 13, background: "white" }}>
                      Editar
                    </button>
                  </Link>
                  <form action={deleteIncome}>
                    <input type="hidden" name="id" value={income.id} />
                    <button
                      type="submit"
                      style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer" }}
                    >
                      Borrar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Gastos fijos --- */}
      <section style={{ marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Gastos fijos</h2>
          <Link href="/dashboard/cashflow/expenses/new" style={{ fontSize: 14 }}>
            + Agregar
          </Link>
        </div>
        <p style={{ color: "var(--on-surface-variant)" }}>Total este mes: {formatCurrency(totalMonthlyExpenses)}</p>

        {(!expenses || expenses.length === 0) && (
          <p style={{ color: "var(--on-surface-variant)" }}>Todavía no agregaste ningún gasto fijo.</p>
        )}

        {expenses && expenses.length > 0 && (
          <div>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="paper-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  padding: "14px 18px",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{expense.name}</p>
                  <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--on-surface-variant)" }}>
                    {formatCurrency(Number(expense.amount))} ·{" "}
                    {expense.is_recurring ? `desde ${expense.month.slice(0, 7)}` : `solo ${expense.month.slice(0, 7)}`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <Link href={`/dashboard/cashflow/expenses/${expense.id}/edit`}>
                    <button type="button" style={{ padding: "6px 14px", fontSize: 13, background: "white" }}>
                      Editar
                    </button>
                  </Link>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button
                      type="submit"
                      style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer" }}
                    >
                      Borrar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
