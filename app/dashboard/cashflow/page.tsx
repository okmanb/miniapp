import Link from "next/link";
import { getCashflowScreen } from "@/lib/data/cashflow";
import { formatMoney } from "@/lib/calc/money";
import { CashflowBoard } from "@/components/CashflowBoard";
import { StartingBalanceForm } from "@/components/StartingBalanceForm";
import { Card, EmptyState, PrimaryButton, Screen, MetaChip, Amount, Chevron } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CashflowPage() {
  const data = await getCashflowScreen();

  if (data === null) {
    return (
      <Screen>
        <BackLink />
        <h1 className="mt-2 text-screen text-ink">Con qué te enfrentás cada mes</h1>
        <div className="mt-4">
          <EmptyState
            title="Todavía no hay nada que proyectar"
            note="La proyección se arma con tus ingresos, tus gastos fijos y lo que pagás de deuda cada mes. Con cargar una deuda y tu sueldo ya empieza a tener forma."
            action={<PrimaryButton href="/dashboard/debts/new">Cargar mi primera deuda</PrimaryButton>}
          />
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink />
      <h1 className="mt-2 text-screen text-ink">Con qué te enfrentás cada mes</h1>

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
          Cómo se calcula
          <Chevron className="group-open:rotate-180" />
        </summary>
        <p className="help mt-1">
          Cada mes suma tus ingresos, resta los gastos que salen del efectivo y resta lo que
          tenés que pagar de deuda. El resultado se encadena desde tu saldo real de hoy, así
          que el mes que sigue arranca donde terminó el anterior. Los gastos cargados a una
          tarjeta no se restan acá: ya están adentro del saldo de esa tarjeta, y la tarjeta ya
          aparece por su pago del mes.
        </p>
      </details>

      <Link
        href="/dashboard/bridge-loans"
        className="mt-4 flex min-h-touch items-center justify-between gap-3 rounded-pill border border-border bg-surface px-[18px] py-3 text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        <span>Simular un préstamo puente</span>
        <span aria-hidden>→</span>
      </Link>

      <StartingBalanceForm initial={data.startingBalance} />

      <CashflowBoard months={data.cashflow.months} scenarioName={data.scenarioName} />

      <h2 className="mt-8 text-[15px] font-semibold text-ink">Con qué te enfrentás por deuda</h2>
      <p className="help mt-1">
        Arriba, lo que tenés que pagar este mes. Abajo, lo que va a quedar debiéndose de esa
        deuda.
      </p>

      {data.debts.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="No hay deudas en este escenario"
            note="Sin deudas, la proyección es solo ingresos menos gastos. Agregá una para ver el peso real de cada mes."
            action={<PrimaryButton href="/dashboard/debts/new">Agregar una deuda</PrimaryButton>}
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.debts.map((debt) => (
            <li key={debt.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-card text-ink">{debt.name}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <MetaChip>{KIND_LABEL[debt.kind] ?? debt.kind}</MetaChip>
                      {debt.dueDay != null && <MetaChip>vto. {debt.dueDay}</MetaChip>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1 border-t border-border-row pt-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-label uppercase text-muted">Este mes</span>
                    <Amount className="text-[15px] font-semibold text-ink">
                      {formatMoney(debt.dueThisMonth)}
                    </Amount>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11.5px] text-muted">saldo proyectado</span>
                    <Amount className="text-[13px] text-muted">
                      {formatMoney(debt.projectedBalance)}
                    </Amount>
                  </div>
                </div>

                {debt.installments.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {debt.installments.map((plan) => (
                      <li key={plan.id} className="rounded-row bg-surface-sunken px-3 py-2">
                        <div className="text-[12px] font-semibold text-ink">{plan.description}</div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          cuota {plan.current}/{plan.total} · termina {plan.endsOn}
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <span className="text-label uppercase text-muted">Este mes</span>
                          <Amount className="text-[13px] text-ink">
                            {formatMoney(plan.amount)}
                          </Amount>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

const KIND_LABEL: Record<string, string> = {
  tarjeta: "Tarjeta de crédito",
  prestamo_personal: "Préstamo personal",
  prendario: "Prendario",
  hipotecario: "Hipotecario",
  plan_v: "Refinanciación",
  otro: "Otro",
};

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
    >
      <span aria-hidden>←</span> Volver al dashboard
    </Link>
  );
}
