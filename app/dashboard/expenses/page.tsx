import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { expenseAppliesTo, type ExpenseLike } from "@/lib/calc/balance";
import { currentPeriod } from "@/lib/data/dashboard";
import { Card, EmptyState, PrimaryButton, Screen, Amount, MetaChip } from "@/components/ui";

export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthTitle(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

interface Row extends ExpenseLike {
  id: string;
  description: string;
  debtName: string | null;
}

export default async function ExpensesPage() {
  const supabase = createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) {
    return (
      <Screen>
        <Header />
        <div className="mt-4">
          <EmptyState
            title="Falta un escenario activo"
            note="Los gastos cuelgan de un escenario. Creá o activá uno para empezar a cargarlos."
            action={<PrimaryButton href="/dashboard/scenarios">Ir a escenarios</PrimaryButton>}
          />
        </div>
      </Screen>
    );
  }

  const { data } = await supabase
    .from("expenses")
    .select("id, description, amount, period, ended_period, is_recurring, is_archived, paid_with, debt_id, debts(name)")
    .eq("scenario_id", scenario.id)
    .order("period", { ascending: false });

  const rows: Row[] = (data ?? []).map((e: any) => ({
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
    period: e.period,
    ended_period: e.ended_period,
    is_recurring: e.is_recurring,
    is_archived: e.is_archived,
    debt_id: e.debt_id,
    debtName: e.debts?.name ?? null,
  }));

  if (rows.length === 0) {
    return (
      <Screen>
        <Header />
        <div className="mt-4">
          <EmptyState
            title="Todavía no cargaste gastos"
            note="Los gastos fijos son los que se repiten todos los meses; los consumos únicos entran una sola vez. Los dos afectan la proyección, cada uno a su manera."
            action={<PrimaryButton href="/dashboard/expenses/new">Agregar un gasto</PrimaryButton>}
          />
        </div>
      </Screen>
    );
  }

  // Agrupados por el mes en que se cargaron, con subtotal por grupo (regla 2).
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const list = groups.get(row.period) ?? [];
    list.push(row);
    groups.set(row.period, list);
  }

  const period = currentPeriod();

  return (
    <Screen>
      <Header />

      <p className="help mt-2">
        Escenario: {scenario.name}. El subtotal de cada mes cuenta solo lo que sale del
        efectivo — un gasto cargado a una tarjeta ya está adentro del saldo de esa tarjeta.
      </p>

      <div className="mt-4">
        <PrimaryButton href="/dashboard/expenses/new">Agregar un gasto</PrimaryButton>
      </div>

      {[...groups.entries()].map(([groupPeriod, list]) => {
        const cashSubtotal = list
          .filter((r) => r.debt_id === null)
          .reduce((sum, r) => sum + r.amount, 0);

        return (
          <section key={groupPeriod} className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">{monthTitle(groupPeriod)}</h2>
              <span className="font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: ".04em" }}>
                efectivo {formatMoney(cashSubtotal)}
              </span>
            </div>

            <ul className="space-y-2">
              {list.map((row) => {
                const active = row.is_recurring
                  ? expenseAppliesTo(row, period)
                  : row.period === period;

                return (
                  <li key={row.id}>
                    <Link href={`/dashboard/expenses/${row.id}`} className="block">
                      <Card className="px-4 py-3 transition-colors duration-150 ease-sd hover:bg-surface-sunken">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-card text-ink">{row.description}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <MetaChip>{row.is_recurring ? "fijo" : "único"}</MetaChip>
                              {row.debtName ? (
                                <MetaChip>no sale del efectivo · {row.debtName}</MetaChip>
                              ) : (
                                <MetaChip>efectivo</MetaChip>
                              )}
                              {row.is_archived && <MetaChip>archivado</MetaChip>}
                              {row.ended_period && <MetaChip>terminó {monthTitle(row.ended_period)}</MetaChip>}
                            </div>
                          </div>
                          <Amount
                            className="shrink-0 text-card-lg"
                            // Un gasto que ya no cuenta este mes se muestra apagado, pero
                            // no se esconde: sigue siendo parte del historial.
                          >
                            <span style={{ color: active ? "#12211D" : "#5C6B65" }}>
                              {formatMoney(row.amount)}
                            </span>
                          </Amount>
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </Screen>
  );
}

function Header() {
  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>
      <h1 className="mt-2 text-screen text-ink">Tus gastos</h1>
    </>
  );
}
