import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/calc/money";
import type { GrowthCause } from "@/lib/calc/statement";
import { TotalDebtHero } from "@/components/TotalDebtHero";
import { Card, EmptyState, PrimaryButton, Screen, Amount } from "@/components/ui";

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

export default async function DashboardPage() {
  const data = await getDashboard();
  const now = new Date();
  const greeting = GREETING_HOURS.find((g) => now.getHours() < g.until)!.text;
  const dateLabel = `${DAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

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

          <Link
            href="/dashboard/scenarios"
            className="mt-3 flex min-h-touch items-center justify-between rounded-surface bg-mint-wash px-4 py-3 text-card text-pine transition-colors duration-150 ease-sd hover:bg-selection"
          >
            <span>Escenario: {data.scenarioName}</span>
            <span aria-hidden>›</span>
          </Link>

          <h2 className="mb-2 mt-5 text-label uppercase text-muted">Tus deudas</h2>

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
                          <div className="mt-0.5 text-[11.5px] text-muted">
                            {debt.annualRate != null
                              ? `TNA ${debt.annualRate.toLocaleString("es-AR")}%`
                              : "sin tasa cargada"}
                            {debt.dueDay != null ? ` · vence el ${debt.dueDay}` : ""}
                          </div>
                        </div>
                        <Amount className="shrink-0 text-card-lg text-ink">
                          {formatMoney(debt.balance)}
                        </Amount>
                      </div>

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
