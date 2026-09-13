import Link from "next/link";
import type { ReactNode } from "react";

/**
 * El marco de las dos páginas legales: privacidad y términos.
 *
 * Usa el mismo vocabulario que la puerta de entrada —el nombre a tamaño de
 * display, la barra mint sosteniendo el título— porque son públicas y se
 * llegan desde ahí. Una página legal con otra tipografía parece de otra
 * empresa, que es justo lo contrario de lo que tiene que transmitir.
 *
 * El ancho es el mismo 430 del resto de la app. Es un texto largo y en una
 * pantalla grande queda una columna angosta, pero esta app se usa en el
 * teléfono y partir el sistema por dos pantallas no vale la pena.
 */
export function PaginaLegal({
  titulo,
  bajada,
  actualizado,
  children,
}: {
  titulo: string;
  bajada: string;
  /** "13 de septiembre de 2026". Va arriba: una política sin fecha no sirve. */
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <main
      data-motion
      className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] pb-14 pt-[46px]"
    >
      <Link
        href="/"
        className="-mt-3 inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 ease-sd hover:text-pine"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="stroke-current">
          <path d="M13.5 8h-11M7 3.5 2.5 8 7 12.5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver
      </Link>

      <p className="mt-2.5 text-[40px] font-extrabold leading-[.96] tracking-[-.04em] text-pine">
        ¿Llegás?
      </p>

      <div className="mt-5 border-l-2 border-mint pl-3.5">
        <h1 className="text-[19px] font-semibold leading-[1.25] tracking-[-.015em] text-ink">
          {titulo}
        </h1>
        <p className="help mt-1.5">{bajada}</p>
      </div>

      <p className="mt-4 font-mono text-label uppercase text-muted">
        Última actualización: {actualizado}
      </p>

      <div className="mt-2">{children}</div>

      <div className="mt-9 border-t border-border pt-5">
        <p className="help">
          Si algo de acá no se entiende o no coincide con lo que ves en la app, escribinos:
          preferimos corregir el texto antes que dejarlo lindo.
        </p>
      </div>
    </main>
  );
}

/** Una sección: título y párrafos. El cuerpo va a 13px, como el resto. */
export function SeccionLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold leading-[1.3] tracking-[-.01em] text-ink">
        {titulo}
      </h2>
      <div className="mt-2 space-y-2.5 text-[13px] leading-[1.55] text-muted">{children}</div>
    </section>
  );
}

/** Una lista de la sección, con el guion del sistema y no un bullet. */
export function ListaLegal({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="shrink-0 text-border-input">
            —
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
