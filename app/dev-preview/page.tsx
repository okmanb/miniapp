import { notFound } from "next/navigation";
import Link from "next/link";
import { TotalDebtHero } from "@/components/TotalDebtHero";
import { RunwayCard } from "@/components/RunwayCard";
import { AlertsPeek } from "@/components/AlertsPeek";
import { BottomNav } from "@/components/BottomNav";
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

const PROTOTYPE_DEBTS = [
  { id: "0", name: "Mastercard Banco Patagonia …4139", saldo: 3386911, tna: 83.8, min: 290017, dueDay: 10 },
  { id: "1", name: "Mastercard Black …3311", saldo: 5806439, tna: 69.44, min: 1085218, dueDay: 7 },
  { id: "2", name: "Visa Signature …2166", saldo: 30845480, tna: 98.03, min: 1300000, dueDay: 7 },
  { id: "3", name: "Prestamo 2 BBVA", saldo: 5738552, tna: 74.9, min: 716569, dueDay: null },
  { id: "4", name: "Prestamo 1 BBVA", saldo: 1356072, tna: 71.9, min: 262695, dueDay: null },
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
        />
      </div>

      <h2 className="mb-2 mt-5 text-label uppercase text-muted">Tus deudas</h2>

      <ul className="space-y-2">
        {debts.map((debt) => (
          <li key={debt.id}>
            <Card className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-card text-ink">{debt.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <MetaChip>{debt.dueDay != null ? `vto. ${debt.dueDay}` : "cuota fija"}</MetaChip>
                    <MetaChip>TNA {debt.tna.toLocaleString("es-AR")}%</MetaChip>
                  </div>
                </div>
                <Amount className="shrink-0 text-card-lg text-ink">
                  {formatMoney(debt.balance)}
                </Amount>
              </div>
              {debt.growth && (
                <p className="mt-2 border-t border-border-row pt-2 text-[11.5px] text-brick-ink">
                  {debt.growth.kind === "interes"
                    ? `El mínimo no cubre el interés de ${formatMoney(debt.growth.amount)} por mes — el saldo va a seguir creciendo.`
                    : `Al mínimo le faltan ${formatMoney(debt.growth.amount)} por mes para que el saldo deje de crecer.`}
                </p>
              )}
            </Card>
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
