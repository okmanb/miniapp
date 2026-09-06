import Link from "next/link";
import { notFound } from "next/navigation";
import { getDebtDetail } from "@/lib/data/debt";
import { formatMoney } from "@/lib/calc/money";
import { Card, Screen, Amount, PrimaryButton, EmptyState, MetaChip } from "@/components/ui";
import { PayoffComparison } from "@/components/PayoffComparison";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  tarjeta: "Tarjeta de crédito",
  prestamo_personal: "Préstamo personal",
  prendario: "Prendario",
  hipotecario: "Hipotecario",
  plan_v: "Refinanciación",
  otro: "Otro",
};

const HEALTH: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  al_dia: { label: "Al día", bg: "#E0F4E9", fg: "#175F42", border: "#BEE1CE" },
  crece: { label: "Crece", bg: "#FFE9E4", fg: "#823123", border: "#F2C7BE" },
  sin_datos: { label: "Sin resumen", bg: "#F2F5F1", fg: "#5C6B65", border: "#DEE3DD" },
};

export default async function DebtDetailPage({ params }: { params: { id: string } }) {
  const debt = await getDebtDetail(params.id);
  if (!debt) notFound();

  const health = HEALTH[debt.health];

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a tus deudas
      </Link>

      <h1 className="mt-2 text-screen text-ink">{debt.name}</h1>
      <p className="mt-0.5 text-[12px] text-muted">{KIND_LABEL[debt.kind] ?? debt.kind}</p>

      <Card className="mt-4 px-4 py-4">
        <div className="text-label uppercase text-muted">Saldo actual</div>
        <Amount className="mt-1 block text-[28px] font-semibold text-ink">
          {formatMoney(debt.balance)}
        </Amount>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-row pt-3">
          <span className="text-card text-ink">Salud de la deuda</span>
          <span
            className="rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase"
            style={{ backgroundColor: health.bg, color: health.fg, border: `1px solid ${health.border}` }}
          >
            {health.label}
          </span>
        </div>

        {debt.growth && (
          <p className="mt-2 text-[11.5px] text-brick-ink">{growthMessage(debt)}</p>
        )}

        <dl className="mt-1">
          <DetailRow label="Tasa (TNA)" value={debt.annualRate != null ? `${debt.annualRate.toLocaleString("es-AR")}%` : "sin cargar"} />
          <DetailRow label="Próximo vencimiento" value={debt.nextDueLabel ?? "cuota fija"} />
          <DetailRow label="Interés del mes" value={formatMoney(debt.monthlyInterest)} />
          <DetailRow
            label="Mínimo del último resumen"
            value={debt.minimumPayment != null ? formatMoney(debt.minimumPayment) : "sin resumen"}
          />
        </dl>
      </Card>

      <h2 className="mt-6 text-[15px] font-semibold text-ink">Estimación de pago</h2>
      {debt.payoff ? (
        <PayoffComparison payoff={debt.payoff} />
      ) : (
        <div className="mt-3">
          <EmptyState
            title="Falta el mínimo para comparar"
            note="La comparación arranca del mínimo del resumen. Cargá un resumen de esta tarjeta y podemos decirte cuánto tardarías pagando el mínimo y cuánto pagando el doble."
            action={
              <PrimaryButton href={`/dashboard/statements/new?deuda=${debt.id}`}>
                Cargar un resumen
              </PrimaryButton>
            }
          />
        </div>
      )}

      <p className="mt-3 rounded-surface bg-surface-arch px-4 py-3 text-[11.5px] text-muted">
        Punto de equilibrio este mes: <span className="font-mono text-ink">{formatMoney(debt.breakevenAmount)}</span>{" "}
        — lo mínimo para que el saldo no siga creciendo.
      </p>

      <h2 className="mt-6 text-[15px] font-semibold text-ink">Historial de pagos</h2>
      {debt.payments.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Todavía no registraste pagos"
            note="Cada pago que cargues baja el saldo de esta deuda y queda con su fecha."
            action={
              <PrimaryButton href={`/dashboard/debts/${debt.id}/payments/new`}>
                Registrar un pago
              </PrimaryButton>
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {debt.payments.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-card text-ink">{PAYMENT_KIND[p.kind] ?? p.kind}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{p.paidOn ?? p.period}</div>
                </div>
                <Amount className="text-[15px] font-semibold text-leaf-deep">
                  −{formatMoney(p.amount)}
                </Amount>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-[15px] font-semibold text-ink">Cuotas de esta deuda</h2>
      {debt.installments.length === 0 ? (
        <p className="help mt-2">
          Esta deuda no tiene compras en cuotas cargadas. Aparecen solas al cargar un resumen que
          las traiga.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {debt.installments.map((plan) => (
            <li key={plan.id}>
              <Card className="px-4 py-3">
                <div className="text-card text-ink">{plan.description}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <MetaChip>
                    cuota {plan.current}/{plan.total}
                  </MetaChip>
                  <MetaChip>termina {plan.endsOn}</MetaChip>
                  {/*
                    Una cuota sin interés es un dato conocido (el comercio lo
                    subsidia), no un dato que falte. Por eso 0% se muestra y no
                    se esconde: es de las pocas buenas noticias de la pantalla.
                  */}
                  {plan.tna != null && (
                    <MetaChip>{plan.tna === 0 ? "sin interés" : `TNA ${plan.tna}%`}</MetaChip>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
                  <span className="text-label uppercase text-muted">
                    {plan.finished ? "Terminada" : `Quedan ${plan.remaining}`}
                  </span>
                  <Amount className="text-[15px] font-semibold text-ink">
                    {formatMoney(plan.amount)}
                  </Amount>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 space-y-2">
        <ActionLink href={`/dashboard/debts/${debt.id}/edit`}>Editar esta deuda</ActionLink>
        <ActionLink href={`/dashboard/statements/new?deuda=${debt.id}`}>Cargar un resumen</ActionLink>
      </div>
    </Screen>
  );
}

const PAYMENT_KIND: Record<string, string> = {
  cuota_fija: "Cuota fija",
  pago_variable: "Pago",
  minimo_estimado: "Mínimo del resumen",
  unico: "Pago único",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-row py-2.5 last:border-b-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd>
        <Amount className="text-[13px] text-ink">{value}</Amount>
      </dd>
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-touch items-center justify-between gap-3 rounded-surface border border-border bg-surface px-4 py-3 text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
    >
      <span>{children}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}

function growthMessage(debt: NonNullable<Awaited<ReturnType<typeof getDebtDetail>>>): string {
  const g = debt.growth!;
  switch (g.kind) {
    case "interes":
      return `El mínimo no cubre el interés de ${formatMoney(g.amount)} por mes — el saldo va a seguir creciendo.`;
    case "gastos_fijos":
      return `El mínimo cubre el interés, pero no los ${formatMoney(g.amount)} de gastos fijos que se cargan a esta tarjeta cada mes.`;
    case "minimo_insuficiente":
      return `Al mínimo le faltan ${formatMoney(g.amount)} por mes para que el saldo deje de crecer.`;
  }
}
