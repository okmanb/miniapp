/**
 * Primitivas del sistema. Los valores salen de medir el prototipo renderizado,
 * no de aproximar desde DESIGN.md — donde los dos difieren, gana el prototipo
 * y queda anotado acá.
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/* Tarjeta                                                                     */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      {...(animate ? { "data-motion": "" } : {})}
      className={`rounded-surface-lg border border-border bg-surface ${
        animate ? "animate-card-in" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Botones — un solo primario por vista                                        */
/* -------------------------------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex min-h-touch items-center justify-start gap-2 rounded-pill " +
  "px-[14px] py-[11px] text-card transition-colors duration-150 ease-sd";

export function PrimaryButton({
  children,
  href,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const cls = `${BUTTON_BASE} bg-teal text-white hover:bg-teal-hover ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  href,
  onClick,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `${BUTTON_BASE} border border-border bg-surface text-pine hover:bg-surface-sunken ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Cifras — toda cifra va en mono, alineada a la derecha en pares              */
/* -------------------------------------------------------------------------- */

export function Amount({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`font-mono tabular-nums ${className}`} style={style}>
      {children}
    </span>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-label uppercase text-muted">{children}</div>;
}

/** Par etiqueta/valor: la cifra siempre a la derecha. */
export function Row({
  label,
  value,
  valueClassName = "",
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-muted">{label}</span>
      <Amount className={`text-[13px] text-ink ${valueClassName}`}>{value}</Amount>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Estados de carga                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Chip de metadato de una fila: vencimiento, tipo de pago, tasa. Medido sobre
 * el prototipo — mono 9.5px/700 sobre el riel, radio 5px. Es el único lugar
 * del sistema con un radio fuera de los tres niveles, y sale de ahí.
 */
export function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-[5px] bg-track px-1.5 py-[3px] font-mono text-[9.5px] font-bold text-muted">
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-row bg-skeleton ${className}`} aria-hidden />;
}

/** Barra indeterminada del prototipo: sdSlide, 620ms. */
export function IndeterminateBar() {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-pill bg-track">
      <div data-motion className="h-full w-[30%] animate-slide rounded-pill bg-teal" />
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      data-motion
      className={`animate-spin ${className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Chevron de las secciones que se abren                                       */
/* -------------------------------------------------------------------------- */

/**
 * La flecha de un `<details>`, tal como la dibuja el prototipo.
 *
 * Acá había un glifo, `⌄` (U+2304), y se veía torcido: ese carácter se apoya
 * abajo de la caja, así que cerrado quedaba hundido respecto del texto y
 * abierto —rotado 180°— subía y recién ahí parecía centrado. No hay CSS que lo
 * arregle sin números mágicos, porque el problema son las métricas de la
 * fuente.
 *
 * El prototipo nunca lo uso: dibuja un SVG de 14px con trazo 2,4 y puntas
 * redondeadas. Un path rota alrededor de su centro y se ve igual en los dos
 * estados.
 *
 * La rotación la pone quien lo usa, normalmente `group-open:rotate-180` desde
 * el `<details>`.
 */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex text-muted transition-transform duration-[180ms] ease-sd ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Estado vacío y error                                                        */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-4 py-8 text-center">
      <div className="text-card-lg text-ink">{title}</div>
      <p className="help mx-auto mt-2 max-w-[38ch]">{note}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}

/**
 * Banner de error. Brick no se suaviza nunca: significa algo concreto.
 * Máximo dos severidades por pantalla.
 */
export function ErrorBanner({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-motion
      role="alert"
      className="animate-banner-in rounded-surface border border-brick-border bg-brick-bg px-4 py-3"
    >
      <div className="text-card text-brick-head">{title}</div>
      <p className="mt-1 text-help text-brick-ink" style={{ textWrap: "pretty" }}>
        {note}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Marco de pantalla                                                           */
/* -------------------------------------------------------------------------- */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main data-motion className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] pb-28 pt-4">
      {children}
    </main>
  );
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-screen text-ink">{children}</h1>;
}
