import { notFound } from "next/navigation";
import { CashflowBoard } from "@/components/CashflowBoard";
import { Screen } from "@/components/ui";
import { severityOf, type CashflowMonth } from "@/lib/calc/cashflow";

/**
 * Banco de pruebas de la pantalla 02. Los acumulados son los que muestra el
 * prototipo (+1.5M, +0.9M, +0.3M, −0.5M, −1.6M, −2.9M), así que la rampa de
 * severidad tiene que dar los mismos seis colores que él.
 */
export const dynamic = "force-dynamic";

const CUMULATIVE = [1_500_000, 900_000, 300_000, -500_000, -1_600_000, -2_900_000];
const PERIODS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];

const INCOME = 5_500_000;
const EXPENSES = 600_000;
const DEBT_DUE = 4_600_000;

export default function CashflowPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const months: CashflowMonth[] = PERIODS.map((period, i) => {
    // El neto del primer mes es el del prototipo; los siguientes salen de la
    // diferencia entre acumulados, que es lo que hace la proyección real.
    const net = i === 0 ? INCOME - EXPENSES - DEBT_DUE : CUMULATIVE[i] - CUMULATIVE[i - 1];
    return {
      period,
      income: INCOME,
      expenses: EXPENSES,
      debtDue: INCOME - EXPENSES - net,
      net,
      cumulative: CUMULATIVE[i],
      severity: severityOf(CUMULATIVE[i]),
    };
  });

  return (
    <Screen>
      <p className="mb-4 rounded-surface border border-dashed border-border-dash px-3 py-2 text-help">
        Banco de pruebas — pantalla 02. Los acumulados son los del prototipo; el desglose de
        agosto tiene que dar $ 5.500.000 − $ 600.000 − $ 4.600.000 = $ 300.000.
      </p>

      <CashflowBoard months={months} scenarioName="Plan base" />
    </Screen>
  );
}
