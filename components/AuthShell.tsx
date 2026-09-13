import Link from "next/link";
import type { ReactNode } from "react";
import { ENTRY_PRIMARY, ENTRY_SECONDARY } from "@/components/ui";
import { entrarConGoogle, entrarConApple } from "@/app/auth-actions";

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
      className={`mt-6 ${ENTRY_PRIMARY} justify-center`}
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
 * Entrar con Google o con Apple, cuando el proyecto los tiene prendidos.
 *
 * Los botones aparecen solos: `proveedoresHabilitados()` le pregunta a
 * Supabase cuáles están activos, así que esto no hay que tocarlo el día que se
 * habilite uno — ni el día que se apague.
 *
 * Van DEBAJO del formulario de mail y clave, no arriba. Quien ya tiene cuenta
 * acá la tiene con mail, y mover el camino conocido abajo del todo hace que lo
 * busque. Para el que llega nuevo, el orden importa menos que la existencia.
 *
 * Los dos con el mismo peso visual y ninguno de ellos primario: el verde de
 * esta app es el de "seguir", y entrar con un proveedor es una alternativa, no
 * el camino recomendado.
 */
export function EntrarConProveedores({
  google,
  apple,
  verbo = "Entrar",
}: {
  google: boolean;
  apple: boolean;
  /** "Entrar" en el login; "Guardar mi cuenta" al convertir una prueba. */
  verbo?: string;
}) {
  if (!google && !apple) return null;

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <span className="h-px grow bg-border" />
        {/* En minúscula por lo mismo que el otro separador: la "O" mayúscula
            de una mono tabular se lee como un cero. */}
        <span className="font-mono text-[10.5px] font-semibold tracking-[.06em] text-muted">o</span>
        <span className="h-px grow bg-border" />
      </div>

      <div className="mt-4 space-y-2.5">
        {google && (
          <form action={entrarConGoogle}>
            <button type="submit" className={`${ENTRY_SECONDARY} justify-center`}>
              <LogoGoogle />
              {verbo} con Google
            </button>
          </form>
        )}
        {apple && (
          <form action={entrarConApple}>
            <button type="submit" className={`${ENTRY_SECONDARY} justify-center`}>
              <LogoApple />
              {verbo} con Apple
            </button>
          </form>
        )}
      </div>
    </>
  );
}

/** La G de Google, en sus cuatro colores. Es marca registrada: no se recolorea. */
function LogoGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** La manzana. Va en el color del texto, que es lo que pide Apple para fondo claro. */
function LogoApple() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0 fill-current">
      <path d="M17.05 12.54c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.98.9-3.77 2.29-1.61 2.79-.41 6.92 1.15 9.18.76 1.11 1.67 2.35 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.24.88-1.28 1.24-2.53 1.26-2.59-.03-.01-2.41-.93-2.41-3.71zM14.79 5.6c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.09 1.77-.95 2.81 1.02.08 2.06-.52 2.68-1.28z" />
    </svg>
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
export function AuthProbar({ separador = true }: { separador?: boolean }) {
  return (
    <>
      {/*
        El "o" va una sola vez por pantalla. Con los botones de proveedor
        prendidos ya hay uno arriba, y dos seguidos leen como si hubiera tres
        caminos alternativos en vez de una lista.
      */}
      {separador && (
        <div className="mt-7 flex items-center gap-3">
          <span className="h-px grow bg-border" />
          {/* En minúscula: la "O" mayúscula en una mono de cifras tabulares se
              lee como un cero, y este separador quedaba diciendo "0". */}
          <span className="font-mono text-[10.5px] font-semibold tracking-[.06em] text-muted">
            o
          </span>
          <span className="h-px grow bg-border" />
        </div>
      )}

      <Link
        href="/?probar"
        className={`${separador ? "mt-4" : "mt-2.5"} ${ENTRY_SECONDARY} justify-between`}
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
