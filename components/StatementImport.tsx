"use client";

import { useRef, useState, useTransition } from "react";
import { parseStatementPdf, type ParseResult } from "@/app/dashboard/statements/parse-actions";
import { formatMoney, formatRate } from "@/lib/calc/money";
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

/**
 * La tarjeta de "subí el PDF", sola.
 *
 * Vive aparte porque la usan dos pantallas con resúmenes distintos debajo —el
 * alta de una tarjeta y la carga del resumen del mes—, y cuando cada una tenía
 * su copia, arreglar una dejaba la otra con el `<input type="file">` crudo. Lo
 * que va debajo del selector lo pone cada pantalla por `children`.
 *
 * La tarjeta es blanca y sólida, y el punteado vive solo en la fila del
 * archivo. El control nativo trae su propio botón, su propia tipografía y su
 * propio idioma —"Choose file", "No file chosen"— y no hay CSS que lo alinee
 * con el resto, así que el input va oculto (a la vista, no al teclado) y lo
 * que se ve es la píldora del sistema con el nombre del archivo al lado.
 */
export function PdfCard({
  title,
  note,
  fileName,
  busy = false,
  onPick,
  children,
}: {
  title: string;
  note: string;
  /** Vacío mientras no se eligió nada. */
  fileName: string;
  /** Mientras lee, el botón de reintentar no tiene sentido. */
  busy?: boolean;
  onPick: (file: File) => void;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-surface-lg border border-border bg-surface p-[14px]">
      <h2 className="text-card text-pine">{title}</h2>
      <p className="help mt-1">{note}</p>

      <span className="mt-3 block text-label uppercase text-muted">Archivo</span>

      <label className="mt-1.5 flex cursor-pointer items-center gap-[10px] rounded-surface border border-dashed border-border-dash bg-surface-alt px-[10px] py-2 transition-colors duration-150 ease-sd focus-within:border-pine hover:border-pine">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          aria-label="PDF del resumen"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
          }}
          className="peer sr-only"
        />
        <span className="shrink-0 whitespace-nowrap rounded-pill border border-pine px-[13px] py-2 text-[12px] font-semibold text-pine peer-focus-visible:underline peer-focus-visible:underline-offset-4">
          Seleccionar archivo
        </span>
        <span
          className="min-w-0 truncate text-[12px]"
          style={{ color: fileName ? "#12211D" : "#8A9691" }}
        >
          {fileName || "Ningún archivo seleccionado"}
        </span>
      </label>

      {/*
        Leer arranca solo al elegir el archivo: pedir un segundo toque para
        empezar algo que ya se decidió es un paso de más. El botón aparece
        después, y es para volver a intentar cuando el parser falló o el
        archivo era el equivocado.
      */}
      {fileName && !busy && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex min-h-touch w-full items-center justify-center rounded-pill bg-teal px-[14px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
        >
          Volver a leer el PDF
        </button>
      )}

      {children}
    </section>
  );
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
  const [fileName, setFileName] = useState("");

  function read(file: File) {
    setFileName(file.name);
    startTransition(async () => {
      const data = new FormData();
      data.set("pdf", file);
      const parsed = await parseStatementPdf(data);
      setResult(parsed);
      if (parsed.ok) onParsed(parsed);
    });
  }

  return (
    <PdfCard title={title} note={note} fileName={fileName} busy={pending} onPick={read}>
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
            {result.annualRate != null && <Row label="TNA" value={formatRate(result.annualRate)} />}
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
    </PdfCard>
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
