import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { Screen, Card, Amount, EmptyState } from "@/components/ui";
import { ScenarioActions, NewScenarioForm } from "@/components/ScenarioActions";

export const dynamic = "force-dynamic";

/**
 * Escenarios (pantalla 07).
 *
 * Un escenario es un mundo aparte: sus deudas, gastos, ingresos y pagos no se
 * comparten con los demás. La pantalla lo dice arriba porque es la idea que
 * hace falta entender antes de tocar cualquier botón de acá.
 */
export default async function ScenariosPage() {
  const supabase = await createClient();

  const { data: scenarios } = await supabase
    .from("scenarios")
    .select("id, name, starting_balance, is_active, created_at")
    .order("created_at", { ascending: true });

  const list = scenarios ?? [];

  // Cuántas deudas tiene cada uno, para que la lista diga algo del contenido y
  // no solo el nombre.
  const { data: debtRows } = await supabase.from("debts").select("scenario_id").eq("is_active", true);
  const debtCounts = new Map<string, number>();
  for (const row of debtRows ?? []) {
    debtCounts.set(row.scenario_id, (debtCounts.get(row.scenario_id) ?? 0) + 1);
  }

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Escenarios</h1>
      <p className="help mt-1">
        Cada escenario es un mundo aparte: sus deudas, gastos e ingresos no se comparten con
        los otros. Copiar uno copia sus datos, no los enlaza — podés tocar la copia sin miedo
        a arruinar el original.
      </p>

      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no hay escenarios"
            note="Necesitás al menos uno para cargar deudas y gastos. Empezá con el plan base: el de todos los días."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {list.map((scenario) => (
            <li key={scenario.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-card text-ink">{scenario.name}</span>
                      {scenario.is_active && (
                        <span
                          className="shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase"
                          style={{ backgroundColor: "#E0F4E9", color: "#175F42" }}
                        >
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11.5px] text-muted">
                      {debtCounts.get(scenario.id) ?? 0}{" "}
                      {(debtCounts.get(scenario.id) ?? 0) === 1 ? "deuda" : "deudas"}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-label uppercase text-muted">Parte de</div>
                    <Amount className="text-[13px] text-ink">
                      {formatMoney(Number(scenario.starting_balance))}
                    </Amount>
                  </div>
                </div>

                <ScenarioActions
                  id={scenario.id}
                  name={scenario.name}
                  isActive={scenario.is_active}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <NewScenarioForm />
    </Screen>
  );
}
