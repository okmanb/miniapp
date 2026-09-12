import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Marco de las pantallas de cuenta (12–14).
 *
 * No llevan barra inferior: todavía no hay a dónde navegar, y una barra con
 * todo deshabilitado es peor que ninguna.
 *
 * ## El marco es el de la puerta de entrada, a propósito
 *
 * Antes era el nombre de la app en mono a 12px y un título, sobre el fondo
 * pelado: funcionaba y no decía nada. Ahora usa lo mismo que la landing —el
 * nombre a tamaño de display y la barra mint sosteniendo el título— para que
 * entrar por esta puerta se vea como el mismo producto que la anterior.
 *
 * Se probó una versión con una cabecera oscura y se descartó: la app entera es
 * clara, y una pantalla oscura justo después de una landing clara rompe lo
 * único que hace que el rojo signifique algo cuando aparece.
 *
 * Los campos NO cambiaron: mismo alto de 44, mismo radio, mismo borde, misma
 * etiqueta. Eso ya estaba bien y no había motivo para tocarlo.
 */
export function AuthShell({
  title,
  note,
  children,
}: {
  title: string;
  /** Vacío cuando la bajada cambia con el paso y la pone el propio contenido. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <main data-motion className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] pb-11 pt-[46px]">
      {/*
        "Volver" y no el nombre como link: el nombre acá abajo ya es grande y
        clickearlo no es obvio. Una salida explícita es una salida.
      */}
      <Link
        href="/"
        className="-mt-3 inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 ease-sd hover:text-pine"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="stroke-current">
          <path
            d="M13.5 8h-11M7 3.5 2.5 8 7 12.5"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Volver
      </Link>

      <p className="mt-2.5 text-[40px] font-extrabold leading-[.96] tracking-[-.04em] text-pine">
        ¿Llegás?
      </p>

      <div className="mt-5 border-l-2 border-mint pl-3.5">
        <h1 className="text-[19px] font-semibold leading-[1.25] tracking-[-.015em] text-ink">
          {title}
        </h1>
        {note ? <p className="help mt-1.5">{note}</p> : null}
      </div>

      {children}
    </main>
  );
}

export function AuthField({
  id,
  label,
  type,
  autoComplete,
  help,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  help?: string;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
      />
      {help && <p className="help mt-1.5">{help}</p>}
    </div>
  );
}

export function AuthSubmit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-6 flex min-h-touch w-full items-center justify-center rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
    >
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-surface border border-brick-border bg-brick-bg px-3 py-3 text-[11.5px] text-brick-ink"
    >
      {message}
    </p>
  );
}

/**
 * La salida a probar sin cuenta, desde una pantalla de cuenta.
 *
 * Existe por un callejón concreto: quien llega a `/login` sin tener cuenta
 * —desde un link, desde el historial— no tenía ninguna forma de llegar a
 * probar que no fuera el botón de atrás del navegador. La landing ofrece las
 * dos puertas; estas pantallas ofrecían una sola.
 */
export function AuthProbar() {
  return (
    <>
      <div className="mt-7 flex items-center gap-3">
        <span className="h-px grow bg-border" />
        {/* En minúscula: la "O" mayúscula en una mono de cifras tabulares se
            lee como un cero, y este separador quedaba diciendo "0". */}
        <span className="font-mono text-[10.5px] font-semibold tracking-[.06em] text-muted">o</span>
        <span className="h-px grow bg-border" />
      </div>

      <Link
        href="/?probar"
        className="mt-4 flex min-h-touch w-full items-center justify-between gap-2 rounded-pill border border-border-input bg-surface px-5 py-[13px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        <span>Probar sin cuenta</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="stroke-current">
          <path
            d="M2.5 8h11M9 3.5 13.5 8 9 12.5"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <p className="help mt-2.5">
        Probar no pide cuenta ni datos del banco. Lo que cargues se conserva si después creás
        una.
      </p>
    </>
  );
}
