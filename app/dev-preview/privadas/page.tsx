import { notFound } from "next/navigation";
import { DebtDetailView } from "@/components/DebtDetailView";
import { PaymentsHistory } from "@/components/PaymentsHistory";
import { SettingsView } from "@/components/SettingsView";
import { ExpenseForm } from "@/components/ExpenseForm";
import { currentPeriod } from "@/lib/data/dashboard";
import type { DebtDetail } from "@/lib/data/debt";

/**
 * Las cuatro pantallas que hasta ahora no se podían mirar sin sesión: 03
 * (detalle de deuda), 05 (agregar gasto), 15 (historial de pagos) y 16
 * (ajustes).
 *
 * Existen acá por una razón concreta. Las otras doce tenían banco de pruebas y
 * se compararon contra el prototipo; estas cuatro no, y el resultado se vio: la
 * 06 se quedó con el `<input type="file">` crudo después de que se arreglara el
 * del alta de la tarjeta, y la 16 —la única con "Cerrar sesión"— estuvo sin
 * puerta de entrada sin que nadie lo notara.
 *
 * El dataset es el del prototipo, así que las cifras tienen que coincidir con
 * las suyas. Si no coinciden, el que está mal es este lado.
 */
export const dynamic = "force-dynamic";

const DEBT: DebtDetail = {
  id: "0",
  name: "Mastercard Banco Patagonia …4139",
  kind: "tarjeta",
  balance: 3386911,
  annualRate: 83.8,
  monthlyInterest: 236519,
  minimumPayment: 290017,
  breakevenAmount: 236519,
  dueDay: 10,
  nextDueLabel: "10 de septiembre de 2026",
  recurringCharge: 0,
  health: "al_dia",
  growth: null,
  // Las cifras del prototipo: 26 meses al mínimo para la Patagonia.
  payoff: {
    minimum: { label: "mínimo", monthlyPayment: 290017, months: 26, totalInterest: 2402561 },
    double: { label: "el doble", monthlyPayment: 580034, months: 8, totalInterest: 743812 },
    savings: 1658749,
  },
  installments: [],
  payments: [
    { id: "p1", amount: 290017, period: "2026-08", paidOn: "2026-08-10", kind: "minimo_estimado", note: null },
    { id: "p2", amount: 664234, period: "2026-07", paidOn: "2026-07-10", kind: "pago_variable", note: null },
  ],
};

const PAYMENTS = [
  { id: "p1", amount: 290017, period: currentPeriod(), paidOn: "2026-09-08", kind: "minimo_estimado", debtName: "Mastercard Banco Patagonia …4139" },
  { id: "p2", amount: 1085218, period: currentPeriod(), paidOn: "2026-09-07", kind: "minimo_estimado", debtName: "Mastercard Black …3311" },
  { id: "p3", amount: 664234, period: "2026-08", paidOn: "2026-08-10", kind: "pago_variable", debtName: "Mastercard Banco Patagonia …4139" },
  { id: "p4", amount: 262695, period: "2026-08", paidOn: "2026-08-05", kind: "cuota_fija", debtName: "Prestamo 1 BBVA" },
];

const CARDS = [
  { id: "0", name: "Mastercard Banco Patagonia …4139" },
  { id: "1", name: "Mastercard Black …3311" },
  { id: "2", name: "Visa Signature …2166" },
];

export default function PrivateScreensPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <p className="mx-[18px] mt-4 rounded-surface border border-dashed border-border-dash px-3 py-2 text-help">
        Banco de pruebas — solo en desarrollo. Las cuatro pantallas que necesitan sesión, con
        el dataset del prototipo.
      </p>

      <Rotulo>03 · Detalle de deuda</Rotulo>
      <DebtDetailView debt={DEBT} />

      <Rotulo>05 · Agregar gasto</Rotulo>
      <div className="px-[18px]">
        <h1 className="text-screen text-ink">Agregar gasto</h1>
        <ExpenseForm cards={CARDS} />
      </div>

      <Rotulo>15 · Historial de pagos</Rotulo>
      <PaymentsHistory rows={PAYMENTS} />

      <Rotulo>16 · Ajustes</Rotulo>
      <SettingsView
        displayName="Ana Pérez"
        email="ana@ejemplo.com"
        scenarioName="Plan base"
        counts={{ debts: 5, payments: 4, incomes: 1, expenses: 3 }}
      />
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-[18px] mb-1 mt-10 border-t border-border pt-6 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
      {children}
    </h2>
  );
}
