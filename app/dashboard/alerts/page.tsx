import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { nextDueDate, type AlertDebt } from "@/lib/calc/alerts";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { EmptyState, PrimaryButton, Screen, Chevron } from "@/components/ui";
import { AlertCard, SnoozedRow } from "@/components/AlertCard";
import { AlertSettingsPanel, type UpcomingNotice } from "@/components/AlertSettingsPanel";

export const dynamic = "force-dynamic";

/**
 * Alertas (pantalla 10).
 *
 * Se derivan del modelo en cada lectura, no salen de una tabla que alguien
 * tenga que mantener al día. Por eso no hay botón de "recalcular": el
 * prototipo lo tiene porque ahí las alertas viven en un estado que se llena a
 * pedido, y acá se calculan al abrir. Un botón que no cambia nada sería peor
 * que no tenerlo, porque enseñaría a desconfiar de la lista.
 *
 * Cada alerta lleva su cifra y el lugar donde se resuelve. Una alerta que solo
 * informa y no ofrece a dónde ir es una preocupación sin salida, que es justo
 * lo que esta app no quiere producir.
 */

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function shortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}-${MONTHS_SHORT[date.getMonth()]}`;
}

export default async function AlertsPage() {
  const data = await getDashboard();

  if (!data) {
    return (
      <Screen>
        <Header />
        <div className="mt-4">
          <EmptyState
            title="Todavía no hay nada que mirar"
            note="Las alertas salen de tus deudas y de la proyección del escenario activo. Con cargar una deuda ya empiezan a tener de dónde salir."
            action={<PrimaryButton href="/dashboard/debts/new">Cargar una deuda</PrimaryButton>}
          />
        </div>
      </Screen>
    );
  }

  const now = new Date();

  // Los avisos que saldrían con la anticipación elegida, ordenados por
  // vencimiento. Son los mismos vencimientos que agrupa la alerta de arriba,
  // vistos como calendario en vez de como resumen.
  const upcoming: UpcomingNotice[] = data.debts
    .map((debt) => {
      const alertDebt: AlertDebt = {
        id: debt.id,
        name: debt.name,
        kind: debt.kind,
        balance: debt.balance,
        annualRate: debt.annualRate,
        monthlyRate: monthlyRateFromAnnual(debt.annualRate),
        dueDay: debt.dueDay,
        minimumPayment: debt.minimumPayment,
      };
      const due = nextDueDate(alertDebt, now);
      if (!due || debt.balance <= 0) return null;

      const noticeAt = new Date(due.getTime() - data.alertSettings.leadDays * 86_400_000);
      const late = noticeAt.getTime() <= now.getTime();
      const isToday = noticeAt.toDateString() === now.toDateString();

      return {
        debtId: debt.id,
        debtName: debt.name,
        dueLabel: shortDate(due),
        amount: debt.minimumPayment ?? 0,
        noticeLabel: late ? "ahora" : isToday ? "hoy" : shortDate(noticeAt),
        late,
        sortKey: due.getTime(),
      };
    })
    .filter((n): n is UpcomingNotice & { sortKey: number } => n !== null)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ sortKey, ...rest }) => rest);

  return (
    <Screen>
      <Header />

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
          Qué detectamos solo
          <Chevron className="group-open:rotate-180" />
        </summary>
        {/*
          Nombrar las que NO se calculan solas es parte del contrato. La lista
          anterior de esta pantalla anunciaba "mes no reflejado" como si la
          app lo mirara, y no lo miraba: el tipo existía en el enum y nunca se
          emitía.
        */}
        <p className="help mt-1">
          Escenario: {data.scenarioName}. Solo se calculan solas el saldo que crece, los
          vencimientos apilados, el mes en que la caja no cierra, el peso de las cuotas fijas y
          la deuda más cara. El resto —doble conteo, gasto no capturado, mes no reflejado— hay
          que detectarlas a ojo por ahora.
        </p>
      </details>

      <AlertSettingsPanel
        initial={data.alertSettings}
        debts={data.debts.map((d) => ({ id: d.id, name: d.name }))}
        upcoming={upcoming}
      />

      <SnoozedRow count={data.snoozedCount} />

      {data.alerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={data.snoozedCount > 0 ? "Nada activo ahora mismo" : "Nada urgente esta semana"}
            note={
              data.snoozedCount > 0
                ? "Lo que había está pospuesto. Vuelve solo cuando se cumpla el plazo."
                : "No hay vencimientos cerca ni saldos creciendo. Si cargás un resumen o cambia un pago, esto se actualiza solo."
            }
            action={<PrimaryButton href="/dashboard">Volver al dashboard</PrimaryButton>}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.alerts.map((alert) => (
            <li key={`${alert.kind}:${alert.subjectId}`}>
              <AlertCard alert={alert} />
            </li>
          ))}
        </ul>
      )}
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
      <h1 className="mt-2 text-screen text-ink">Alertas</h1>
    </>
  );
}
