/**
 * Detección automática de alertas (spec §5). No todos los tipos del
 * enum se pueden calcular solos con lo que hay hoy en el modelo:
 *
 * - saldo_creciente, vencimiento_hoy, tasa_mas_cara: sí, son
 *   puramente función de los datos ya cargados — se calculan acá.
 * - doble_conteo, mes_no_reflejado, gasto_no_capturado: requieren
 *   detectar algo que el usuario no cargó, o comparar contra un
 *   saldo real que hoy no se persiste mes a mes — quedan afuera de
 *   este cálculo automático (los tipos existen en la DB por si se
 *   arma una vía manual para cargarlas más adelante).
 */

import { projectDebtSchedule, type DebtScheduleEntry } from "@/lib/debt-engine/schedule";

export type AlertType =
  | "saldo_creciente"
  | "doble_conteo"
  | "mes_no_reflejado"
  | "gasto_no_capturado"
  | "vencimiento_hoy"
  | "tasa_mas_cara";

export type AlertSeverity = "info" | "atencion" | "critico";

export interface ComputedAlert {
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  debt_id: string | null;
}

export interface AlertDebt {
  id: string;
  name: string;
  current_balance: number;
  annual_interest_rate: number | null;
  tem: number | null;
  installments_total: number | null;
  installments_paid: number;
  due_day: number | null;
  is_active: boolean;
}

function nextDueDaysUntil(dueDay: number | null): number | null {
  if (!dueDay) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (due < today) due.setMonth(due.getMonth() + 1);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeAlerts(params: {
  debts: AlertDebt[];
  scheduleEntriesByDebt: Map<string, DebtScheduleEntry[]>;
}): ComputedAlert[] {
  const alerts: ComputedAlert[] = [];
  const activeDebts = params.debts.filter((d) => d.is_active && d.current_balance > 0);

  // --- saldo_creciente: el pago proyectado del próximo mes no
  // cubre ni el interés del período — el saldo va a seguir subiendo
  // pase lo que pase con ese monto. ---
  for (const debt of activeDebts) {
    const monthlyRate = debt.tem ?? (debt.annual_interest_rate ? debt.annual_interest_rate / 100 / 12 : 0);
    if (monthlyRate <= 0) continue;

    const [projected] = projectDebtSchedule({
      debt,
      entries: params.scheduleEntriesByDebt.get(debt.id) ?? [],
      months: 1,
    });
    if (!projected || projected.amount <= 0) continue;

    const interest = debt.current_balance * monthlyRate;
    if (projected.amount < interest) {
      alerts.push({
        alert_type: "saldo_creciente",
        severity: projected.amount < interest * 0.5 ? "critico" : "atencion",
        debt_id: debt.id,
        message: `${debt.name}: el pago que se está proyectando (${Math.round(projected.amount).toLocaleString("es-AR")}) no cubre el interés del período (${Math.round(interest).toLocaleString("es-AR")}) — a este ritmo el saldo NO baja.`,
      });
    }
  }

  // --- vencimiento_hoy: una cuota vence en las próximas 48hs. ---
  for (const debt of activeDebts) {
    const daysUntil = nextDueDaysUntil(debt.due_day);
    if (daysUntil === null || daysUntil > 2) continue;

    alerts.push({
      alert_type: "vencimiento_hoy",
      severity: daysUntil <= 0 ? "critico" : "atencion",
      debt_id: debt.id,
      message:
        daysUntil <= 0
          ? `${debt.name}: vence hoy.`
          : `${debt.name}: vence en ${daysUntil} día${daysUntil > 1 ? "s" : ""}.`,
    });
  }

  // --- tasa_mas_cara: una deuda con una tasa muy por encima del
  // resto (1.5x el promedio de las demás) — vale la pena mirarla
  // primero al decidir dónde poner el esfuerzo extra. ---
  const withRate = activeDebts.filter((d) => d.annual_interest_rate != null && d.annual_interest_rate > 0);
  if (withRate.length > 1) {
    const rates = withRate.map((d) => d.annual_interest_rate as number);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const priciest = withRate.reduce((a, b) => ((b.annual_interest_rate as number) > (a.annual_interest_rate as number) ? b : a));
    const priciestRate = priciest.annual_interest_rate as number;

    if (priciestRate > avg * 1.5) {
      alerts.push({
        alert_type: "tasa_mas_cara",
        severity: "info",
        debt_id: priciest.id,
        message: `${priciest.name} tiene la tasa más cara de todas tus deudas activas (${priciestRate.toFixed(1)}% TNA, vs. ${avg.toFixed(1)}% de promedio del resto).`,
      });
    }
  }

  const severityRank: Record<AlertSeverity, number> = { critico: 0, atencion: 1, info: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
