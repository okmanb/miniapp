import Link from "next/link";
import { formatMoney } from "@/lib/calc/money";

/**
 * Hasta cuándo alcanza la plata. Valores medidos sobre el prototipo: radio
 * 14px, borde #DEE3DD, barra de acento de 4px a la izquierda, y el par
 * etiqueta/cifra abajo separado por una línea.
 *
 * La barra de acento es la severidad de la pantalla, así que cambia con el
 * dato y no es decorativa: verde mientras alcanza, brick cuando no llega a
 * fin de mes. El texto explica la causa; no regaña.
 */
export function RunwayCard({
  monthLabel,
  note,
  remaining,
  href = "/dashboard/cashflow",
}: {
  /** "octubre" — o null cuando no alcanza ni este mes. */
  monthLabel: string | null;
  note: string;
  remaining: number;
  href?: string;
}) {
  const short = monthLabel === null;
  const accent = short ? "#B14D3B" : "#25835D";

  return (
    <Link
      href={href}
      data-motion
      className="animate-card-in relative block overflow-hidden rounded-surface-lg border border-border bg-surface py-[14px] pl-[18px] pr-[28px] transition-colors duration-150 ease-sd hover:bg-surface-sunken"
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="absolute right-[14px] top-[14px] text-[18px] leading-none" style={{ color: "#B8C2B8" }} aria-hidden>
        ›
      </span>

      <div className="text-[15px] font-semibold text-ink" style={{ letterSpacing: "-.01em" }}>
        {short ? "No te alcanza este mes" : `Te alcanza hasta fin de ${monthLabel}`}
      </div>

      <p className="mt-1 text-[11px] leading-[1.45] text-muted" style={{ textWrap: "pretty" }}>
        {note}
      </p>

      <div className="mt-[11px] flex items-end justify-between border-t border-border-row pt-[11px]">
        <span
          className="font-mono text-[10px] uppercase text-muted"
          style={{ letterSpacing: ".06em" }}
        >
          Te queda
        </span>
        <span
          className="font-mono text-[18px] font-semibold tabular-nums"
          style={{ color: remaining < 0 ? "#B14D3B" : "#175F42" }}
        >
          {formatMoney(remaining)}
        </span>
      </div>
    </Link>
  );
}
