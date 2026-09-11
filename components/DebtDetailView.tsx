import Link from "next/link";
import { formatMoney, formatRate } from "@/lib/calc/money";
import { formatIsoDate, formatPeriodLong } from "@/lib/calc/dates";
import { Card, Screen, Amount, PrimaryButton, EmptyState } from "@/components/ui";
import { PayoffComparison } from "@/components/PayoffComparison";
import type { DebtDetail } from "@/lib/data/debt";

/**
 * El cuerpo de la pantalla 03. Vive aparte de la página para que el banco de
 * pruebas pueda montarla sin sesión: mientras el markup estaba adentro de un
 * componente que empieza consultando la base, la única forma de mirar esta
 * pantalla era iniciando sesión, y por eso pasó tanto tiempo sin que nadie la
 * comparara contra el prototipo.
 */

const KIND_LABEL: Record<string, string> = {
  tarjeta: "Tarjeta de crédito",
  prestamo_personal: "Préstamo personal",
  prendario: "Prendario",
  hipotecario: "Hipotecario",
  plan_v: "Refinanciación",
  otro: "Otro",
};

/**
 * Solo la etiqueta. Sobre la tarjeta pine el globo es siempre el mismo blanco
 * al 18% —así lo dibuja el prototipo—, y tres colores distintos ahí competirían
 * con el fondo en vez de decir algo: lo que informa es la palabra.
 */
const HEALTH: Record<string, { label: string }> = {
  al_dia: { label: "Al día" },
  en_mora: { label: "En mora" },
  crece: { label: "Crece" },
  sin_datos: { label: "Sin resumen" },
};

export function DebtDetailView({ debt }: { debt: DebtDetail }) {
  const health = HEALTH[debt.health];

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a tus deudas
      </Link>

      {/*
        Dos tarjetas y no una, como el prototipo. La blanca es identidad y
        saldo; la pine es diagnóstico. Iban juntas en una sola tarjeta blanca,
        y ahí las cuatro filas de la salud se leían con el mismo peso que el
        saldo, cuando son otra cosa: el saldo es el dato y la salud es la
        lectura del dato.
      */}
      <div className="mt-4 rounded-[16px] border border-border bg-surface p-4 shadow-card">
        <div className="text-[15px] font-semibold leading-[1.3] text-ink">{debt.name}</div>
        <div className="mt-[3px] text-[11px] text-muted">{KIND_LABEL[debt.kind] ?? debt.kind}</div>

        <div className="mt-[14px] flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-[13px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
            Saldo actual
          </span>
          <Amount className="whitespace-nowrap text-[21px] font-semibold text-ink">
            {formatMoney(debt.balance)}
          </Amount>
        </div>
      </div>

      <div
        className="mt-[14px] rounded-[16px] p-[17px] text-white"
        style={{
          background: "linear-gradient(160deg,#0E3A31,#134A3E)",
          boxShadow: "0 18px 34px -16px rgba(14,58,49,.5)",
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <h2 className="text-[15px] font-bold">Salud de la deuda</h2>
          <span
            className="rounded-pill px-[11px] py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ backgroundColor: "rgba(255,255,255,.18)" }}
          >
            {health.label}
          </span>
        </div>

        {debt.growth && (
          <p className="mt-2 text-[11.5px] leading-[1.45]" style={{ color: "#F0B0A0" }}>
            {growthMessage(debt)}
          </p>
        )}

        <dl>
          <DetailRow label="Tasa (TNA)" value={debt.annualRate != null ? formatRate(debt.annualRate) : "sin cargar"} />
          <DetailRow label="Próximo vencimiento" value={debt.nextDueLabel ?? "cuota fija"} />
          <DetailRow label="Interés del mes" value={formatMoney(debt.monthlyInterest)} />
          <DetailRow
            label="Mínimo del último resumen"
            value={debt.minimumPayment != null ? formatMoney(debt.minimumPayment) : "sin resumen"}
          />
        </dl>
      </div>

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
              <PrimaryButton href={`/dashboard/payments/new?deuda=${debt.id}`}>
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
                  {/*
                    Acá va la fecha entera, a diferencia de la 15, que muestra
                    solo el día: esta lista no agrupa por mes, así que un "Día
                    7" suelto no diría de qué mes. Antes salía la ISO cruda
                    —"2026-08-10"—, que es la fecha sin traducir.
                  */}
                  <div className="mt-0.5 text-[11px] text-muted">
                    {p.paidOn ? formatIsoDate(p.paidOn) : formatPeriodLong(p.period)}
                  </div>
                </div>
                <Amount className="text-[15px] font-semibold text-leaf-deep">
                  −{formatMoney(p.amount)}
                </Amount>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/*
        La puerta al historial filtrado por esta deuda, que es del prototipo.
        Sin ella el chip de la 15 no tendría desde dónde aparecer: el filtro
        existía en el prototipo y acá no, justamente porque faltaba esto.
      */}
      {debt.payments.length > 0 && (
        <Link
          href={`/dashboard/payments?deuda=${debt.id}`}
          className="mt-3 inline-flex min-h-touch items-center gap-1.5 text-[12.5px] font-semibold text-pine transition-colors duration-150 ease-sd hover:text-leaf"
        >
          {debt.payments.length === 1
            ? "Ver el pago en el historial"
            : `Ver los ${debt.payments.length} pagos en el historial`}
          <span aria-hidden>→</span>
        </Link>
      )}

      {/*
        Las cuotas tienen pantalla propia: cada compra es su propia deuda, con
        su plazo y su tasa, y listarlas acá abajo del historial de pagos las
        mezclaba con el ritmo del saldo de la tarjeta, que es otro.
      */}
      <div className="mt-6 space-y-2">
        <ActionLink href={`/dashboard/debts/${debt.id}/edit`}>Editar esta deuda</ActionLink>
        <ActionLink href={`/dashboard/debts/${debt.id}/cuotas`}>
          Ver cuotas de esta deuda
          {debt.installments.length > 0 ? ` (${debt.installments.length})` : ""}
        </ActionLink>
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

/**
 * Fila de la tarjeta pine: etiqueta arriba y valor abajo, alineado a la
 * derecha. No es que se parta por falta de lugar — es el molde del prototipo.
 * "10 de septiembre de 2026" al lado de su etiqueta no entra en un teléfono
 * angosto, y en cuanto una fila se parte, la columna de valores deja de
 * existir; poniéndolos todos abajo, la columna se sostiene siempre.
 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[rgba(255,255,255,.14)] py-3">
      <dt className="text-[12px] opacity-75">{label}</dt>
      <dd>
        <Amount className="mt-1 block whitespace-nowrap text-right text-[15px] font-semibold">
          {value}
        </Amount>
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

function growthMessage(debt: DebtDetail): string {
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
