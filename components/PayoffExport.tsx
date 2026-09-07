"use client";

import { useState } from "react";

/**
 * Llevarse el plan.
 *
 * Un plan que solo existe adentro de la app no se comparte con quien te
 * banca, no se pega en una nota y no sobrevive a cerrar el navegador. El texto
 * plano es feo y es el formato que entra en todos lados.
 *
 * La previsualización no es un adorno: pegar algo sin haberlo visto es
 * exactamente cómo se filtran cifras a un grupo equivocado.
 */
export function PayoffExport({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const lines = text.split("\n").length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plan-destructor.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-ink">Llevate el plan</h2>
      <p className="help mt-1">
        El orden, los plazos y el interés total en texto plano, para pegarlo donde lo necesites.
      </p>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={copy}
          className="flex min-h-touch w-full items-center justify-between gap-2 rounded-pill border border-border bg-surface px-[16px] py-[10px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          <span>{copied ? "Copiado" : "Copiar al portapapeles"}</span>
          <span aria-hidden>{copied ? "✓" : "⧉"}</span>
        </button>

        <button
          type="button"
          onClick={download}
          className="flex min-h-touch w-full items-center justify-between gap-2 rounded-pill border border-border bg-surface px-[16px] py-[10px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          <span>Descargar como .txt</span>
          <span aria-hidden>↓</span>
        </button>
      </div>

      <details className="group mt-3">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-[12px] text-muted hover:text-pine">
          <span className="inline-flex items-center gap-1.5">
            Ver qué se copia
            <span
              className="transition-transform duration-200 ease-sd group-open:rotate-180"
              aria-hidden
            >
              ⌄
            </span>
          </span>
          <span className="font-mono text-[10.5px] uppercase">
            {lines} {lines === 1 ? "línea" : "líneas"}
          </span>
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-surface border border-border bg-surface-sunken px-3 py-3 font-mono text-[11px] leading-[1.5] text-ink">
          {text}
        </pre>
      </details>
    </section>
  );
}
