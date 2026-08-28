/**
 * Motor de cálculo sobre debt_schedule_entries — reemplaza el
 * supuesto de "cuota fija para siempre" por los tres tipos de pago
 * reales del spec (§1, §3): cuota_fija, pago_variable, minimo_estimado.
 *
 * No reemplaza lib/debt-engine/index.ts: ese archivo sigue siendo
 * dueño de la amortización francesa/UVA analítica para deudas con
 * plazo fijo conocido (personal_loan, plan_v, mortgage, prendario) —
 * acá solo se usa esa lógica como UNA de las formas de rellenar un
 * mes futuro sin entry cargada. Este archivo agrega lo que faltaba:
 * tarjetas/deudas revolving donde el pago de cada mes no se puede
 * derivar de una fórmula de amortización fija.
 */

import { calculateFixedInstallment } from "./index";

export type ScheduleKind = "cuota_fija" | "pago_variable" | "minimo_estimado" | "unico";

export interface DebtScheduleEntry {
  id: string;
  debt_id: string;
  month: string; // "YYYY-MM-01" o "YYYY-MM", se normaliza igual
  amount: number;
  kind: ScheduleKind;
  is_estimate: boolean;
  note: string | null;
}

// ------------------------------------------------------------
// a) Pago mínimo de tarjeta — fórmula real de tarjetas argentinas
// (spec §3b). Configurable por tarjeta vía debts.min_payment_formula;
// el default de acá es el que usa la mayoría de los bancos.
// ------------------------------------------------------------

export interface MinPaymentFormulaConfig {
  pct_interes_periodo: number;
  pct_1_pago: number;
  pct_saldo_financiado: number;
  pct_2_6_cuotas: number;
  pct_7_mas_cuotas: number;
  pct_adelantos: number;
  pct_minimo_impago: number;
  pct_exceso_limite: number;
}

export const DEFAULT_MIN_PAYMENT_FORMULA: MinPaymentFormulaConfig = {
  pct_interes_periodo: 1.0,
  pct_1_pago: 0.1,
  pct_saldo_financiado: 0.1,
  pct_2_6_cuotas: 0.25,
  pct_7_mas_cuotas: 0.5,
  pct_adelantos: 1.0,
  pct_minimo_impago: 1.0,
  pct_exceso_limite: 1.0,
};

export interface MinPaymentComponents {
  interesYCargosDelPeriodo: number;
  consumosEn1Pago: number;
  saldoFinanciado: number;
  comprasEn2a6Cuotas: number;
  comprasEn7MasCuotas: number;
  adelantosEnEfectivo: number;
  minimoAnteriorImpago: number;
  excesoSobreLimite: number;
}

// Uso previsto: cuando el usuario carga el detalle real de un
// resumen (igual que hoy hace en la pantalla de "cargar resumen").
// Devuelve el mínimo exacto según la letra chica del banco.
export function calculateMinimumPayment(
  components: MinPaymentComponents,
  formula: MinPaymentFormulaConfig = DEFAULT_MIN_PAYMENT_FORMULA
): number {
  return (
    formula.pct_interes_periodo * components.interesYCargosDelPeriodo +
    formula.pct_1_pago * components.consumosEn1Pago +
    formula.pct_saldo_financiado * components.saldoFinanciado +
    formula.pct_2_6_cuotas * components.comprasEn2a6Cuotas +
    formula.pct_7_mas_cuotas * components.comprasEn7MasCuotas +
    formula.pct_adelantos * components.adelantosEnEfectivo +
    formula.pct_minimo_impago * components.minimoAnteriorImpago +
    formula.pct_exceso_limite * components.excesoSobreLimite
  );
}

// ------------------------------------------------------------
// c) Punto de equilibrio (breakeven) — spec §3c: lo mínimo que hay
// que pagar por mes para que el saldo de una deuda DEJE de crecer.
// Se muestra siempre al lado de la proyección.
// ------------------------------------------------------------
export function calculateBreakeven(params: {
  balance: number;
  monthlyRate: number;
  estimatedNewSpend?: number;
}): number {
  return params.balance * params.monthlyRate + (params.estimatedNewSpend ?? 0);
}

// ------------------------------------------------------------
// d) Comparación de escenarios de pago — spec §3d: "si pagás $X/mes,
// te lleva Y meses cancelarla", para varios montos candidatos.
// ------------------------------------------------------------
export interface PayoffScenario {
  monthlyPayment: number;
  monthsToPayoff: number | null; // null = a ese ritmo nunca se cancela
  totalInterestPaid: number | null;
}

export function compareFixedPaymentScenarios(params: {
  balance: number;
  monthlyRate: number;
  candidatePayments: number[];
  maxMonths?: number;
}): PayoffScenario[] {
  const maxMonths = params.maxMonths ?? 600; // 50 años, tope de seguridad

  return params.candidatePayments.map((monthlyPayment) => {
    // Si el pago ni siquiera cubre el interés del primer mes, el
    // saldo va a crecer para siempre — no simular, responder directo.
    if (monthlyPayment <= params.balance * params.monthlyRate) {
      return { monthlyPayment, monthsToPayoff: null, totalInterestPaid: null };
    }

    let balance = params.balance;
    let totalInterest = 0;
    let months = 0;

    while (balance > 0.01 && months < maxMonths) {
      const interest = balance * params.monthlyRate;
      totalInterest += interest;
      balance += interest;
      balance -= Math.min(monthlyPayment, balance);
      months++;
    }

    return {
      monthlyPayment,
      monthsToPayoff: balance <= 0.01 ? months : null,
      totalInterestPaid: balance <= 0.01 ? Math.round(totalInterest) : null,
    };
  });
}

// ------------------------------------------------------------
// a) Proyección mes a mes de una deuda con pagos mixtos (spec §3a):
//    saldo_mes_siguiente = saldo + saldo*TEM + consumo_nuevo - pago
//
// Para cada mes: si hay un debt_schedule_entries cargado (real o
// estimado a mano), se usa tal cual — es dato de mayor confianza que
// cualquier proyección nuestra. Para meses futuros sin entry,
// rellenamos según el ÚLTIMO tipo de pago conocido:
//   - cuota_fija: se mantiene el mismo monto (por definición no
//     cambia mes a mes en sistema francés).
//   - pago_variable: no hay forma de adivinarlo — se repite el
//     último monto cargado, marcado is_estimate=true, hasta que el
//     usuario cargue el real.
//   - minimo_estimado: se recalcula como interés del período +
//     margen (margen = lo que el usuario venía pagando por encima
//     del interés puro en la última entry real). Es una
//     aproximación deliberada: la fórmula exacta del banco (§3b)
//     necesita el detalle línea por línea del resumen, que no vive
//     en debt_schedule_entries — cuando el usuario carga un resumen
//     real, esa entry reemplaza a la proyectada.
// ------------------------------------------------------------

export interface ProjectedScheduleMonth {
  month: string; // "YYYY-MM"
  startingBalance: number;
  interest: number;
  newSpend: number;
  amount: number;
  kind: ScheduleKind;
  isEstimate: boolean; // true si es una fila proyectada por nosotros, no cargada
  endingBalance: number;
}

function normalizeMonth(month: string): string {
  return month.slice(0, 7); // "YYYY-MM"
}

function addMonths(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function projectDebtSchedule(params: {
  debt: {
    id: string;
    current_balance: number;
    annual_interest_rate: number | null;
    tem: number | null; // tasa efectiva mensual directa, si se conoce (tiene prioridad sobre annual_interest_rate)
    installments_total: number | null; // si se conoce el plazo (personal_loan/plan_v/etc), habilita amortización analítica
    installments_paid: number;
  };
  entries: DebtScheduleEntry[];
  months: number;
  startMonth?: string; // "YYYY-MM", default: mes actual
  estimatedNewSpendPerMonth?: number; // consumo nuevo estimado, cuando no hay mejor dato (default 0)
}): ProjectedScheduleMonth[] {
  const monthlyRate =
    params.debt.tem ?? (params.debt.annual_interest_rate ? params.debt.annual_interest_rate / 100 / 12 : 0);
  const newSpend = params.estimatedNewSpendPerMonth ?? 0;

  const entriesByMonth = new Map(params.entries.map((e) => [normalizeMonth(e.month), e]));
  const startMonth = params.startMonth ?? normalizeMonth(new Date().toISOString());

  const result: ProjectedScheduleMonth[] = [];
  let balance = params.debt.current_balance;

  // Cuotas de amortización analítica (sistema francés), por si hace
  // falta rellenar un mes de cuota_fija sin entry y sabemos el
  // plazo total — evita pedirle al usuario que cargue 36 filas
  // idénticas a mano para un préstamo con cuota conocida de antemano.
  const remainingInstallments =
    params.debt.installments_total != null
      ? Math.max(params.debt.installments_total - params.debt.installments_paid, 0)
      : null;
  // "annual_interest_rate" en 0 es una tasa real conocida (cuota
  // sin interés del comercio, ver bbva.ts/patagonia.ts) — no "no sé
  // la tasa". Por eso el chequeo es "!= null", no truthiness: con
  // "&& annual_interest_rate" a secas, 0 es falsy y esta rama nunca
  // se ejecutaba para esas cuotas, aunque calculateFixedInstallment
  // ya sabe calcular una cuota fija sin interés (balance / cuotas).
  const analyticFixedInstallment =
    remainingInstallments && params.debt.annual_interest_rate != null
      ? calculateFixedInstallment(balance, params.debt.annual_interest_rate, remainingInstallments)
      : null;

  // Última entry conocida ANTES de empezar a proyectar (para saber
  // qué tipo de pago y qué margen veníamos usando). Si nunca se
  // cargó ninguna entry, un préstamo con plazo y tasa conocidos
  // (personal_loan, plan_v...) arranca en modo cuota_fija por
  // default — es la única forma de pago que ya se puede calcular
  // sola sin pedirle nada al usuario. Sin ese dato, arranca en
  // pago_variable (sin monto conocido todavía, no se inventa uno).
  const sortedPastEntries = [...params.entries].sort((a, b) => a.month.localeCompare(b.month));
  const defaultKind: ScheduleKind = analyticFixedInstallment != null ? "cuota_fija" : "pago_variable";
  let lastKnownKind: ScheduleKind = sortedPastEntries.at(-1)?.kind ?? defaultKind;
  let lastKnownAmount: number = sortedPastEntries.at(-1)?.amount ?? analyticFixedInstallment ?? 0;

  // Cuenta regresiva de cuotas analíticas que quedan por cobrar —
  // sin esto, una deuda con plazo conocido que termina de pagarse
  // DENTRO de la ventana proyectada seguía cobrando la misma cuota
  // fija para siempre (el balance quedaba clavado en 0 por el
  // Math.max de abajo, pero el monto mostrado no bajaba nunca a 0).
  let remainingAnalyticInstallments = remainingInstallments ?? Infinity;

  // El consumo nuevo cargado a mano (ver addCardCharge) ya pasó ESTE
  // mes calendario, pero el resumen de este mismo mes calendario
  // todavía no cerró — el primer mes "sin entry real" de la ventana
  // es la estimación de ESE resumen (el que va a cerrar a fin de
  // este mes), no el siguiente. Un gasto cargado ahora entra en ESE
  // resumen y se factura recién en el que viene después — por eso se
  // salta uno antes de aplicarlo. Se suma una sola vez (no repetido
  // mes a mes: eso asumiría que vas a volver a gastar lo mismo todos
  // los meses, que no es lo que pasó) y nunca sobre un mes ya cerrado
  // con una entry real.
  let newSpendSkipRemaining = 1;
  let newSpendPending = true;

  for (let i = 0; i < params.months; i++) {
    const month = addMonths(startMonth, i);
    const startingBalance = balance;
    const interest = startingBalance * monthlyRate;

    const existing = entriesByMonth.get(month);

    let amount: number;
    let kind: ScheduleKind;
    let isEstimate: boolean;

    if (existing) {
      amount = Number(existing.amount);
      kind = existing.kind;
      isEstimate = existing.is_estimate;
      lastKnownKind = kind;
      lastKnownAmount = amount;
    } else if (lastKnownKind === "cuota_fija" && analyticFixedInstallment != null && remainingAnalyticInstallments > 0) {
      amount = analyticFixedInstallment;
      kind = "cuota_fija";
      isEstimate = true;
      remainingAnalyticInstallments--;
    } else if (lastKnownKind === "cuota_fija" && analyticFixedInstallment != null) {
      // Ya se cobraron todas las cuotas que quedaban (según
      // installments_total/installments_paid) dentro de esta misma
      // ventana proyectada — no hay más que cobrar, no es una
      // estimación, es un hecho conocido.
      amount = 0;
      kind = "cuota_fija";
      isEstimate = false;
    } else if (lastKnownKind === "minimo_estimado" || lastKnownKind === "pago_variable") {
      // "Pago variable" no tiene fórmula real — es lo que el usuario
      // decida pagar ese mes, no hay cómo predecirlo. Pero repetir
      // literal el último pago real (como se hacía antes) ocultaba
      // que el saldo sigue creciendo mes a mes: mostraba el mismo
      // monto para siempre aunque el saldo real fuera a ser mucho
      // más alto. La mejor estimación disponible sin ese dato es la
      // misma que "mínimo + margen": interés del período + el margen
      // que se venía pagando por encima del interés puro.
      const margin = Math.max(lastKnownAmount - startingBalance * monthlyRate, 0);
      amount = interest + margin;
      kind = "minimo_estimado";
      isEstimate = true;
    } else {
      // cuota_fija sin plazo conocido (caso raro, sin tasa/plazo
      // suficiente para amortizar): no hay fórmula posible, repetir
      // el último monto real sigue siendo la única señal disponible.
      amount = lastKnownAmount;
      kind = lastKnownKind;
      isEstimate = true;
    }

    // El consumo nuevo (gastos sueltos cargados a mano) se salta el
    // primer mes sin entry real (el resumen que va a cerrar este
    // mes, todavía en curso) y se suma recién al siguiente — nunca
    // sobre un mes con entry real (ese total ya cerrado ya refleja
    // sus propios consumos, sumarlo de nuevo lo contaría dos veces),
    // y solo una vez, no repetido mes a mes hacia adelante.
    let applyNewSpend = false;
    if (!existing && newSpendPending) {
      if (newSpendSkipRemaining > 0) {
        newSpendSkipRemaining--;
      } else {
        applyNewSpend = true;
        newSpendPending = false;
      }
    }
    const endingBalance = Math.max(startingBalance + interest + (applyNewSpend ? newSpend : 0) - amount, 0);

    result.push({
      month,
      startingBalance: Math.round(startingBalance * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      newSpend,
      amount: Math.round(amount * 100) / 100,
      kind,
      isEstimate,
      endingBalance: Math.round(endingBalance * 100) / 100,
    });

    balance = endingBalance;
  }

  return result;
}
