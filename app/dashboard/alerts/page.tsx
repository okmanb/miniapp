import Link from "next/link";
import { getDashboard } from "@/lib/data/dashboard";
import { Card, EmptyState, PrimaryButton, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Alertas (pantalla 10).
 *
 * Se derivan del modelo en cada lectura, no salen de una tabla que alguien
 * tenga que mantener al día. Por eso no hay botón de "recalcular": si hiciera
 * falta apretarlo, la lista podría estar vieja sin que se note.
 *
 * Cada alerta lleva a la pantalla donde se resuelve. Una alerta que solo
 * informa y no ofrece a dónde ir es una preocupación sin salida, que es
 * justo lo que esta app no quiere producir.
 */

const SEVERITY = {
  brick: { bg: "#FDF0EC", border: "#EFCDC3", fg: "#B14D3B", ink: "#823123" },
  gold: { bg: "#FCF4E7", border: "#EBD9B8", fg: "#A77530", ink: "#7A5116" },
} as const;

const KIND_EXPLAINS: Record<string, string> = {
  saldo_creciente:
    "El pago del mes no alcanza a cubrir lo que la deuda genera, así que el saldo sube en vez de bajar.",
  vencimiento_hoy: "Está por vencer. Pagar después de la fecha suma punitorios sobre lo que falte.",
  tasa_mas_cara:
    "Es la que más caro te cobra por peso adeudado. Volcar acá lo que te sobre es lo que menos interés paga.",
  mes_no_reflejado:
    "El saldo real cargado no coincide con lo que la proyección esperaba para ese mes.",
};

export default async function AlertsPage() {
  const data = await getDashboard();

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Alertas</h1>
      <p className="help mt-1">
        Se recalculan solas cada vez que abrís esta pantalla, con tus deudas y el escenario
        activo.
      </p>

      {!data || data.alerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nada urgente esta semana"
            note="No hay vencimientos cerca ni saldos creciendo. Si cargás un resumen o cambia un pago, esto se actualiza solo."
            action={<PrimaryButton href="/dashboard">Volver al dashboard</PrimaryButton>}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.alerts.map((alert, i) => {
            const c = SEVERITY[alert.severity];
            const href = alert.debtId ? `/dashboard/debts/${alert.debtId}` : "/dashboard";

            return (
              <li key={`${alert.kind}-${alert.debtId ?? i}`}>
                <Link href={href} className="block">
                  <div
                    data-motion
                    className="animate-card-in rounded-surface-lg px-4 py-3 transition-opacity duration-150 ease-sd hover:opacity-90"
                    style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-card" style={{ color: c.fg }}>
                          {alert.title}
                        </div>
                        <p className="mt-1 text-[11.5px]" style={{ color: c.ink }}>
                          {KIND_EXPLAINS[alert.kind]}
                        </p>
                      </div>
                      <span className="shrink-0 text-[18px] leading-none" style={{ color: c.fg }} aria-hidden>
                        ›
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6 px-4 py-4">
        <h2 className="text-card text-ink">Qué miramos</h2>
        <ul className="mt-2 space-y-2">
          {Object.entries(KIND_EXPLAINS).map(([kind, explain]) => (
            <li key={kind} className="text-[11.5px] text-muted">
              <span className="font-mono text-[10.5px] uppercase text-ink">
                {kind.replace(/_/g, " ")}
              </span>
              <br />
              {explain}
            </li>
          ))}
        </ul>
      </Card>
    </Screen>
  );
}
