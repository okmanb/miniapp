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

/**
 * La altura de TODO botón de acción de la app. Una sola, sin excepciones.
 *
 * Son 52 y no los 44 de `min-h-touch` porque 44 es el mínimo accesible, no una
 * medida cómoda: en el teléfono, un botón de 44 se puede tocar pero se toca
 * con cuidado. Un botón es lo único que hay que apretar en su pantalla y de
 * eso depende que la cosa avance.
 *
 * `min-h-touch` sigue existiendo y sigue siendo correcto para lo que NO es un
 * botón: las píldoras de filtro, las opciones de un `ChoiceGroup`, los
 * renglones que se tocan. Esos van en fila y no son la acción de la pantalla.
 */
const BUTTON_HEIGHT = "min-h-[52px]";

/**
 * El botón de contorno va UN PÍXEL más bajo, y no es un descuido.
 *
 * Con la misma altura exacta —52 los dos, medido— el claro se ve más alto que
 * el relleno. Es irradiación: una figura clara sobre un fondo claro se agranda
 * a la vista, y una oscura se contrae. Es el mismo motivo por el que un
 * círculo hay que dibujarlo más grande que un cuadrado para que se vean
 * iguales.
 *
 * Así que la regla del sistema sigue siendo 52, y el contorno lleva una
 * corrección óptica de −1 para LEERSE igual. Si alguien "arregla" esto
 * igualando los números, los botones vuelven a verse disparejos.
 */
const BUTTON_HEIGHT_OUTLINED = "min-h-[51px]";

/*
 * El borde va en la base aunque el primario no lo muestre, y esa es la parte
 * que importa: el secundario tiene borde de 1px y el primario no, así que con
 * `box-sizing: border-box` y una altura mínima el secundario terminaba 2px más
 * alto. 44 contra 46, en TODO par de la app.
 *
 * Dos píxeles no se notan mirando un botón; se notan mirando dos, uno encima
 * del otro, y se leen como que el de arriba quedó más finito. Así se descubrió,
 * en la puerta de entrada.
 *
 * El ANCHO del borde va acá y el COLOR en cada variante, para que no dependa
 * de cuál regla de Tailwind gane: las dos escriben `border-color`.
 */
const BUTTON_BASE =
  "inline-flex items-center justify-start gap-2 rounded-pill border " +
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
  const cls = `${BUTTON_BASE} ${BUTTON_HEIGHT} border-transparent bg-teal text-white hover:bg-teal-hover ${className}`;
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
  const cls = `${BUTTON_BASE} ${BUTTON_HEIGHT_OUTLINED} border-border bg-surface text-pine hover:bg-surface-sunken ${className}`;
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

/**
 * Los botones de la puerta de entrada: la landing y las pantallas de cuenta.
 *
 * Misma altura que los de adentro —no hay un botón grande de bienvenida y otro
 * chico adentro— y lo único que cambia es que acá ocupan todo el ancho y la
 * etiqueta se centra o se separa de la flecha. Son las mismas piezas puestas
 * en una pantalla vacía.
 */
/*
 * Sin `justify-*` en la base, a proposito: lo pone cada uso. Ponerlo acá y
 * pisarlo después no funciona —`justify-between` y `justify-center` escriben
 * la misma propiedad, y cuál gana lo decide el orden de la hoja de estilos de
 * Tailwind, no el orden en que uno escribe las clases—. Un botón que a veces
 * sale centrado y a veces no, según qué más se compiló ese día.
 */
const ENTRY_BASE =
  "flex w-full items-center gap-2 rounded-pill border px-5 py-[13px] " +
  "text-card transition-colors duration-150 ease-sd";

export const ENTRY_PRIMARY =
  `${ENTRY_BASE} ${BUTTON_HEIGHT} border-transparent bg-teal text-white hover:bg-teal-hover`;

/*
 * `border-border` y no `border-border-input`: el secundario de la app
 * (`SecondaryButton`) usa ese, y el tono de input es mas oscuro. Un borde mas
 * marcado le dibuja al boton claro un contorno mas definido, y eso agranda la
 * ilusion de que mide mas que el primario — que mide exactamente lo mismo.
 */
export const ENTRY_SECONDARY =
  `${ENTRY_BASE} ${BUTTON_HEIGHT_OUTLINED} border-border bg-surface text-pine hover:bg-surface-sunken`;

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
