"use client";

import { useState, useTransition } from "react";
import { deleteBridgeLoan, toggleBridgeTaken } from "@/app/dashboard/bridge-loans/actions";
import { formatMoney } from "@/lib/calc/money";
import { Card, Amount, Spinner } from "./ui";

export interface BridgeCardData {
  id: string;
  lender: string;
  amount: number;
  months: number;
  ratePercent: number | null;
  interest: number;
  total: number;
  isTaken: boolean;
  repayLabel: string;
  note: string | null;
  /** Ahorro contra dejar esa plata en la deuda más cara. null = no hay con qué comparar. */
  saving: number | null;
  worstDebtName: string | null;
}

/**
 * Un puente en la lista.
 *
 * El estado —simulado o tomado— es lo primero que se lee, porque es lo único
 * que cambia otras pantallas. Un puente simulado es una cuenta; uno tomado
 * mueve el flujo de dos meses.
 */
export function BridgeLoanCard({ loan }: { loan: BridgeCardData }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-card text-ink">{loan.lender}</span>
            <span
              className="shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase"
              style={
                loan.isTaken
                  ? { backgroundColor: "#E0F4E9", color: "#175F42" }
                  : { backgroundColor: "#F2F5F1", color: "#5C6B65" }
              }
            >
              {loan.isTaken ? "Tomado" : "Simulado"}
            </span>
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            {loan.ratePercent ? `${loan.ratePercent}% mensual · ` : "sin interés · "}
            {loan.months === 1 ? "1 mes" : `${loan.months} meses`} · devolvés en {loan.repayLabel}
          </div>
        </div>

        <button
          type="button"
          aria-label={`Borrar el puente de ${loan.lender}`}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteBridgeLoan(loan.id);
              if (!result.ok) setError(result.message);
            })
          }
          className="shrink-0 text-[16px] leading-none text-muted transition-colors duration-150 ease-sd hover:text-brick-ink disabled:opacity-50"
        >
          ×
        </button>
      </div>

      <div className="mt-3 space-y-1 border-t border-border-row pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-label uppercase text-muted">Monto</span>
          <Amount className="text-[15px] font-semibold text-ink">{formatMoney(loan.amount)}</Amount>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-muted">interés del puente</span>
          <Amount className="text-[13px] text-muted">{formatMoney(loan.interest)}</Amount>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-muted">devolvés en total</span>
          <Amount className="text-[13px] text-ink">{formatMoney(loan.total)}</Amount>
        </div>
      </div>

      {loan.saving != null && loan.worstDebtName && (
        <p
          className="mt-2 text-[11.5px]"
          style={{ color: loan.saving > 0 ? "#175F42" : "#823123" }}
        >
          {loan.saving > 0
            ? `Te ahorra ${formatMoney(loan.saving)} contra dejarlo en ${loan.worstDebtName}`
            : loan.saving === 0
              ? `Da lo mismo que dejarlo en ${loan.worstDebtName}`
              : `Te cuesta ${formatMoney(-loan.saving)} más que dejarlo en ${loan.worstDebtName}`}
        </p>
      )}

      {loan.note && <p className="mt-1.5 text-[11px] text-muted">{loan.note}</p>}

      <p className="help mt-2">
        {loan.isTaken
          ? `Entra en el flujo: suma este mes y se devuelve entero en ${loan.repayLabel}.`
          : "No toca el flujo todavía. Es solo la cuenta de cuánto costaría."}
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await toggleBridgeTaken(loan.id, !loan.isTaken);
            if (!result.ok) setError(result.message);
          })
        }
        className="mt-3 flex min-h-touch w-full items-center justify-between gap-2 rounded-pill border border-border bg-surface px-[16px] py-[10px] text-[12.5px] font-semibold text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken disabled:opacity-70"
      >
        <span className="flex items-center gap-2">
          {pending && <Spinner className="text-pine" />}
          {loan.isTaken ? "Volver a simulación" : "Lo tomé"}
        </span>
        <span aria-hidden>→</span>
      </button>

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </Card>
  );
}
