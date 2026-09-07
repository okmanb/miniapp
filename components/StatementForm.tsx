"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  saveStatement,
  EMPTY_STATEMENT_STATE,
  type StatementState,
} from "@/app/dashboard/statements/actions";
import { parseStatementPdf, type ParseResult } from "@/app/dashboard/statements/parse-actions";
import { formatMoney, formatUsd } from "@/lib/calc/money";
import { Spinner } from "./ui";

/**
 * Carga del resumen del mes (pantalla 06).
 *
 * El PDF prellena, no guarda. El parser está atado a la maquetación de cada
 * banco y se rompe cuando el banco la cambia, así que lo que sale de ahí va a
 * campos editables para que la persona lo confirme. Lo que el parser no pudo
 * leer se dice con todas las letras en vez de quedar en cero: un cero puesto
 * por nosotros es indistinguible de un cero real del resumen.
 *
 * Cuando el servidor detecta posible doble conteo, el formulario no se reenvía
 * solo: aparece la lista de los gastos que se van a archivar y el botón cambia
 * de texto. Confirmar es un acto aparte, porque la consecuencia (que esos
 * gastos dejen de sumar al saldo) no se ve hasta después.
 */
export function StatementForm({
  cards,
  defaultDebtId,
  defaultPeriod,
}: {
  cards: { id: string; name: string }[];
  defaultDebtId?: string;
  defaultPeriod: string;
}) {
  const [state, formAction, pending] = useActionState<StatementState, FormData>(
    saveStatement,
    EMPTY_STATEMENT_STATE
  );

  const [parsing, startParsing] = useTransition();
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Controlados para que el PDF pueda prellenarlos y la persona corregirlos.
  const [debtId, setDebtId] = useState(defaultDebtId ?? "");
  const [period, setPeriod] = useState(defaultPeriod);
  const [newCharges, setNewCharges] = useState("");
  const [minimum, setMinimum] = useState("");
  const [paid, setPaid] = useState("");

  const needsConfirm = Boolean(state.pendingDuplicates?.length);

  function readPdf(file: File) {
    startParsing(async () => {
      const data = new FormData();
      data.set("pdf", file);
      const result = await parseStatementPdf(data);
      setParsed(result);

      if (!result.ok) return;
      // Solo se prellena lo que el parser SÍ leyó. Un campo que no pudo leer
      // se deja como estaba, no se pisa con cero.
      if (result.period) setPeriod(result.period);
      if (result.newCharges != null) setNewCharges(String(Math.round(result.newCharges)));
      if (result.minimumPayment != null) setMinimum(String(Math.round(result.minimumPayment)));
    });
  }

  return (
    <>
      <section className="mt-4 rounded-surface-lg border border-dashed border-border-dash bg-surface-sunken px-4 py-4">
        <h2 className="text-card text-ink">Subir el PDF</h2>
        <p className="help mt-1">
          Lo leemos y completamos los campos de abajo. No se guarda nada hasta que revises y
          confirmes.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          aria-label="PDF del resumen"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readPdf(file);
          }}
          className="mt-3 block w-full text-[12px] text-muted file:mr-3 file:min-h-touch file:cursor-pointer file:rounded-pill file:border file:border-border file:bg-surface file:px-4 file:text-[12px] file:font-semibold file:text-pine hover:file:bg-surface-arch"
        />

        {parsing && (
          <p role="status" className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
            <Spinner className="text-teal" />
            Leyendo el PDF…
          </p>
        )}

        {parsed && !parsed.ok && (
          <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
            {parsed.message}
          </p>
        )}

        {parsed?.ok && <ParseSummary parsed={parsed} />}
      </section>

      <form action={formAction} className="mt-5">
        {needsConfirm && <input type="hidden" name="confirmed" value="1" />}
        {/* Las cuotas detectadas viajan enteras: se guardan al confirmar. */}
        {parsed?.ok && parsed.installments && parsed.installments.length > 0 && (
          <input type="hidden" name="installments" value={JSON.stringify(parsed.installments)} />
        )}

        <label htmlFor="debt_id" className="block text-label uppercase text-muted">
          Tarjeta
        </label>
        <select
          id="debt_id"
          name="debt_id"
          required
          value={debtId}
          onChange={(e) => setDebtId(e.target.value)}
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
        >
          <option value="">Elegí una</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {parsed?.ok && parsed.cardName && (
          <p className="help mt-1.5">
            El PDF dice “{parsed.cardName}
            {parsed.accountLast4 ? ` …${parsed.accountLast4}` : ""}”. Elegí a cuál de tus
            tarjetas corresponde.
          </p>
        )}

        <label htmlFor="period" className="mt-5 block text-label uppercase text-muted">
          Mes del resumen
        </label>
        <input
          id="period"
          name="period"
          type="month"
          required
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
        />

        <MoneyField
          id="new_charges"
          label="Consumos del período"
          help="Lo que gastaste en el mes, sin contar las cuotas que ya venían."
          value={newCharges}
          onChange={setNewCharges}
        />
        <MoneyField
          id="minimum_payment"
          label="Pago mínimo"
          help="El que exige el banco. Es el que usamos para avisarte si el saldo va a crecer."
          value={minimum}
          onChange={setMinimum}
        />
        <MoneyField
          id="amount_paid"
          label="Cuánto pagaste"
          help="Dejalo en cero si todavía no pagaste este resumen."
          value={paid}
          onChange={setPaid}
        />

        {state.message && (
          <div
            role="alert"
            className="mt-5 rounded-surface border px-3 py-3"
            style={{
              backgroundColor: needsConfirm ? "#FCF4E7" : "#FFE9E4",
              borderColor: needsConfirm ? "#EBD9B8" : "#F2C7BE",
            }}
          >
            <p
              className="text-[12px] font-semibold"
              style={{ color: needsConfirm ? "#A77530" : "#8E3B2C" }}
            >
              {needsConfirm ? "Ojo con el doble conteo" : "No se pudo guardar"}
            </p>
            <p
              className="mt-1 text-[11.5px]"
              style={{ color: needsConfirm ? "#7A5116" : "#823123" }}
            >
              {state.message}
            </p>

            {state.pendingDuplicates && (
              <>
                <ul className="mt-2 space-y-1">
                  {state.pendingDuplicates.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex justify-between gap-3 text-[11.5px] text-gold-ink"
                    >
                      <span className="truncate">{expense.description}</span>
                      <span className="shrink-0 font-mono">{formatMoney(expense.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-gold-ink">
                  Si confirmás, estos gastos se archivan: dejan de sumar al saldo porque el
                  resumen ya los trae adentro. No se borran — podés recuperarlos desde la lista
                  de gastos si el resumen no los incluía.
                </p>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          {needsConfirm ? "Entiendo, archivar esos gastos y guardar" : "Guardar el resumen"}
        </button>
      </form>
    </>
  );
}

/**
 * Lo que salió del PDF, incluido lo que NO salió. Los avisos del parser se
 * muestran tal cual: son la diferencia entre "el resumen dice cero" y "no
 * pudimos leerlo", que para un saldo no es lo mismo.
 */
function ParseSummary({ parsed }: { parsed: ParseResult }) {
  const rows = [
    {
      label: "Saldo del resumen",
      value:
        parsed.statementBalance != null ? formatMoney(parsed.statementBalance) : "no se pudo leer",
      missing: parsed.statementBalance == null,
    },
    {
      label: "Consumos del período",
      value: parsed.newCharges != null ? formatMoney(parsed.newCharges) : "no se pudo leer",
      missing: parsed.newCharges == null,
    },
    {
      label: "Pago mínimo",
      value: parsed.minimumPayment != null ? formatMoney(parsed.minimumPayment) : "no se pudo leer",
      missing: parsed.minimumPayment == null,
    },
    {
      label: "Vencimiento",
      value: parsed.dueDate ?? "no se pudo leer",
      missing: !parsed.dueDate,
    },
  ];

  return (
    <div className="mt-3 rounded-surface border border-border bg-surface px-3 py-3">
      <p className="text-[11.5px] font-semibold text-leaf-deep">Leímos {parsed.fileName}</p>

      <dl className="mt-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 py-1">
            <dt className="text-[11.5px] text-muted">{row.label}</dt>
            <dd
              className="font-mono text-[11.5px]"
              style={{ color: row.missing ? "#A77530" : "#12211D" }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {parsed.installments && parsed.installments.length > 0 && (
        <p className="mt-2 border-t border-border-row pt-2 text-[11px] text-muted">
          {parsed.installments.length === 1
            ? "Encontramos 1 compra en cuotas"
            : `Encontramos ${parsed.installments.length} compras en cuotas`}{" "}
          por {formatMoney(parsed.installments.reduce((s, i) => s + i.installmentAmount, 0))} este
          mes. Se guardan al confirmar.
        </p>
      )}

      {parsed.usdExcluded != null && parsed.usdExcluded > 0 && (
        <p className="mt-2 text-[11px] text-gold-ink">
          Hay {formatUsd(parsed.usdExcluded)} en consumos en dólares que NO sumamos: se
          convierten a la cotización del cierre, que no tenemos. Cargalos a mano si querés
          que cuenten.
        </p>
      )}

      {parsed.warnings && parsed.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border-row pt-2">
          {parsed.warnings.map((warning) => (
            <li key={warning} className="text-[11px] text-gold-ink">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoneyField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className="help mt-1.5">{help}</p>
    </div>
  );
}
