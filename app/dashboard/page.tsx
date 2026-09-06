import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/calc/money";
import type { GrowthCause } from "@/lib/calc/statement";
import { TotalDebtHero } from "@/components/TotalDebtHero";
import { RunwayCard } from "@/components/RunwayCard";
import { AlertsPeek } from "@/components/AlertsPeek";
import { PayMinimumButton } from "@/components/PayMinimumButton";
import { Card, EmptyState, PrimaryButton, Screen, Amount, MetaChip } from "@/components/ui";

// El saldo se deriva en cada lectura; cachearlo mostraría una cifra vieja.
export const dynamic = "force-dynamic";

const GREETING_HOURS = [
  { until: 13, text: "Buen día" },
  { until: 20, text: "Buenas tardes" },
  { until: 24, text: "Buenas noches" },
];

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "Visa Signature …2166" -> "Visa Signature". El botón ya es largo de por sí. */
function shortName(name: string): string {
  return name.replace(/\s*[….]{1,3}\s*\d+$/, "").trim();
}

export default async function DashboardPage() {
  const data = await getDashboard();
  const now = new Date();
  const greeting = GREETING_HOURS.find((g) => now.getHours() < g.until)!.text;
  const dateLabel = `${DAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

  // El atajo apunta a la primera alerta que un pago del mínimo puede resolver,
  // no siempre a la primera alerta: la más cara no se destraba pagando.
  const payable =
    data?.alerts
      .map((a) => data.debts.find((d) => d.id === a.debtId))
      .find((d) => d && d.minimumPayment != null && d.minimumPayment > 0) ?? null;

  return (
    <Screen>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-screen text-ink">{greeting}</h1>
          <p className="mt-0.5 text-[12px] text-muted">{dateLabel}</p>
        </div>
      </header>

      {data === null ? (
        <EmptyState
          title="Todavía no hay nada que simular"
          note="Cargá tu primera deuda y la app arma la proyección, las alertas y el plan desde ahí. No hace falta que estén todas: con una alcanza para empezar a ver el mes."
          action={<PrimaryButton href="/dashboard/debts/new">Cargar mi primera deuda</PrimaryButton>}
        />
      ) : (
        <>
          <TotalDebtHero
            total={data.total}
            delta={data.delta}
            series={data.series}
            debtCount={data.debts.length}
            statusLabel={data.hasOverdue ? "hay un vencimiento pasado" : "todas al día"}
            hasOverdue={data.hasOverdue}
          />

          <div className="mt-3">
            <RunwayCard
              monthLabel={data.runwayMonth}
              note={data.runwayNote}
              remaining={data.cashflow.remainingAtRunway}
            />
          </div>

          <Link
            href="/dashboard/scenarios"
            className="mt-3 flex min-h-touch items-center justify-between rounded-surface bg-mint-wash px-4 py-3 text-card text-pine transition-colors duration-150 ease-sd hover:bg-selection"
          >
            <span>Escenario: {data.scenarioName}</span>
            <span aria-hidden>›</span>
          </Link>

          <div className="mt-3">
            <AlertsPeek
              count={data.alerts.length}
              severity={
                data.alerts.length === 0
                  ? "none"
                  : data.alerts.some((a) => a.severity === "brick")
                    ? "brick"
                    : "gold"
              }
              headline={data.alerts[0]?.title ?? "Nada vence en los próximos 3 días."}
              action={
                payable && (
                  <PayMinimumButton
                    debtId={payable.id}
                    debtName={shortName(payable.name)}
                    amount={payable.minimumPayment!}
                    alreadyPaid={payable.minimumPaidThisMonth}
                  />
                )
              }
            />
          </div>

          <div className="mb-2 mt-5 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Tus deudas</h2>
            <span
              className="font-mono text-[10.5px] uppercase text-muted"
              style={{ letterSpacing: ".04em" }}
            >
              {data.hasOverdue ? "revisar" : "al día"} ({data.debts.length})
            </span>
          </div>

          {data.debts.length === 0 ? (
            <EmptyState
              title="Este escenario no tiene deudas"
              note="Un escenario vacío no proyecta nada. Agregá una deuda acá o copiá las de otro escenario desde la pantalla de escenarios."
              action={<PrimaryButton href="/dashboard/debts/new">Agregar una deuda</PrimaryButton>}
            />
          ) : (
            <ul className="space-y-2">
              {data.debts.map((debt) => (
                <li key={debt.id}>
                  <Link href={`/dashboard/debts/${debt.id}`} className="block">
                    <Card className="px-4 py-3 transition-colors duration-150 ease-sd hover:bg-surface-sunken">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-card text-ink">{debt.name}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <MetaChip>
                              {debt.dueDay != null ? `vto. ${debt.dueDay}` : "cuota fija"}
                            </MetaChip>
                            {debt.annualRate != null && (
                              <MetaChip>TNA {debt.annualRate.toLocaleString("es-AR")}%</MetaChip>
                            )}
                          </div>
                          {debt.installmentCount > 0 && (
                            <p className="mt-1.5 text-[11px] text-muted">
                              incluye {debt.installmentCount}{" "}
                              {debt.installmentCount === 1 ? "compra en cuotas" : "compras en cuotas"}:{" "}
                              {formatMoney(debt.installmentTotal)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-label uppercase text-muted">Saldo</div>
                          <Amount className="text-card-lg text-ink">
                            {formatMoney(debt.balance)}
                          </Amount>
                        </div>
                      </div>

                      {/*
                        El progreso se deriva de pagado / (pagado + saldo). Sin
                        pagos registrados no hay barra: una en cero no informa,
                        solo ocupa lugar y sugiere que se empezó algo.
                      */}
                      {debt.paid > 0 && (
                        <div className="mt-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] text-muted">
                              {formatMoney(debt.paid)} pagado
                            </span>
                            <span className="font-mono text-[11px] text-leaf-deep">
                              {Math.round(debt.paidFraction * 100)}%
                            </span>
                          </div>
                          <div
                            className="mt-1 h-1 w-full overflow-hidden rounded-pill bg-track"
                            role="img"
                            aria-label={`${Math.round(debt.paidFraction * 100)}% saldado`}
                          >
                            <div
                              className="h-full rounded-pill bg-leaf"
                              style={{ width: `${Math.min(debt.paidFraction * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {debt.growth && (
                        <p className="mt-2 border-t border-border-row pt-2 text-[11.5px] text-brick-ink">
                          {growthMessage(debt.growth)}
                        </p>
                      )}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Screen>
  );
}

/**
 * La interfaz explica la causa, no regaña. Cuando el mínimo no cubre el
 * interés se nombra el interés; cuando lo cubre pero no alcanza para lo que
 * se le carga cada mes, se nombra ese monto.
 */
function growthMessage(growth: GrowthCause): string {
  switch (growth.kind) {
    case "interes":
      return `El mínimo no cubre el interés de ${formatMoney(growth.amount)} por mes — el saldo va a seguir creciendo.`;
    case "gastos_fijos":
      return `El mínimo cubre el interés, pero no los ${formatMoney(growth.amount)} de gastos fijos que se cargan a esta tarjeta cada mes.`;
    case "minimo_insuficiente":
      return `Al mínimo le faltan ${formatMoney(growth.amount)} por mes para que el saldo deje de crecer.`;
  }
}
