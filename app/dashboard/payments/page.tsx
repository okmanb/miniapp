import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
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

const KIND_LABEL: Record<string, string> = {
  cuota_fija: "Cuota fija",
  pago_variable: "Pago",
  minimo_estimado: "Mínimo del resumen",
  unico: "Pago extra",
};

/**
 * Historial de pagos (pantalla 15).
 *
 * Agrupado por mes con subtotal, porque la pregunta real que trae a alguien
 * acá es "cuánto puse este mes", no "qué pagué el martes".
 */
export default async function PaymentsHistoryPage() {
  const supabase = createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data } = scenario
    ? await supabase
        .from("debt_payments")
        .select("id, amount, period, paid_on, kind, debts(name)")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false })
        .order("paid_on", { ascending: false })
    : { data: [] };

  const rows = (data ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount),
    period: p.period,
    paidOn: p.paid_on as string | null,
    kind: p.kind as string,
    debtName: p.debts?.name ?? "—",
  }));

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const thisMonth = rows
    .filter((r) => r.period === currentPeriod())
    .reduce((sum, r) => sum + r.amount, 0);

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = groups.get(row.period) ?? [];
    list.push(row);
    groups.set(row.period, list);
  }

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Historial de pagos</h1>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no registraste pagos"
            note="Cada pago que cargues baja el saldo de esa deuda y queda acá con su fecha."
            action={<PrimaryButton href="/dashboard/payments/new">Registrar un pago</PrimaryButton>}
          />
        </div>
      ) : (
        <>
          <Card className="mt-4 px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">Este mes</span>
              <Amount className="text-[18px] font-semibold text-leaf-deep">
                {formatMoney(thisMonth)}
              </Amount>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
              <span className="text-[13px] text-muted">Desde que empezaste</span>
              <Amount className="text-[13px] text-ink">{formatMoney(total)}</Amount>
            </div>
          </Card>

          {[...groups.entries()].map(([groupPeriod, list]) => {
            const subtotal = list.reduce((sum, r) => sum + r.amount, 0);
            return (
              <section key={groupPeriod} className="mt-6">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-ink">{monthTitle(groupPeriod)}</h2>
                  <Amount className="text-[11.5px] text-muted">{formatMoney(subtotal)}</Amount>
                </div>

                <ul className="space-y-2">
                  {list.map((row) => (
                    <li key={row.id}>
                      <Card className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-card text-ink">{row.debtName}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <MetaChip>{KIND_LABEL[row.kind] ?? row.kind}</MetaChip>
                            {row.paidOn && <MetaChip>{row.paidOn}</MetaChip>}
                          </div>
                        </div>
                        <Amount className="shrink-0 text-card-lg text-leaf-deep">
                          −{formatMoney(row.amount)}
                        </Amount>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </Screen>
  );
}
