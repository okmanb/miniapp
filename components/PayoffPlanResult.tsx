import { formatMonthSpan, type PayoffResult, type Strategy } from "@/lib/calc/payoff";
import { formatMoney } from "@/lib/calc/money";
import { Card, Amount } from "@/components/ui";
import { PayoffExport } from "@/components/PayoffExport";

export const KIND_LABEL: Record<string, string> = {
  tarjeta: "tarjeta de crédito",
  prestamo_personal: "préstamo personal",
  prendario: "préstamo prendario",
  hipotecario: "préstamo hipotecario",
  plan_v: "refinanciación",
  otro: "otra deuda",
};

export const STRATEGY_LABEL: Record<Strategy, string> = {
  avalancha: "Avalancha",
  bola_de_nieve: "Bola de nieve",
};

/**
 * El resultado del plan: el plazo, el interés total y el orden de cancelación.
 *
 * Es un componente y no un bloque adentro de la pantalla para que el banco de
 * pruebas lo renderice con el dataset del prototipo y se pueda comparar fila
 * por fila contra el original.
 */
export function PayoffPlanResult({
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
