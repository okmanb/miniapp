"use client";

import { useMemo, useState, useTransition } from "react";
import { createBridgeLoan } from "@/app/dashboard/bridge-loans/actions";
import { bridgeCost, compareAgainstWorstDebt, monthsBetween } from "@/lib/calc/bridge";
import { formatMoney, parseMoney, formatRate } from "@/lib/calc/money";
import { Spinner } from "./ui";
import { CalendarField } from "./CalendarField";

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface WorstDebt {
  name: string;
  /** Tasa mensual en decimal. */
  monthlyRate: number;
  annualRatePercent: number;
}

/**
 * Alta de un préstamo puente.
 *
 * La cuenta se muestra mientras se escribe y no al guardar: la decisión que
 * trae a alguien acá —¿me conviene pedirlo?— se toma antes de apretar nada, y
 * la respuesta necesita ver el costo al lado de la alternativa.
 */
export function BridgeLoanForm({
  currentPeriod,
  worstDebt,
}: {
  currentPeriod: string;
  worstDebt: WorstDebt | null;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const [amount, setAmount] = useState("");
  const [repayPeriod, setRepayPeriod] = useState(() => addMonths(currentPeriod, 1));
  const [rate, setRate] = useState("");

  const preview = useMemo(() => {
    const value = parseMoney(amount);
    if (value <= 0) return null;

    const months = Math.max(1, monthsBetween(currentPeriod, repayPeriod));
    const parsedRate = rate.trim() === "" ? 0 : Number(rate.replace(",", "."));
    const cost = bridgeCost({
      amount: value,
      months,
      ratePercent: Number.isFinite(parsedRate) ? parsedRate : 0,
    });

    const comparison = worstDebt
      ? compareAgainstWorstDebt({
          amount: value,
          months,
          worstMonthlyRate: worstDebt.monthlyRate,
          bridgeInterest: cost.interest,
        })
      : null;

    return { cost, comparison, months };
  }, [amount, rate, repayPeriod, currentPeriod, worstDebt]);

  const months = preview?.months ?? Math.max(1, monthsBetween(currentPeriod, repayPeriod));

  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-ink">+ Nuevo préstamo puente</h2>

      <form
        className="mt-3"
        action={(formData) =>
          startTransition(async () => {
            const result = await createBridgeLoan(formData);
            setStatus(
              result.ok
                ? {
                    ok: true,
                    message:
                      "Cargado como simulación. Todavía no toca el flujo: para eso tocá “Lo tomé”.",
                  }
                : { ok: false, message: result.message }
            );
            if (result.ok) {
              setAmount("");
              setRate("");
            }
          })
        }
      >
        <input type="hidden" name="taken_period" value={currentPeriod} />

        <label htmlFor="lender" className="block text-label uppercase text-muted">
          Fuente
        </label>
        <input
          id="lender"
          name="lender"
          required
          autoComplete="off"
          placeholder="Un familiar, el banco, un adelanto"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <p className="help mt-1.5">
          De dónde sale la plata — sirve para acordarte a quién le debés qué.
        </p>

        <label htmlFor="amount" className="mt-5 block text-label uppercase text-muted">
          Monto
        </label>
        <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
          <span className="font-mono text-[15px] text-muted" aria-hidden>
            $
          </span>
          <input
            id="amount"
            name="amount"
            required
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-5">
          <CalendarField
            id="repay_period"
            name="repay_period"
            label="Lo devolvés en"
            mode="month"
            value={repayPeriod}
            onChange={setRepayPeriod}
            min={addMonths(currentPeriod, 1)}
            kicker="Mes de devolución"
            note="Cuándo devolvés el puente completo."
            help={
              months === 1
                ? "Un mes de puente: devolvés el mes que viene."
                : `${months} meses de puente — la tasa corre todo ese tiempo.`
            }
          />
        </div>

        <label
          htmlFor="monthly_interest_rate"
          className="mt-5 block text-label uppercase text-muted"
        >
          Tasa estimada % mensual (opcional)
        </label>
        <input
          id="monthly_interest_rate"
          name="monthly_interest_rate"
          inputMode="decimal"
          placeholder="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <p className="help mt-1.5">
          Si no cobra interés, dejalo en 0 — igual entra en el flujo del mes que devolvés.
        </p>

        <label htmlFor="note" className="mt-5 block text-label uppercase text-muted">
          Nota (opcional)
        </label>
        <input
          id="note"
          name="note"
          autoComplete="off"
          placeholder="Qué acordaste"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        {preview && <CostPreview {...preview} worstDebt={worstDebt} />}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          Agregar préstamo puente
        </button>

        {status && (
          <p
            role="status"
            className="mt-3 text-[11.5px]"
            style={{ color: status.ok ? "#175F42" : "#823123" }}
          >
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}

/**
 * La alternativa al puente no es "no pedirlo": es dejar esa plata financiada
 * en la deuda más cara. Sin ese número al lado, el costo del puente se lee
 * como una pérdida cuando muchas veces es un ahorro.
 */
function CostPreview({
  cost,
  comparison,
  worstDebt,
}: {
  cost: ReturnType<typeof bridgeCost>;
  comparison: ReturnType<typeof compareAgainstWorstDebt> | null;
  worstDebt: WorstDebt | null;
}) {
  return (
    <div className="mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3">
      <div className="text-label uppercase text-muted">Contra qué lo comparamos</div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">Interés del puente</span>
        <span className="font-mono text-[13.5px] font-semibold text-ink">
          {formatMoney(cost.interest)}
        </span>
      </div>

      {comparison && worstDebt && (
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-muted">
            Dejarlo en {worstDebt.name} ·{" "}
            {formatRate(worstDebt.annualRatePercent)}
          </span>
          <span className="font-mono text-[13.5px] text-ink">
            {formatMoney(comparison.alternativeInterest)}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
        <span className="text-[12px] text-muted">Devolvés en total</span>
        <span className="font-mono text-[13.5px] font-semibold text-ink">
          {formatMoney(cost.total)}
        </span>
      </div>

      {comparison && (
        <p
          className="mt-2 text-[11.5px]"
          style={{ color: comparison.saving > 0 ? "#175F42" : "#823123" }}
        >
          {comparison.saving > 0
            ? `Conviene el puente: ${formatMoney(comparison.saving)} menos de interés`
            : comparison.saving === 0
              ? "Da lo mismo que dejarlo en la deuda más cara."
              : `Sale más caro que dejarlo donde está: ${formatMoney(-comparison.saving)} más de interés`}
        </p>
      )}

      {!comparison && (
        <p className="help mt-2">
          Sin deudas cargadas no hay contra qué compararlo. Cargá una y esta cuenta se completa.
        </p>
      )}
    </div>
  );
}
