import { notFound } from "next/navigation";
import { simulatePayoff } from "@/lib/calc/payoff";
import { monthlyRateFromAnnual, formatMoney } from "@/lib/calc/money";
import { viewInstallmentPlan, type InstallmentPlanRow } from "@/lib/calc/installments";
import { bridgeCost, compareAgainstWorstDebt } from "@/lib/calc/bridge";
import { severityOf, type CashflowMonth, type CashflowResult } from "@/lib/calc/cashflow";
import type { DerivedAlert } from "@/lib/calc/alerts";
import { Screen, Card, Amount } from "@/components/ui";
import { PayoffPlanResult } from "@/components/PayoffPlanResult";
import { InstallmentGroup } from "@/components/InstallmentGroup";
import { AlertCard, SnoozedRow } from "@/components/AlertCard";
import { BridgeLoanCard } from "@/components/BridgeLoanCard";
import { ScenarioComparison } from "@/components/ScenarioComparison";
import { DebtForm } from "@/components/DebtForm";
import { StatementForm } from "@/components/StatementForm";
import { ToastDemo } from "../ToastDemo";
import { ToastHost } from "@/components/Toast";

/**
 * Banco de pruebas de las pantallas 04, 06 y 07 a 11.
 *
 * Existe solo en desarrollo y sirve para una cosa: poner cada bloque nuevo al
 * lado del prototipo renderizado y compararlos sin necesidad de una sesión ni
 * de datos cargados. Las cifras son las del dataset base del prototipo, así
 * que tienen que coincidir con las suyas al peso — y donde no coincidan, el
 * que está mal es este lado.
 */
export const dynamic = "force-dynamic";

const DEBTS = [
  { id: "0", name: "Mastercard Banco Patagonia …4139", kind: "tarjeta", balance: 3386911, minimum: 290017, tna: 83.8 },
  { id: "1", name: "Mastercard Black …3311", kind: "tarjeta", balance: 5806439, minimum: 1085218, tna: 69.44 },
  { id: "2", name: "Visa Signature …2166", kind: "tarjeta", balance: 30845480, minimum: 1300000, tna: 98.03 },
  { id: "3", name: "Prestamo 2 BBVA", kind: "prestamo_personal", balance: 5738552, minimum: 716569, tna: 74.9 },
  { id: "4", name: "Prestamo 1 BBVA", kind: "prestamo_personal", balance: 1356072, minimum: 262695, tna: 71.9 },
];

/** Los seis acumulados del gráfico del prototipo, con su neto derivado. */
const CUMULATIVE = [1_500_000, 900_000, 300_000, -500_000, -1_600_000, -2_900_000];
const PERIODS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];

function months(cumulative: number[], start: number): CashflowMonth[] {
  return PERIODS.map((period, i) => {
    const net = cumulative[i] - (i === 0 ? start : cumulative[i - 1]);
    return {
      period,
      income: 5_500_000,
      expenses: 600_000,
      debtDue: 5_500_000 - 600_000 - net,
      bridgeIn: 0,
      bridgeDue: 0,
      net,
      cumulative: cumulative[i],
      severity: severityOf(cumulative[i]),
    };
  });
}

function result(cumulative: number[], start: number): CashflowResult {
  const list = months(cumulative, start);
  let runwayIndex = -1;
  list.forEach((m, i) => {
    if (m.cumulative >= 0) runwayIndex = i;
  });
  return {
    months: list,
    runwayIndex,
    firstGapIndex: list.findIndex((m) => m.cumulative < 0),
    remainingAtRunway: runwayIndex >= 0 ? list[runwayIndex].cumulative : list[0].cumulative,
  };
}

const BASE = result(CUMULATIVE, 1_200_000);
const CONTINGENCY = result([3_450_000, 3_100_000, 2_800_000, 2_550_000, 2_900_000, 3_400_000], 1_200_000);

/**
 * Las cuatro compras en cuotas de la Patagonia en el prototipo, con los meses
 * elegidos para que en septiembre de 2026 caigan en la misma cuota que muestra
 * él: 9/18, 2/6, 3/6 y una terminada. Los saldos tienen que dar $ 210.400,
 * $ 125.243, $ 97.779 y $ 0 — $ 433.422 en total.
 */
const PLANS: InstallmentPlanRow[] = [
  { id: "a", description: "Refinanciación (cupón 288032)", cupon: "288032", first_period: "2026-01", total_installments: 18, installment_amount: 31595, tna: 98.03 },
  { id: "b", description: "Cuota — MERPAGO*AGEA (cupón 508398)", cupon: "508398", first_period: "2026-08", total_installments: 6, installment_amount: 25049, tna: 0 },
  { id: "c", description: "Cuota — FARMACITY (cupón 471203)", cupon: "471203", first_period: "2026-07", total_installments: 6, installment_amount: 24445, tna: 0 },
  { id: "d", description: "Cuota — MERPAGO*CARONEGM (282179)", cupon: "282179", first_period: "2026-06", total_installments: 3, installment_amount: 24000, tna: 0 },
];

const ALERTS: DerivedAlert[] = [
  {
    kind: "saldo_creciente",
    subjectId: "2",
    severity: "brick",
    icon: "↗",
    title: "El saldo de Visa Signature sigue creciendo",
    body: "El mínimo del resumen no alcanza a cubrir el interés del mes, así que la diferencia se suma al saldo.",
    metricLabel: "Punto de equilibrio",
    metricValue: 2_519_819,
    ctaLabel: "Ver la deuda",
    href: "#",
    debtId: "2",
  },
  {
    kind: "vencimiento_hoy",
    subjectId: "-",
    severity: "gold",
    icon: "⏱",
    title: "3 vencimientos en 3 días",
    body: "Mastercard Black, Visa Signature, Mastercard Banco Patagonia — entre el 07-sep y el 10-sep.",
    metricLabel: "Total a cubrir",
    metricValue: 2_675_235,
    ctaLabel: "Ver flujo de caja",
    href: "#",
    debtId: null,
  },
  {
    kind: "mes_no_cierra",
    subjectId: "-",
    severity: "brick",
    icon: "↘",
    title: "En noviembre el mes no cierra",
    body: "Con el plan base, el colchón queda en negativo después de pagar los vencimientos de ese mes.",
    metricLabel: "Faltan",
    metricValue: 500_000,
    ctaLabel: "Ver flujo de caja",
    href: "#",
    debtId: null,
  },
  {
    kind: "tasa_mas_cara",
    subjectId: "2",
    severity: "gold",
    icon: "%",
    title: "Tu deuda más cara está al 98,03% TNA",
    body: "Visa Signature es la primera que conviene atacar si te sobra algo este mes.",
    metricLabel: "Mínimo",
    metricValue: 1_300_000,
    ctaLabel: "Ver la deuda",
    href: "#",
    debtId: "2",
  },
];

export default function ScreensPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const plan = simulatePayoff({
    debts: DEBTS.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      balance: d.balance,
      minimum: d.minimum,
      monthlyRate: monthlyRateFromAnnual(d.tna),
      recurringCharge: 0,
    })),
    extraPerMonth: 500_000,
    strategy: "avalancha",
  });

  const period = "2026-09";
  const plans = PLANS.map((p) => viewInstallmentPlan(p, period));
  const active = plans.filter((p) => !p.finished);
  const financed = active.filter((p) => (p.tna ?? 0) > 0).sort((a, b) => (b.tna ?? 0) - (a.tna ?? 0));
  const free = active.filter((p) => (p.tna ?? 0) <= 0);

  const worstMonthlyRate = monthlyRateFromAnnual(98.03);
  const cost = bridgeCost({ amount: 800_000, months: 1, ratePercent: 5 });
  const comparison = compareAgainstWorstDebt({
    amount: 800_000,
    months: 1,
    worstMonthlyRate,
    bridgeInterest: cost.interest,
  });

  return (
    <Screen>
      <Note>
        Banco de pruebas — pantallas 07 a 11. Dataset del prototipo: el plan tiene que dar 2 años
        y 7 meses con {formatMoney(78_862_408)} de interés, las cuotas {formatMoney(433_422)} de
        saldo total, y el puente {formatMoney(25_353)} de ahorro.
      </Note>

      <Section title="04 · Editar deuda">
        <DebtForm
          initial={{
            id: "preview",
            name: "Prestamo 2 BBVA",
            kind: "prestamo_personal",
            baseBalance: 5_738_552,
            annualRate: 74.9,
            monthlyPayment: 716_569,
            dueDay: null,
            installmentsTotal: 24,
            installmentsPaid: 7,
          }}
        />
      </Section>

      <Section title="El toast (no es una pantalla del prototipo, es su aviso)">
        <ToastDemo />
      </Section>

      <Section title="04 · Agregar deuda — tarjeta nueva">
        <DebtForm />
      </Section>

      <Section title="06 · Resumen del mes">
        <StatementForm
          cards={[
            {
              id: "0",
              name: "Mastercard Banco Patagonia …4139",
              balance: 3_386_911,
              monthlyRate: monthlyRateFromAnnual(83.8),
              // Con dólares convertidos el mes anterior, para que el aviso del
              // doble conteo se pueda mirar acá. Sin esto no lo vería nadie:
              // solo aparece con un resumen previo que los haya convertido.
              lastUsd: { period: "2026-07", balance: 20.24, rate: 1480 },
            },
          ]}
          defaultDebtId="0"
          defaultPeriod="2026-08"
        />
        <p className="help mt-2">
          El prototipo muestra, con la Patagonia: saldo anterior $ 3.386.911, interés del mes
          $ 236.519 y nuevo saldo $ 3.623.430 (+236.519).
        </p>
      </Section>

      <Section title="07 · Escenarios — comparación">
        <ScenarioComparison
          scenarios={[
            {
              id: "base",
              name: "Plan base",
              isActive: true,
              canProject: true,
              firstGapMonth: "noviembre",
              worstCushion: Math.min(...BASE.months.map((m) => m.cumulative)),
              finalCushion: BASE.months[5].cumulative,
              finalMonth: "enero",
              averageNet: BASE.months.reduce((s, m) => s + m.net, 0) / 6,
            },
            {
              id: "conting",
              name: "Plan de contingencia",
              isActive: false,
              canProject: true,
              firstGapMonth: null,
              worstCushion: Math.min(...CONTINGENCY.months.map((m) => m.cumulative)),
              finalCushion: CONTINGENCY.months[5].cumulative,
              finalMonth: "enero",
              averageNet: CONTINGENCY.months.reduce((s, m) => s + m.net, 0) / 6,
            },
          ]}
        />
        <p className="help mt-2">
          El prototipo muestra: noviembre / ninguno · −$ 2.900.000 / $ 2.550.000 · −$ 2.900.000 /
          $ 3.400.000 · −$ 683.333 / $ 366.667.
        </p>
      </Section>

      <Section title="08 · Plan destructor — resultado">
        <PayoffPlanResult plan={plan} extra={500_000} strategy="avalancha" />
      </Section>

      <Section title="09 · Cuotas">
        <div className="grid grid-cols-2 gap-2">
          <Card className="px-3 py-3">
            <Amount className="block text-[20px] font-semibold text-ink">{active.length}</Amount>
            <div className="mt-0.5 text-[10.5px] text-muted">compras activas</div>
          </Card>
          <Card className="px-3 py-3">
            <Amount className="block text-[20px] font-semibold text-ink">
              {formatMoney(active.reduce((s, p) => s + p.balance, 0))}
            </Amount>
            <div className="mt-0.5 text-[10.5px] text-muted">saldo total</div>
          </Card>
        </div>
        <InstallmentGroup
          title="Con costo financiero"
          count={financed.length}
          hint="mayor a menor tasa"
          note="Mismo criterio que tu Plan destructor (avalancha): atacá primero la de tasa más alta."
          plans={financed}
        />
        <InstallmentGroup title="Sin costo financiero" count={free.length} plans={free} />
        <InstallmentGroup
          title="Terminadas"
          count={plans.length - active.length}
          plans={plans.filter((p) => p.finished)}
        />
      </Section>

      <Section title="10 · Alertas">
        <SnoozedRow count={2} />
        <ul className="mt-3 space-y-2">
          {ALERTS.map((alert) => (
            <li key={alert.kind}>
              <AlertCard alert={alert} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="11 · Préstamos puente">
        <div className="space-y-2">
          <BridgeLoanCard
            loan={{
              id: "x",
              lender: "Mi viejo",
              amount: 800_000,
              months: 1,
              ratePercent: 5,
              interest: cost.interest,
              total: cost.total,
              isTaken: false,
              repayLabel: "octubre 2026",
              note: null,
              saving: comparison.saving,
              worstDebtName: "Visa Signature …2166",
            }}
          />
          <BridgeLoanCard
            loan={{
              id: "y",
              lender: "Adelanto del trabajo",
              amount: 800_000,
              months: 1,
              ratePercent: null,
              interest: 0,
              total: 800_000,
              isTaken: true,
              repayLabel: "octubre 2026",
              note: "Se descuenta del sueldo de octubre",
              saving: comparison.alternativeInterest,
              worstDebtName: "Visa Signature …2166",
            }}
          />
        </div>
      </Section>

      {/* El host, una vez. Sin esto los botones de arriba no muestran nada. */}
      <ToastHost />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border-dash pt-4">
      <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-surface border border-dashed border-border-dash px-3 py-2 text-help">
      {children}
    </p>
  );
}
