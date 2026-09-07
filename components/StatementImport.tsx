"use client";

import { useRef, useState, useTransition } from "react";
import { parseStatementPdf, type ParseResult } from "@/app/dashboard/statements/parse-actions";
import { formatMoney } from "@/lib/calc/money";
import { Spinner } from "./ui";

/**
 * Importar un resumen para prellenar un formulario.
 *
 * El mismo bloque sirve en el onboarding, en el alta de una tarjeta y en la
 * carga de un resumen, porque en los tres la pregunta es la misma: en vez de
 * copiar seis números del PDF a mano, que los lea la app y los deje editables.
 *
 * Prellena, no guarda. El parser está atado a la maquetación de cada banco y
 * se rompe cuando el banco la cambia, así que lo que sale de acá va a campos
 * que la persona confirma.
 */

/** Dónde queda lo parseado para que la pantalla siguiente no vuelva a pedir el PDF. */
const HANDOFF_KEY = "llegas:resumen-parseado";

export function stashParsedStatement(parsed: ParseResult) {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(parsed));
  } catch {
    // Sin sessionStorage se pierde el atajo, no el dato: la pantalla
    // siguiente simplemente vuelve a pedir el PDF.
  }
}

export function takeParsedStatement(): ParseResult | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    return JSON.parse(raw) as ParseResult;
  } catch {
    return null;
  }
}

export function StatementImport({
  title = "Importar resumen",
  note = "Subí el PDF y completamos los campos de abajo. No se guarda nada hasta que revises y confirmes.",
  onParsed,
}: {
  title?: string;
  note?: string;
  onParsed: (parsed: ParseResult) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function read(file: File) {
    startTransition(async () => {
      const data = new FormData();
      data.set("pdf", file);
      const parsed = await parseStatementPdf(data);
      setResult(parsed);
      if (parsed.ok) onParsed(parsed);
    });
  }

  return (
    <section className="rounded-surface-lg border border-dashed border-border-dash bg-surface-sunken px-4 py-4">
      <h2 className="text-card text-ink">{title}</h2>
      <p className="help mt-1">{note}</p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        aria-label="PDF del resumen"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) read(file);
        }}
        className="mt-3 block w-full text-[12px] text-muted file:mr-3 file:min-h-touch file:cursor-pointer file:rounded-pill file:border file:border-border file:bg-surface file:px-4 file:text-[12px] file:font-semibold file:text-pine hover:file:bg-surface-arch"
      />

      {pending && (
        <p role="status" className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
          <Spinner className="text-teal" />
          Leyendo el PDF…
        </p>
      )}

      {result && !result.ok && (
        <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
          {result.message}
        </p>
      )}

      {result?.ok && (
        <div className="mt-3 rounded-surface border border-border bg-surface px-3 py-2">
          <p className="text-[11.5px] text-leaf-deep">
            Leímos {result.fileName ?? "el resumen"}. Revisá los campos de abajo antes de guardar.
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {result.cardName && <Row label="Tarjeta" value={`${result.cardName}${result.accountLast4 ? ` …${result.accountLast4}` : ""}`} />}
            {result.statementBalance != null && (
              <Row label="Saldo del resumen" value={formatMoney(result.statementBalance)} />
            )}
            {result.minimumPayment != null && (
              <Row label="Pago mínimo" value={formatMoney(result.minimumPayment)} />
            )}
            {result.annualRate != null && <Row label="TNA" value={`${result.annualRate}%`} />}
            {result.installments && result.installments.length > 0 && (
              <Row
                label="Compras en cuotas"
                value={String(result.installments.length)}
              />
            )}
          </ul>

          {/*
            Lo que el parser NO pudo leer se dice con todas las letras. Un cero
            puesto por nosotros es indistinguible de un cero real del resumen.
          */}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-border-row pt-2">
              {result.warnings.map((w) => (
                <li key={w} className="text-[11px] text-gold-ink">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className="shrink-0 font-mono text-ink">{value}</span>
    </li>
  );
}
