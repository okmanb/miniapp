import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/calc/money";
import { viewInstallmentPlan, type InstallmentPlanRow, type InstallmentPlanView } from "@/lib/calc/installments";
import { Screen, Card, Amount, EmptyState, MetaChip } from "@/components/ui";
import { InstallmentPlanForm } from "@/components/InstallmentPlanForm";

export const dynamic = "force-dynamic";

/**
 * Cuotas y refinanciación (pantalla 09).
 *
 * Cada compra en cuotas es su propia deuda ligada a esta tarjeta: se amortiza
 * sola, con su plazo y su tasa. Por eso tiene pantalla propia y no es una fila
 * más del detalle — el saldo de la tarjeta y el de una compra en 18 cuotas se
 * mueven a ritmos distintos.
 *
 * Las dos agrupaciones no son cosméticas. Una compra sin costo financiero no
 * se ataca: pagarla antes no ahorra un peso. Las que sí cobran se ordenan de
 * mayor a menor tasa, el mismo criterio que el plan destructor.
 */
export default async function InstallmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: debt } = await supabase
    .from("debts")
    .select("id, name, kind")
    .eq("id", id)
    .maybeSingle();

  if (!debt) notFound();

  const { data: rows } = await supabase
    .from("card_installment_plans")
    .select("id, description, cupon, first_period, total_installments, installment_amount, tna")
    .eq("debt_id", id)
    .eq("is_active", true)
    .order("first_period", { ascending: true });

  const period = currentPeriod();
  const plans = ((rows ?? []) as InstallmentPlanRow[]).map((p) => viewInstallmentPlan(p, period));

  const active = plans.filter((p) => !p.finished);
  const financed = active
    .filter((p) => (p.tna ?? 0) > 0)
    .sort((a, b) => (b.tna ?? 0) - (a.tna ?? 0));
  const free = active.filter((p) => (p.tna ?? 0) <= 0);
  const done = plans.filter((p) => p.finished);

  const totalBalance = active.reduce((sum, p) => sum + p.balance, 0);
  const projectedInterest = financed.reduce((sum, p) => sum + p.projectedInterest, 0);

  return (
    <Screen>
      <Link
        href={`/dashboard/debts/${id}`}
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al detalle
      </Link>

      <h1 className="mt-2 text-screen text-ink">Cuotas y refinanciación</h1>
      <p className="help mt-1">
        Cada compra en cuotas o refinanciación es su propia deuda, ligada a {debt.name} — se
        amortiza sola con su propio plazo y tasa.
      </p>

      {plans.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Esta tarjeta no tiene compras en cuotas"
            note="Aparecen solas al cargar un resumen que las traiga, o podés agregar una a mano acá abajo."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Card className="px-3 py-3">
              <Amount className="block text-[20px] font-semibold text-ink">{active.length}</Amount>
              <div className="mt-0.5 text-[10.5px] text-muted">
                {active.length === 1 ? "compra activa" : "compras activas"}
              </div>
            </Card>
            <Card className="px-3 py-3">
              <Amount className="block text-[20px] font-semibold text-ink">
                {formatMoney(totalBalance)}
              </Amount>
              <div className="mt-0.5 text-[10.5px] text-muted">saldo total</div>
            </Card>
          </div>

          {projectedInterest > 0 && (
            <Card className="mt-2 flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="text-[12px] text-muted">
                Interés proyectado de tus refinanciaciones
              </span>
              <Amount className="shrink-0 text-[15px] font-semibold text-ink">
                {formatMoney(projectedInterest)}
              </Amount>
            </Card>
          )}

          {financed.length > 0 && (
            <Group
              title="Con costo financiero"
              count={financed.length}
              hint="mayor a menor tasa"
              note="Mismo criterio que tu Plan destructor (avalancha): atacá primero la de tasa más alta."
              plans={financed}
            />
          )}

          {free.length > 0 && (
            <Group
              title="Sin costo financiero"
              count={free.length}
              note="Pagarlas antes no ahorra un peso: el comercio ya subsidió el interés. Lo único que cambia es cuándo se libera la cuota."
              plans={free}
            />
          )}

          {done.length > 0 && <Group title="Terminadas" count={done.length} plans={done} />}
        </>
      )}

      <InstallmentPlanForm debtId={id} />
    </Screen>
  );
}

function Group({
  title,
  count,
  hint,
  note,
  plans,
}: {
  title: string;
  count: number;
  hint?: string;
  note?: string;
  plans: InstallmentPlanView[];
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="rounded-pill bg-track px-2 py-0.5 font-mono text-[10.5px] font-bold text-muted">
          {count}
        </span>
        {hint && <span className="text-[11px] text-muted">· {hint}</span>}
      </div>
      {note && <p className="help mt-1">{note}</p>}

      <ul className="mt-3 space-y-2">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Card className="px-4 py-3">
              <div className="text-card text-ink">{plan.description}</div>
              <div className="mt-1 text-[11.5px] text-muted">
                {plan.finished
                  ? `cuota ${plan.total}/${plan.total} · terminada`
                  : `cuota ${plan.current}/${plan.total} · termina ${plan.endsOn} · ${formatMoney(plan.amount)} por mes`}
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
                <span className="text-label uppercase text-muted">Saldo</span>
                <Amount className="text-[15px] font-semibold text-ink">
                  {formatMoney(plan.balance)}
                </Amount>
              </div>

              <div className="mt-1.5">
                {plan.finished ? (
                  <MetaChip>✓ pagada por completo</MetaChip>
                ) : (plan.tna ?? 0) > 0 ? (
                  <MetaChip>{plan.tna!.toLocaleString("es-AR")}% TNA</MetaChip>
                ) : (
                  <MetaChip>cuota sin interés</MetaChip>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
