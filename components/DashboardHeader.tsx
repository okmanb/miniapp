import Link from "next/link";

/**
 * El encabezado del dashboard: el avatar, el saludo y el reloj.
 *
 * Los dos botones no son decoración — son las únicas puertas a dos pantallas
 * que existían y no se podían abrir. `/dashboard/settings` (16 · Ajustes) es
 * además la única que tiene "Cerrar sesión": sin este avatar, entrar a la app
 * era un camino de ida.
 *
 * Los dos son del prototipo, medidos: el avatar a la izquierda del saludo y el
 * historial a la derecha, en una fila con 13px de aire.
 */

const AVATAR_RING = "0 0 0 1px #0E3A31, 0 8px 18px -10px rgba(14,58,49,.75)";

export function DashboardHeader({
  greeting,
  dateLabel,
  fullName,
  email,
}: {
  /** El saludo por hora, para cuando la cuenta no tiene nombre cargado. */
  greeting: string;
  dateLabel: string;
  fullName: string;
  email: string;
}) {
  /*
   * Con nombre el saludo lo usa: "Hola, Ana" en vez de "Buenas tardes". Es del
   * prototipo, y adentro del dashboard siempre hay cuenta — el saludo por hora
   * queda para la cuenta sin nombre, no para la visita sin sesión.
   */
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const title = firstName ? `Hola, ${capitalize(firstName)}` : greeting;
  const initial = (fullName || email).trim().charAt(0).toUpperCase();

  return (
    <header className="mb-4 flex items-center gap-[13px]">
      <Link
        href="/dashboard/settings"
        aria-label="Ajustes y perfil"
        className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-pill text-[20px] font-semibold tracking-[-0.02em] transition-transform duration-150 ease-sd active:scale-[0.94]"
        style={{ backgroundColor: "#0E3A31", color: "#97DCBA", boxShadow: AVATAR_RING }}
      >
        {initial || <PersonIcon />}
      </Link>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-screen text-ink">{title}</h1>
        <p className="text-[12px] text-muted">{dateLabel}</p>
      </span>

      <Link
        href="/dashboard/payments"
        aria-label="Historial de pagos"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-border bg-surface text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        <ClockIcon />
      </Link>
    </header>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function PersonIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}
