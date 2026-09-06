import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { Card, EmptyState, Screen, Amount, MetaChip } from "@/components/ui";
import { BridgeLoanForm } from "@/components/BridgeLoanForm";

export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthTitle(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

/**
 * Préstamos puente (pantalla 11).
 *
 * Un puente no es una deuda más: entra entero en un mes y hay que devolverlo
 * entero en otro. La pantalla lo dice arriba porque es la diferencia que hace
 * que sirva o que hunda el mes siguiente.
 */
export default async function BridgeLoansPage() {
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data: loans } = scenario
    ? await supabase
        .from("bridge_loans")
        .select("id, lender, amount, taken_period, repay_period, annual_interest_rate, note")
        .eq("scenario_id", scenario.id)
        .order("taken_period", { ascending: false })
    : { data: [] };

  return (
    <Screen>
      <Link
        href="/dashboard/cashflow"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al flujo
      </Link>

      <h1 className="mt-2 text-screen text-ink">Préstamos puente</h1>
      <p className="help mt-1">
        Plata que entra un mes y hay que devolver entera en otro. No es una deuda más: mientras
        una deuda se paga de a poco, el puente se come el mes en que vence. Simulalo acá antes
        de pedirlo.
      </p>

      {!scenario ? (
        <div className="mt-4">
          <EmptyState
            title="Falta un escenario activo"
            note="Un puente pertenece a un escenario, para que puedas simularlo sin ensuciar tu plan base."
          />
        </div>
      ) : (
        <>
          {(loans ?? []).length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No simulaste ningún puente"
                note="Si estás pensando en pedir plata prestada para cubrir un mes, cargalo acá y mirá qué pasa con el mes en que hay que devolverla."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {(loans ?? []).map((loan) => (
                <li key={loan.id}>
                  <Card className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-card text-ink">{loan.lender}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <MetaChip>entra {monthTitle(loan.taken_period)}</MetaChip>
                          <MetaChip>
                            {loan.repay_period
                              ? `se devuelve ${monthTitle(loan.repay_period)}`
                              : "sin fecha de devolución"}
                          </MetaChip>
                        </div>
                        {loan.note && <p className="mt-1.5 text-[11px] text-muted">{loan.note}</p>}
                      </div>
                      <Amount className="shrink-0 text-card-lg text-ink">
                        {formatMoney(Number(loan.amount))}
                      </Amount>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <BridgeLoanForm />
        </>
      )}
    </Screen>
  );
}
