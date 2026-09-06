import { formatMoney } from "@/lib/calc/money";
import type { PayoffOption } from "@/lib/data/debt";

/**
 * Comparación entre pagar el mínimo y pagar el doble.
 *
 * La advertencia va arriba y no al pie en letra chica: la comparación asume
 * un pago fijo todos los meses, que no es lo que pasa en la vida real. Es una
 * comparación entre dos ritmos, no una predicción, y decirlo antes de los
 * números es parte de no prometer certezas que no tenemos.
 *
 * Cuando al mínimo la deuda no se salda, no se muestra un plazo enorme: se
 * dice que a ese ritmo no se termina. Y ahí no hay "ahorro" que mostrar,
 * porque no se está comparando contra un número.
 */
export function PayoffComparison({
  payoff,
}: {
  payoff: { minimum: PayoffOption; double: PayoffOption; savings: number | null };
}) {
  return (
    <>
      <p className="help mt-2">
        Comparación simplificada — asume que pagás siempre el mismo monto fijo. Estimado, no
        una proyección exacta.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <OptionCard option={payoff.minimum} tone="neutral" footerLabel="Interés total" />
        <OptionCard
          option={payoff.double}
          tone="good"
          footerLabel={payoff.savings != null ? "Ahorrás" : "Interés total"}
          footerValue={payoff.savings ?? payoff.double.totalInterest}
        />
      </div>
    </>
  );
}

function OptionCard({
  option,
  tone,
  footerLabel,
  footerValue,
}: {
  option: PayoffOption;
  tone: "neutral" | "good";
  footerLabel: string;
  footerValue?: number | null;
}) {
  const value = footerValue !== undefined ? footerValue : option.totalInterest;
  const good = tone === "good";

  return (
    <div
      className="rounded-surface-lg border px-3 py-3"
      style={{
        backgroundColor: good ? "#E0F4E9" : "#FFFFFF",
        borderColor: good ? "#BEE1CE" : "#DEE3DD",
      }}
    >
      <div className="font-mono text-[13px] font-semibold text-ink">
        {formatMoney(option.monthlyPayment)}
        <span className="text-muted">/mes</span>
      </div>

      <div className="mt-1 text-[11px] leading-[1.4] text-muted">
        {option.label} ·{" "}
        {option.months === null ? (
          <span className="text-brick-ink">a este ritmo no se salda</span>
        ) : (
          `${option.months} ${option.months === 1 ? "mes" : "meses"} para saldar`
        )}
      </div>

      <div className="mt-3 border-t pt-2" style={{ borderColor: good ? "#BEE1CE" : "#E2E7E1" }}>
        <div className="text-label uppercase text-muted">{footerLabel}</div>
        <div
          className="mt-0.5 font-mono text-[15px] font-semibold"
          style={{ color: good ? "#175F42" : "#12211D" }}
        >
          {value != null ? formatMoney(value) : "—"}
        </div>
      </div>
    </div>
  );
}
