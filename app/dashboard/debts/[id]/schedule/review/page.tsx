import { createClient } from "@/lib/supabase/server";
import { confirmParsedStatement } from "./actions";
import type { ParsedStatement } from "@/lib/statement-parser";
import { AlertTriangleIcon, ClipboardIcon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ReviewStatementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { importId?: string };
}) {
  const supabase = createClient();
  const { data: debt } = await supabase.from("debts").select("*").eq("id", params.id).single();
  if (!debt) notFound();

  let parsed: ParsedStatement | null = null;
  if (searchParams.importId) {
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
          <Link href={`/dashboard/debts/${params.id}/schedule`}>← Volver</Link>
        </p>
        <p style={{ color: "var(--led-red)" }}>No se pudo leer la información del PDF. Probá subirlo de nuevo.</p>
      </main>
    );
  }

  // Ya sabemos qué planes de Plan V están cargados como deudas
  // hermanas (por cupón, embebido en el nombre — ver
  // schedule/review/actions.ts), para no ofrecer agregar de nuevo
  // uno que ya existe.
  const { data: existingSiblings } = await supabase
    .from("debts")
    .select("name")
    .eq("parent_debt_id", params.id);
  const existingCupones = new Set(
    (existingSiblings ?? [])
      .map((d) => d.name.match(/cupón (\d+)/)?.[1])
      .filter((c): c is string => Boolean(c))
  );

  const boundConfirm = confirmParsedStatement.bind(null, params.id);

  const defaultPeriod = parsed.cierreActual ? parsed.cierreActual.slice(0, 7) : "";

  return (
    <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href={`/dashboard/debts/${params.id}/schedule`}>← Volver</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ClipboardIcon width={26} height={26} />
        Revisá antes de guardar
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
          en dólares (Apple, Netflix, etc.) — no se incluyen en el total de
          pesos, revisalos a mano si hace falta.
        </p>
      )}

      <form action={boundConfirm} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <input type="hidden" name="import_id" value={searchParams.importId} />
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
        {parsed.chargeLines.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: -6 }}>
            Se detectaron {parsed.chargeLines.length} consumos individuales — vas a poder
            categorizarlos como fijo/necesario o discrecional después de confirmar, en "Ver
            desglose de gastos".
          </p>
        )}

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
          Cuánto pagaste realmente
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
          Fecha de vencimiento detectada
          <input
            type="date"
            name="due_date"
            defaultValue={parsed.vencimientoActual ?? ""}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <input type="hidden" name="saldo_anterior" value={parsed.saldoAnterior ?? ""} />
        <input type="hidden" name="charge_lines" value={JSON.stringify(parsed.chargeLines)} />

        {parsed.saldoActual !== null && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            El PDF dice que el saldo actual es {formatCurrency(parsed.saldoActual)} — el
            sistema va a reconstruir ese mismo total desde el saldo anterior
            {parsed.saldoAnterior !== null ? ` (${formatCurrency(parsed.saldoAnterior)})` : ""} +
            interés + consumos + cuotas, así que puede diferir un poco; si la
            diferencia es grande, revisá los valores de arriba.
          </p>
        )}
        {parsed.saldoAnterior === null && (
          <p style={{ fontSize: 13, color: "var(--led-red)" }}>
            No pudimos leer el "SALDO ANTERIOR" de este PDF — el sistema va a
            usar el resumen anterior guardado en la app (si hay) como punto
            de partida en su lugar.
          </p>
        )}

        {parsed.planVEntries.length > 0 && (
          <fieldset style={{ border: "1px solid var(--board-seam)", borderRadius: 6, padding: 16 }}>
            <legend style={{ fontWeight: 600 }}>Cuotas y refinanciación detectadas</legend>
            <input type="hidden" name="plan_count" value={parsed.planVEntries.length} />

            {parsed.planVEntries.map((plan, i) => {
              const alreadyTracked = existingCupones.has(plan.cupon);
              return (
                <div key={plan.cupon} style={{ marginBottom: 10, fontSize: 14 }}>
                  <label className="option-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      name={`plan_include_${i}`}
                      defaultChecked={!alreadyTracked}
                      disabled={alreadyTracked}
                    />
                    {plan.description ? `${plan.description} — ` : ""}Cupón {plan.cupon} —{" "}
                    {plan.currentInstallment}/{plan.totalInstallments} cuotas de{" "}
                    {formatCurrency(plan.installmentAmount)}{" "}
                    {plan.tna > 0 ? `(refinanciación, TNA ${plan.tna}%)` : "(cuota sin interés)"}
                    {alreadyTracked && <span style={{ color: "var(--ink-muted)" }}> — ya cargado</span>}
                  </label>
                  <input type="hidden" name={`plan_cupon_${i}`} value={plan.cupon} />
                  <input type="hidden" name={`plan_total_installments_${i}`} value={plan.totalInstallments} />
                  <input type="hidden" name={`plan_installment_amount_${i}`} value={plan.installmentAmount} />
                  <input type="hidden" name={`plan_tna_${i}`} value={plan.tna} />
                  <input type="hidden" name={`plan_current_installment_${i}`} value={plan.currentInstallment} />
                  <input type="hidden" name={`plan_description_${i}`} value={plan.description ?? ""} />
                </div>
              );
            })}
          </fieldset>
        )}

        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
          Confirmar y guardar
        </button>
      </form>
    </main>
  );
}
