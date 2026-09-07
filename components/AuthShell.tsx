import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Marco de las pantallas de cuenta (12–14).
 *
 * No llevan barra inferior: todavía no hay a dónde navegar, y una barra con
 * todo deshabilitado es peor que ninguna.
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
    <main data-motion className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] py-10">
      <Link href="/" className="font-mono text-[12px] uppercase text-leaf-deep" style={{ letterSpacing: ".08em" }}>
        ¿Llegás?
      </Link>

      <h1 className="mt-6 text-screen text-ink">{title}</h1>
      {note ? <p className="help mt-1.5">{note}</p> : null}

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
      className="mt-4 rounded-surface border border-brick-border bg-brick-bg px-3 py-2 text-[11.5px] text-brick-ink"
    >
      {message}
    </p>
  );
}
