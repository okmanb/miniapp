import { createClient } from "@/lib/supabase/server";
import { confirmNewDebtFromStatement } from "./actions";
import type { ParsedStatement } from "@/lib/statement-parser";
import { AlertTriangleIcon, ClipboardIcon } from "@/lib/icons";
import Link from "next/link";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ReviewNewDebtPage({
  searchParams,
}: {
  searchParams: { importId?: string };
}) {
  let parsed: ParsedStatement | null = null;
  if (searchParams.importId) {
    const supabase = createClient();
    const { data: pending } = await supabase
      .from("pending_statement_imports")
      .select("data")
      .eq("id", searchParams.importId)
      .single();
    parsed = (pending?.data as ParsedStatement) ?? null;
  }

  if (!parsed) {
    return (
      <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
        <p>
          <Link href="/dashboard/debts/new/upload">← Volver</Link>
        </p>
        <p style={{ color: "var(--led-red)" }}>No se pudo leer la información del PDF. Probá subirlo de nuevo.</p>
      </main>
    );
  }

  const suggestedName =
    parsed.cardName && parsed.accountLast4
      ? `${parsed.cardName} ...${parsed.accountLast4}`
      : parsed.cardName ?? "";

  const defaultPeriod = parsed.cierreActual ? parsed.cierreActual.slice(0, 7) : "";
  const defaultDueDay = parsed.vencimientoActual ? Number(parsed.vencimientoActual.slice(8, 10)) : "";

  return (
    <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard/debts/new/upload">← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ClipboardIcon width={26} height={26} />
        Revisá antes de crear la tarjeta
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Esto es lo que el sistema leyó del PDF. Nada se guardó todavía —
        corregí lo que haga falta y confirmá abajo.
      </p>

      {parsed.warnings.length > 0 && (
        <div
          style={{
            background: "rgba(255, 82, 82, 0.12)",
            color: "var(--led-red)",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 14,
            marginTop: 12,
          }}
        >
          {parsed.warnings.map((w, i) => (
            <p key={i} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
              <AlertTriangleIcon width={13} height={13} style={{ flexShrink: 0, marginTop: 3 }} />
              {w}
            </p>
          ))}
        </div>
      )}

      {parsed.usdChargesExcluded > 0 && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 12 }}>
          Se detectaron {formatCurrency(parsed.usdChargesExcluded)} en consumos
          en dólares — no se incluyen en el total de pesos, revisalos a mano.
        </p>
      )}

      <form
        action={confirmNewDebtFromStatement}
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}
      >
        <input type="hidden" name="import_id" value={searchParams.importId} />
        <h2 style={{ fontSize: 16, marginBottom: -4 }}>Datos de la tarjeta</h2>

        <label>
          Nombre
          <input
            type="text"
            name="name"
            required
            defaultValue={suggestedName}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Tasa punitoria anual detectada (%)
          <input
            type="number"
            name="annual_interest_rate"
            step="0.01"
            min="0"
            defaultValue={parsed.tnaPunitorio ?? ""}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Día de vencimiento
          <input
            type="number"
            name="due_day"
            min="1"
            max="31"
            defaultValue={defaultDueDay}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <input type="hidden" name="initial_balance" value={parsed.saldoActual ?? 0} />
        <input type="hidden" name="saldo_anterior" value={parsed.saldoAnterior ?? ""} />
        <input type="hidden" name="charge_lines" value={JSON.stringify(parsed.chargeLines)} />
        {parsed.saldoActual !== null && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Saldo actual según el PDF: {formatCurrency(parsed.saldoActual)}. El
            sistema va a reconstruir ese mismo total desde el saldo anterior
            {parsed.saldoAnterior !== null ? ` (${formatCurrency(parsed.saldoAnterior)})` : ""} +
            interés + consumos + cuotas de este resumen — si al confirmar no
            coincide con este número, revisá los valores de abajo antes de
            guardar.
          </p>
        )}
        {parsed.saldoAnterior === null && (
          <p style={{ fontSize: 13, color: "var(--led-red)" }}>
            No pudimos leer el "SALDO ANTERIOR" de este PDF, así que el
            sistema va a arrancar el saldo desde $0 + lo que cargues abajo —
            completá "Consumos nuevos" con el total real si hace falta para
            que coincida con el saldo actual de arriba.
          </p>
        )}

        <h2 style={{ fontSize: 16, marginTop: 12, marginBottom: -4 }}>Primer resumen</h2>

        <label>
          Mes del resumen
          <input
            type="month"
            name="period"
            required
            defaultValue={defaultPeriod}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Consumos nuevos detectados (sin cuotas, sin USD)
          <input
            type="number"
            name="new_charges"
            step="0.01"
            min="0"
            defaultValue={parsed.newChargesArs}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Pago mínimo detectado
          <input
            type="number"
            name="minimum_payment"
            step="0.01"
            min="0"
            defaultValue={parsed.pagoMinimo ?? ""}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Cuánto pagaste realmente (dejalo en 0 si todavía no pagaste este resumen)
          <input
            type="number"
            name="amount_paid"
            step="0.01"
            min="0"
            defaultValue="0"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Tipo de pago
          <select name="payment_kind" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="pago_variable">Pago variable (lo que pude pagar)</option>
            <option value="minimo_estimado">Mínimo + margen</option>
            <option value="unico">Pago único (cancela todo)</option>
          </select>
        </label>

        <label>
          Fecha de vencimiento
          <input
            type="date"
            name="due_date"
            defaultValue={parsed.vencimientoActual ?? ""}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        {parsed.planVEntries.length > 0 && (
          <fieldset style={{ border: "1px solid var(--board-seam)", borderRadius: 6, padding: 16 }}>
            <legend style={{ fontWeight: 600 }}>Cuotas y refinanciación detectadas</legend>
            <input type="hidden" name="plan_count" value={parsed.planVEntries.length} />

            {parsed.planVEntries.map((plan, i) => (
              <div key={plan.cupon} style={{ marginBottom: 10, fontSize: 14 }}>
                <label className="option-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" name={`plan_include_${i}`} defaultChecked />
                  {plan.description ? `${plan.description} — ` : ""}Cupón {plan.cupon} —{" "}
                  {plan.currentInstallment}/{plan.totalInstallments} cuotas de{" "}
                  {formatCurrency(plan.installmentAmount)}{" "}
                  {plan.tna > 0 ? `(refinanciación, TNA ${plan.tna}%)` : "(cuota sin interés)"}
                </label>
                <input type="hidden" name={`plan_cupon_${i}`} value={plan.cupon} />
                <input type="hidden" name={`plan_total_installments_${i}`} value={plan.totalInstallments} />
                <input type="hidden" name={`plan_installment_amount_${i}`} value={plan.installmentAmount} />
                <input type="hidden" name={`plan_tna_${i}`} value={plan.tna} />
                <input type="hidden" name={`plan_current_installment_${i}`} value={plan.currentInstallment} />
                <input type="hidden" name={`plan_description_${i}`} value={plan.description ?? ""} />
              </div>
            ))}
          </fieldset>
        )}

        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Crear tarjeta y guardar resumen
        </button>
      </form>
    </main>
  );
}
