import { notFound } from "next/navigation";
import Link from "next/link";
import { TotalDebtHero } from "@/components/TotalDebtHero";
import { RunwayCard } from "@/components/RunwayCard";
import { AlertsPeek } from "@/components/AlertsPeek";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DebtCard } from "@/components/DebtCard";
import { Card, Amount, EmptyState, PrimaryButton, Screen, MetaChip } from "@/components/ui";
import { formatMoney } from "@/lib/calc/money";
import { deriveBalance } from "@/lib/calc/balance";
import { explainGrowth } from "@/lib/calc/statement";

/**
 * Banco de pruebas visual. Existe solo en desarrollo: sirve para poner esta
 * pantalla al lado del prototipo y compararlas sin necesidad de una sesión.
 *
 * Usa el mismo dataset base que handoff/prototipo.html, así que las cifras
 * tienen que coincidir con las suyas al peso. Si no coinciden, el que está
 * mal es este lado.
 */
export const dynamic = "force-dynamic";

// Pagado y cuotas salen del prototipo tal cual los muestra, para poder poner
// la tarjeta al lado de la suya y comparar los porcentajes al peso.
const PROTOTYPE_DEBTS = [
  { id: "0", name: "Mastercard Banco Patagonia …4139", saldo: 3386911, tna: 83.8, min: 290017, dueDay: 10, kind: "tarjeta", paid: 954251, cuotas: 3, cuotasMonto: 433422 },
  { id: "1", name: "Mastercard Black …3311", saldo: 5806439, tna: 69.44, min: 1085218, dueDay: 7, kind: "tarjeta", paid: 4635027, cuotas: 4, cuotasMonto: 3240167 },
  { id: "2", name: "Visa Signature …2166", saldo: 30845480, tna: 98.03, min: 1300000, dueDay: 7, kind: "tarjeta", paid: 6120400, cuotas: 4, cuotasMonto: 26171896 },
  { id: "3", name: "Prestamo 2 BBVA", saldo: 5738552, tna: 74.9, min: 716569, dueDay: null, kind: "prestamo_personal", paid: 688626, cuotas: 0, cuotasMonto: 0 },
  { id: "4", name: "Prestamo 1 BBVA", saldo: 1356072, tna: 71.9, min: 262695, dueDay: null, kind: "prestamo_personal", paid: 1102431, cuotas: 0, cuotasMonto: 0 },
];

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const debts = PROTOTYPE_DEBTS.map((d) => {
    // Se pasa por deriveBalance aunque no haya pagos ni gastos: asi el banco
    // de pruebas ejercita el mismo camino que la pantalla real.
    const balance = deriveBalance(
      { id: d.id, base_balance: d.saldo, annual_interest_rate: d.tna, tem: null },
      [],
      []
    );
    return {
      ...d,
      balance,
      annualRate: d.tna,
      minimumPayment: d.min,
      monthlyDue: d.min,
      recurringCharge: 0,
      minimumPaidThisMonth: false,
      overdue: d.dueDay != null && d.dueDay < new Date().getDate(),
      paidFraction: d.paid + balance > 0 ? d.paid / (d.paid + balance) : 0,
      installmentCount: d.cuotas,
      installmentTotal: d.cuotasMonto,
      growth: explainGrowth({
        balance,
        annualRate: d.tna,
        minimumPayment: d.min,
        recurringCharge: 0,
      }),
    };
  });

  const total = debts.reduce((s, d) => s + d.balance, 0);

  return (
    <Screen>
      <p className="mb-4 rounded-surface border border-dashed border-border-dash px-3 py-2 text-help">
        Banco de pruebas — solo en desarrollo. Mismo dataset que el prototipo; el total tiene que
        dar $ 47.133.454.
      </p>

      {/*
        El encabezado va acá aunque el dataset sea falso: es la única forma de
        mirarlo sin sesión, y sus dos botones son las puertas a Ajustes y a
        Historial, que estuvieron sin puerta hasta ahora.
      */}
      <DashboardHeader
        greeting="Buenas tardes"
        dateLabel="miércoles 9 de septiembre"
        fullName="Ana Pérez"
        email="ana@ejemplo.com"
      />

      <TotalDebtHero
        total={total}
        delta={-122730}
        series={[47500000, 47390000, 47301000, 47256184, total]}
        debtCount={debts.length}
        statusLabel="todas al día"
      />

      <div className="mt-3">
        <RunwayCard
          monthLabel="octubre"
          note="Desde noviembre el saldo queda en rojo. Escenario: Plan base."
          remaining={300000}
          href="#"
        />
      </div>

      <Link
        href="#"
        className="mt-3 flex min-h-touch items-center justify-between rounded-surface bg-mint-wash px-4 py-3 text-card text-pine"
      >
        <span>Escenario: Plan base</span>
        <span aria-hidden>›</span>
      </Link>

      <div className="mt-3">
        <AlertsPeek
          count={4}
          severity="brick"
          headline="El saldo de Visa Signature sigue creciendo"
          href="#"
          action={
            <p className="mt-2 flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[15px] py-2 text-[11.5px] font-semibold text-pine">
              Pagar el mínimo de Visa Signature · $ 1.300.000
            </p>
          }
        />
      </div>

      <div className="mb-2 mt-5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Tus deudas</h2>
        <span
          className="font-mono text-[10.5px] uppercase text-muted"
          style={{ letterSpacing: ".04em" }}
        >
          al día ({debts.length})
        </span>
      </div>

      <ul className="space-y-2">
        {debts.map((debt) => (
          <li key={debt.id}>
            <DebtCard debt={debt} today={new Date()} />
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-8 text-label uppercase text-muted">Estado vacío</h2>
      <EmptyState
        title="Todavía no hay nada que simular"
        note="Cargá tu primera deuda y la app arma la proyección, las alertas y el plan desde ahí."
        action={<PrimaryButton href="#">Cargar mi primera deuda</PrimaryButton>}
      />

      <BottomNav alertCount={4} />
    </Screen>
  );
}
