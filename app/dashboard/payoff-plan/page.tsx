import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { simulatePayoff, type Strategy } from "@/lib/calc/payoff";
import { monthlyRateFromAnnual, formatMoney } from "@/lib/calc/money";
import { Card, EmptyState, PrimaryButton, Screen, Amount, MetaChip } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Extra por defecto, y las opciones que ofrece la pantalla. */
const EXTRA_OPTIONS = [0, 100_000, 300_000, 500_000, 1_000_000];

export default async function PayoffPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ extra?: string; estrategia?: string }>;
}) {
  const data = await getDashboard();
  const query = await searchParams;

  const extra = Number(query.extra ?? 300_000);
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

  const inputs = data.debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    minimum: d.minimumPayment ?? 0,
    monthlyRate: monthlyRateFromAnnual(d.annualRate),
    recurringCharge: d.recurringCharge,
  }));

  const plan = simulatePayoff({ debts: inputs, extraPerMonth: extra, strategy });
  const other = simulatePayoff({
    debts: inputs,
    extraPerMonth: extra,
    strategy: strategy === "avalancha" ? "bola_de_nieve" : "avalancha",
  });

  const missingMinimums = data.debts.filter((d) => d.minimumPayment == null).length;

  return (
    <Screen>
      <Header />

      <p className="help mt-1">
        Pagás el mínimo de todas y volcás lo que te sobra a una por vez. Cuando esa se cancela,
        su mínimo se suma al pozo y acelera la siguiente.
      </p>

      {missingMinimums > 0 && (
        <p className="mt-3 rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-2 text-[11.5px] text-gold-ink">
          {missingMinimums === 1
            ? "Una deuda no tiene mínimo cargado, así que el plan la cuenta con mínimo cero."
            : `${missingMinimums} deudas no tienen mínimo cargado, así que el plan las cuenta con mínimo cero.`}{" "}
          Cargá sus resúmenes para que el plazo sea real.
        </p>
      )}

      <section className="mt-5">
        <h2 className="text-label uppercase text-muted">Cuánto extra por mes</h2>
        <div className="no-scrollbar -mx-[18px] mt-2 overflow-x-auto px-[18px]">
          <div className="flex gap-1">
            {EXTRA_OPTIONS.map((option) => (
              <Link
                key={option}
                href={`/dashboard/payoff-plan?extra=${option}&estrategia=${strategy}`}
                scroll={false}
                className="min-h-touch shrink-0 rounded-pill px-[15px] py-[10px] font-mono text-[12px] transition-colors duration-150 ease-sd"
                style={{
                  backgroundColor: option === extra ? "#0E3A31" : "transparent",
                  color: option === extra ? "#FFFFFF" : "#5C6B65",
                  fontWeight: option === extra ? 600 : 400,
                }}
              >
                {option === 0 ? "nada" : formatMoney(option)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-label uppercase text-muted">Por dónde empezar</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <StrategyCard
            href={`/dashboard/payoff-plan?extra=${extra}&estrategia=avalancha`}
            active={strategy === "avalancha"}
            title="Avalancha"
            note="Primero la tasa más alta. Es la que menos interés paga."
          />
          <StrategyCard
            href={`/dashboard/payoff-plan?extra=${extra}&estrategia=bola_de_nieve`}
            active={strategy === "bola_de_nieve"}
            title="Bola de nieve"
            note="Primero el saldo más chico. Cancela deudas antes."
          />
        </div>
      </section>

      <Card className="mt-4 px-4 py-4">
        {plan.totalMonths === null ? (
          <>
            <div className="text-card-lg text-brick-head">A este ritmo no se termina</div>
            <p className="mt-1.5 text-[11.5px] text-brick-ink">
              Con {extra === 0 ? "solo los mínimos" : `${formatMoney(extra)} extra por mes`}, el
              interés crece más rápido de lo que baja el saldo. Probá con un extra más alto para
              ver a partir de cuánto empieza a cerrar.
            </p>
          </>
        ) : (
          <>
            <div className="text-label uppercase text-muted">Quedás libre en</div>
            <Amount className="mt-1 block text-[28px] font-semibold text-ink">
              {plan.totalMonths} {plan.totalMonths === 1 ? "mes" : "meses"}
            </Amount>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
              <span className="text-[13px] text-muted">Interés total que vas a pagar</span>
              <Amount className="text-[13px] text-ink">{formatMoney(plan.totalInterest!)}</Amount>
            </div>
            {other.totalMonths !== null && other.totalInterest !== null && (
              <p className="mt-2 text-[11.5px] text-muted">
                {comparisonSentence(plan.totalMonths, plan.totalInterest!, other.totalMonths, other.totalInterest, strategy)}
              </p>
            )}
          </>
        )}
      </Card>

      <h2 className="mt-6 text-[15px] font-semibold text-ink">El orden</h2>
      <ol className="mt-3 space-y-2">
        {plan.debts.map((debt, index) => (
          <li key={debt.id}>
            <Card className="flex items-center gap-3 px-4 py-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-mint-wash font-mono text-[12px] font-semibold text-leaf-deep"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-card text-ink">{debt.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <MetaChip>
                    {debt.clearedMonth === null
                      ? "no se cancela"
                      : debt.clearedMonth === 0
                        ? "ya está en cero"
                        : `libre en el mes ${debt.clearedMonth}`}
                  </MetaChip>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </Screen>
  );
}

/**
 * La comparación entre estrategias se dice en una frase, no en una tabla: son
 * dos números y la decisión es de la persona, no un dato para analizar.
 */
function comparisonSentence(
  months: number,
  interest: number,
  otherMonths: number,
  otherInterest: number,
  strategy: Strategy
): string {
  const otherName = strategy === "avalancha" ? "la bola de nieve" : "la avalancha";
  const interestDiff = otherInterest - interest;
  const monthDiff = otherMonths - months;

  if (interestDiff === 0 && monthDiff === 0) {
    return `Con estas deudas, ${otherName} da exactamente lo mismo.`;
  }
  if (interestDiff > 0) {
    return `Con ${otherName} pagarías ${formatMoney(interestDiff)} más de interés.`;
  }
  return `Con ${otherName} pagarías ${formatMoney(-interestDiff)} menos de interés, pero tardarías ${Math.abs(monthDiff)} ${Math.abs(monthDiff) === 1 ? "mes" : "meses"} ${monthDiff > 0 ? "más" : "menos"}.`;
}

function StrategyCard({
  href,
  active,
  title,
  note,
}: {
  href: string;
  active: boolean;
  title: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className="block rounded-surface-lg border px-3 py-3 transition-colors duration-150 ease-sd"
      style={{
        backgroundColor: active ? "#E0F4E9" : "#FFFFFF",
        borderColor: active ? "#BEE1CE" : "#DEE3DD",
      }}
    >
      <div className="text-card" style={{ color: active ? "#175F42" : "#12211D" }}>
        {title}
      </div>
      <p className="mt-1 text-[11px] leading-[1.4] text-muted">{note}</p>
    </Link>
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
      <h1 className="mt-2 text-screen text-ink">Tu plan para salir</h1>
    </>
  );
}
