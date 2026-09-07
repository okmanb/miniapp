import Link from "next/link";
import { getScenarioBoard } from "@/lib/data/scenarios";
import { formatMoney } from "@/lib/calc/money";
import { Screen, Card, Amount, EmptyState } from "@/components/ui";
import { ScenarioActions, NewScenarioForm } from "@/components/ScenarioActions";
import { ScenarioComparison } from "@/components/ScenarioComparison";

export const dynamic = "force-dynamic";

/**
 * Escenarios (pantalla 07).
 *
 * Cada tarjeta muestra el RESULTADO del escenario, no sus datos de entrada: en
 * qué mes se queda corto y con cuánto termina. El saldo de partida y la
 * cantidad de deudas son lo que cargaste; lo que hace falta para elegir entre
 * dos planes es lo que sale de proyectarlos.
 */
export default async function ScenariosPage() {
  const scenarios = await getScenarioBoard();

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Escenarios</h1>

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
          Cómo se calcula
          <span
            className="transition-transform duration-200 ease-sd group-open:rotate-180"
            aria-hidden
          >
            ⌄
          </span>
        </summary>
        <p className="help mt-1">
          El mismo set de deudas, pero con decisiones distintas — comparalos sin que se pisen
          entre sí. El activo es el que ves en el dashboard y en el flujo de caja. Copiar uno
          copia sus datos, no los enlaza: podés tocar la copia sin miedo a arruinar el original.
        </p>
      </details>

      {scenarios.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no hay escenarios"
            note="Necesitás al menos uno para cargar deudas y gastos. Empezá con el plan base: el de todos los días."
          />
        </div>
      ) : (
        <>
          <ScenarioComparison scenarios={scenarios} />

          <ul className="mt-4 space-y-2">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <Card className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-card text-ink">{scenario.name}</span>
                        {scenario.isActive && (
                          <span
                            className="shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-bold"
                            style={{ backgroundColor: "#E0F4E9", color: "#175F42" }}
                          >
                            ✓ activo
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted">
                        {scenario.note ??
                          `${scenario.debtCount} ${scenario.debtCount === 1 ? "deuda" : "deudas"} · parte de ${formatMoney(scenario.startingBalance)}`}
                      </div>
                    </div>
                  </div>

                  {scenario.canProject ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric
                        value={scenario.firstGapMonth ?? "los seis meses"}
                        label={scenario.firstGapMonth ? "primer mes en rojo" : "aguanta"}
                        tone={scenario.firstGapMonth ? "brick" : "leaf"}
                      />
                      <Metric
                        value={formatMoney(scenario.finalCushion)}
                        label={
                          scenario.firstGapMonth
                            ? `termina ${scenario.finalMonth} en`
                            : `colchón en ${scenario.finalMonth}`
                        }
                        tone={scenario.finalCushion < 0 ? "brick" : "leaf"}
                      />
                    </div>
                  ) : (
                    /*
                      Sin ingresos la proyección da todo cero, y cero no es un
                      resultado: es la ausencia de datos. Decirlo es la
                      diferencia entre no saber y afirmar que aguanta.
                    */
                    <p className="mt-3 rounded-row bg-surface-sunken px-3 py-2 text-[11.5px] text-muted">
                      Sin ingresos cargados no hay con qué proyectarlo.
                    </p>
                  )}

                  <ScenarioActions
                    id={scenario.id}
                    name={scenario.name}
                    isActive={scenario.isActive}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <NewScenarioForm
        isFirst={scenarios.length === 0}
        seeds={scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          startingBalance: s.startingBalance,
          monthlyIncome: s.monthlyIncome,
          monthlyFixed: s.monthlyFixed,
        }))}
      />
    </Screen>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "brick" | "leaf";
}) {
  return (
    <div className="rounded-row bg-surface-sunken px-3 py-2">
      <Amount
        className="block text-[14px] font-semibold"
        style={{ color: tone === "brick" ? "#94362A" : "#175F42" }}
      >
        {value}
      </Amount>
      <div className="mt-0.5 text-[10.5px] text-muted">{label}</div>
    </div>
  );
}
