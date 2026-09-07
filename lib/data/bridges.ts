import type { BridgeFlow } from "@/lib/calc/cashflow";
import { bridgeCost, monthsBetween } from "@/lib/calc/bridge";

/**
 * Los puentes, del formato de la base al que entiende la proyección.
 *
 * Vive acá y no en cada pantalla porque lo usan las dos lecturas que proyectan
 * caja —el dashboard y el flujo— y un puente que entra en una proyección y no
 * en la otra daría dos alcances distintos para el mismo escenario.
 */

export interface BridgeLoanRow {
  id: string;
  lender: string;
  amount: number | string;
  taken_period: string;
  repay_period: string | null;
  monthly_interest_rate: number | string | null;
  is_taken: boolean;
  note: string | null;
}

/** Las columnas que hay que pedirle a Postgres para armar un BridgeFlow. */
export const BRIDGE_COLUMNS =
  "id, lender, amount, taken_period, repay_period, monthly_interest_rate, is_taken, note";

/**
 * Solo los puentes TOMADOS mueven la proyección. Los simulados existen para
 * mirar cuánto costarían, y mirar no cambia el mes que viene.
 */
export function toBridgeFlows(rows: BridgeLoanRow[]): BridgeFlow[] {
  return rows
    .filter((row) => row.is_taken)
    .map((row) => {
      const amount = Number(row.amount);
      const months = row.repay_period
        ? Math.max(1, monthsBetween(row.taken_period, row.repay_period))
        : 1;
      const cost = bridgeCost({
        amount,
        months,
        ratePercent: row.monthly_interest_rate != null ? Number(row.monthly_interest_rate) : null,
      });
      return {
        takenPeriod: row.taken_period,
        amount,
        repayPeriod: row.repay_period,
        repayTotal: cost.total,
      };
    });
}
