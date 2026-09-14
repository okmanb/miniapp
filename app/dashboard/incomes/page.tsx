import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { formatMonthName } from "@/lib/calc/dates";
import { Card, EmptyState, Screen, Amount, MetaChip } from "@/components/ui";
import { IncomeForm } from "@/components/IncomeForm";

export const dynamic = "force-dynamic";

function whenLabel(kind: string, months: number[]): string {
  if (kind === "mensual" || months.length === 0) return "todos los meses";
  return months.map(formatMonthName).join(" y ");
}

/**
 * Ingresos.
 *
 * El sueldo puede venir en dos partes con montos que cambian mes a mes: se
 * cargan como dos ingresos separados, no como uno con el total, para poder
 * cambiar uno sin tocar el otro. Y hay ingresos que entran una vez al año —
 * por eso el tipo decide en qué meses entra, y no es una etiqueta.
 */
export default async function IncomesPage() {
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data: incomes } = scenario
    ? await supabase
        .from("incomes")
        .select("id, description, amount, kind, eligible_months, period, ended_period")
        .eq("scenario_id", scenario.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const active = (incomes ?? []).filter((i) => !i.ended_period);

  return (
    <Screen>
      <Link
        href="/dashboard/cashflow"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al flujo
      </Link>

      <h1 className="mt-2 text-screen text-ink">Tus ingresos</h1>
      <p className="help mt-1">
        Si el sueldo te entra en dos partes, cargalas por separado: así podés cambiar una sin
        tocar la otra cuando una sola cambia de monto. Tocá cualquiera para registrar un
        aumento.
      </p>

      {active.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no cargaste ingresos"
            note="Sin ingresos, la proyección solo resta. Cargá al menos el sueldo para que los meses tengan sentido."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((income) => (
            <li key={income.id}>
              {/* El renglón entero abre el ingreso: es donde se registra un
                  aumento, y hasta que existió esa pantalla no había forma de
                  cambiarle el monto a nada de esta lista. */}
              <Link href={`/dashboard/incomes/${income.id}`} className="block">
                <Card className="flex items-start justify-between gap-3 px-4 py-3 transition-colors duration-150 ease-sd hover:bg-surface-sunken">
                  <div className="min-w-0">
                    <div className="truncate text-card text-ink">{income.description}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <MetaChip>{whenLabel(income.kind, income.eligible_months ?? [])}</MetaChip>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Amount className="text-card-lg text-leaf-deep">
                      {formatMoney(Number(income.amount))}
                    </Amount>
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {scenario && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">Agregar uno</h2>
          <IncomeForm />
        </section>
      )}
    </Screen>
  );
}
