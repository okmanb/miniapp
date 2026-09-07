import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { simulatePayoff, formatMonthSpan, type PayoffResult, type Strategy } from "@/lib/calc/payoff";
import { monthlyRateFromAnnual, formatMoney, parseMoney } from "@/lib/calc/money";
import { Card, EmptyState, PrimaryButton, Screen, Amount } from "@/components/ui";
import { PayoffControls } from "@/components/PayoffControls";
import { PayoffExport } from "@/components/PayoffExport";

export const dynamic = "force-dynamic";

/** El extra que trae el prototipo cargado por defecto. */
const DEFAULT_EXTRA = 500_000;

const KIND_LABEL: Record<string, string> = {
  tarjeta: "tarjeta de crédito",
  prestamo_personal: "préstamo personal",
  prendario: "préstamo prendario",
  hipotecario: "préstamo hipotecario",
  plan_v: "refinanciación",
  otro: "otra deuda",
};

const STRATEGY_LABEL: Record<Strategy, string> = {
  avalancha: "Avalancha",
  bola_de_nieve: "Bola de nieve",
};

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

      {plan && <PlanResult plan={plan} extra={extra} strategy={strategy} />}
    </Screen>
  );
}

function PlanResult({
  plan,
  extra,
  strategy,
}: {
  plan: PayoffResult;
  extra: number;
  strategy: Strategy;
}) {
  if (plan.totalMonths === null) {
    return (
      <Card className="mt-6 px-4 py-4">
        <div className="text-card-lg text-brick-head">A este ritmo no se termina</div>
        <p className="mt-1.5 text-[11.5px] text-brick-ink">
          Con {extra === 0 ? "solo los mínimos" : `${formatMoney(extra)} extra por mes`}, el interés
          crece más rápido de lo que baja el saldo. Probá con un extra más alto para ver a partir
          de cuánto empieza a cerrar.
        </p>
      </Card>
    );
  }

  const open = cancellationOrder(plan);

  return (
    <>
      <h2 className="mt-8 text-[15px] font-semibold text-ink">
        Resultado — {STRATEGY_LABEL[strategy]}
      </h2>

      <Card className="mt-3 px-4 py-4">
        <Amount className="block text-[26px] font-semibold text-ink">
          {formatMonthSpan(plan.totalMonths)}
        </Amount>
        <div className="mt-0.5 text-[11.5px] text-muted">quedás libre de deudas</div>

        <div className="mt-3 border-t border-border-row pt-3">
          <Amount className="block text-[20px] font-semibold text-ink">
            {formatMoney(plan.totalInterest!)}
          </Amount>
          <div className="mt-0.5 text-[11.5px] text-muted">interés total pagado</div>
        </div>
      </Card>

      <h2 className="mt-6 text-[15px] font-semibold text-ink">
        Orden en que cancelás cada deuda
      </h2>
      <ol className="mt-3 space-y-2">
        {open.map((debt, index) => {
          const isLast = index === open.length - 1;
          return (
            <li key={debt.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-mint-wash font-mono text-[12px] font-semibold text-leaf-deep"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-card text-ink">{debt.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {KIND_LABEL[debt.kind] ?? debt.kind}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
                  <span className="text-label uppercase text-muted">Te la sacás en</span>
                  <Amount className="text-[13.5px] font-semibold text-ink">
                    {formatMonthSpan(debt.clearedMonth)}
                  </Amount>
                </div>

                {/*
                  Lo que libera es el motor del plan: el mínimo de la que cae se
                  suma al pozo de la siguiente. Decirlo en cada fila es lo que
                  explica por qué la lista se acelera hacia abajo.
                */}
                <p className="mt-1.5 text-[11.5px] text-muted">
                  {isLast
                    ? `con esta cerrás el plan: los ${formatMoney(debt.minimum)} del mínimo quedan libres`
                    : `libera ${formatMoney(debt.minimum)} por mes para la siguiente`}
                </p>
              </Card>
            </li>
          );
        })}
      </ol>

      <PayoffExport text={buildPlanText({ plan, extra, strategy })} />
    </>
  );
}

/**
 * El plan en texto plano. Sale del mismo resultado que la pantalla, no de una
 * segunda cuenta: si difirieran, el que se pega en algún lado sería el que
 * nadie revisó.
 */
function buildPlanText({
  plan,
  extra,
  strategy,
}: {
  plan: PayoffResult;
  extra: number;
  strategy: Strategy;
}): string {
  const open = cancellationOrder(plan);

  const lines = [
    `PLAN DESTRUCTOR DE DEUDAS — ${STRATEGY_LABEL[strategy]}`,
    `Extra por mes: ${formatMoney(extra)}`,
    `Quedás libre de deudas en: ${formatMonthSpan(plan.totalMonths)}`,
    `Interés total pagado: ${formatMoney(plan.totalInterest ?? 0)}`,
    "",
    "ORDEN DE CANCELACIÓN",
  ];

  open.forEach((debt, i) => {
    lines.push(
      `${i + 1}. ${debt.name} (${KIND_LABEL[debt.kind] ?? debt.kind}) — ${formatMonthSpan(debt.clearedMonth)}`
    );
    lines.push(`   libera ${formatMoney(debt.minimum)} por mes`);
  });

  lines.push("");
  lines.push("Generado con ¿Llegás? Los montos están en pesos y no incluyen decimales.");

  return lines.join("\n");
}

/**
 * El orden en que se CANCELAN, que no es el orden en que se atacan.
 *
 * El plan vuelca el pozo sobre la de tasa mas alta, pero esa suele ser la mas
 * grande y cae ultima: las chicas se apagan antes solas con su minimo. La
 * lista numerada es la del calendario real, porque es la que hace verdadera la
 * frase de cada fila — "libera $X por mes para la siguiente".
 *
 * Empate: manda el orden de ataque, que es como lo desempata el prototipo.
 */
function cancellationOrder(plan: PayoffResult) {
  return plan.debts
    .filter((d) => d.clearedMonth !== null && d.clearedMonth > 0)
    .sort((a, b) => a.clearedMonth! - b.clearedMonth! || a.order - b.order);
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
