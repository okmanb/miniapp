import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { simulatePayoff, type Strategy } from "@/lib/calc/payoff";
import { monthlyRateFromAnnual, parseMoney } from "@/lib/calc/money";
import { EmptyState, PrimaryButton, Screen } from "@/components/ui";
import { PayoffControls } from "@/components/PayoffControls";
import { PayoffPlanResult } from "@/components/PayoffPlanResult";

export const dynamic = "force-dynamic";

/** El extra que trae el prototipo cargado por defecto. */
const DEFAULT_EXTRA = 500_000;

/**
 * Plan destructor de deudas (pantalla 08).
 *
 * Pagás el mínimo de todas y volcás lo que te sobra a una por vez. Cuando esa
 * se cancela, su mínimo se suma al pozo y acelera la siguiente — por eso cada
 * deuda de la lista dice cuánto libera: es el motor del plan, no un dato de
 * color.
 */
export default async function PayoffPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ extra?: string; estrategia?: string }>;
}) {
  const data = await getDashboard();
  const query = await searchParams;

  // El resultado aparece recién cuando se pidió: sin este parámetro la
  // pantalla es el formulario, como en el prototipo.
  const calculated = query.extra !== undefined;
  const extra = calculated ? parseMoney(query.extra) : DEFAULT_EXTRA;
  const strategy: Strategy = query.estrategia === "bola_de_nieve" ? "bola_de_nieve" : "avalancha";

  if (!data || data.debts.length === 0) {
    return (
      <Screen>
        <Header />
        <div className="mt-4">
          <EmptyState
            title="No hay deudas para planificar"
            note="El plan ordena tus deudas y vuelca lo que te sobra a una por vez. Necesita al menos una deuda cargada para tener algo que ordenar."
            action={<PrimaryButton href="/dashboard/debts/new">Agregar una deuda</PrimaryButton>}
          />
        </div>
      </Screen>
    );
  }

  const plan = calculated
    ? simulatePayoff({
        debts: data.debts.map((d) => ({
          id: d.id,
          name: d.name,
          kind: d.kind,
          balance: d.balance,
          minimum: d.minimumPayment ?? 0,
          monthlyRate: monthlyRateFromAnnual(d.annualRate),
          recurringCharge: d.recurringCharge,
        })),
        extraPerMonth: extra,
        strategy,
      })
    : null;

  const missingMinimums = data.debts.filter((d) => d.minimumPayment == null).length;

  return (
    <Screen>
      <Header />

      <p className="help mt-1">
        Elegí un método y cuánto podés meter de extra por mes por encima de los pagos mínimos. El
        sistema simula el orden en que vas a cancelar cada deuda.
      </p>

      {missingMinimums > 0 && (
        <p className="mt-3 rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-2 text-[11.5px] text-gold-ink">
          {missingMinimums === 1
            ? "Una deuda no tiene mínimo cargado, así que el plan la cuenta con mínimo cero."
            : `${missingMinimums} deudas no tienen mínimo cargado, así que el plan las cuenta con mínimo cero.`}{" "}
          Cargá sus resúmenes para que el plazo sea real.
        </p>
      )}

      <PayoffControls extra={extra} strategy={strategy} />

      {plan && <PayoffPlanResult plan={plan} extra={extra} strategy={strategy} />}
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
      <h1 className="mt-2 text-screen text-ink">Plan destructor de deudas</h1>
    </>
  );
}
