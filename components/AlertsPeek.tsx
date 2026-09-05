import Link from "next/link";

/**
 * Bandeja de alertas del dashboard. Los tres juegos de color salen del
 * prototipo y son los tres estados reales: nada pendiente, algo que cuesta
 * plata (gold) y algo que vence o hace crecer el saldo (brick).
 *
 * Brick y gold son severidades con significado y no se suavizan. Como el
 * dashboard ya puede mostrar brick en una deuda que crece, esta bandeja
 * respeta el techo de dos severidades por pantalla: es la misma severidad,
 * no una tercera.
 */

type Severity = "none" | "gold" | "brick";

const PALETTE: Record<Severity, { bg: string; border: string; fg: string; iconBg: string }> = {
  none: { bg: "#F3F6F2", border: "#DEE3DD", fg: "#0E3A31", iconBg: "#E4EAE3" },
  gold: { bg: "#FCF4E7", border: "#EBD9B8", fg: "#A77530", iconBg: "#FFFFFF" },
  brick: { bg: "#FDF0EC", border: "#EFCDC3", fg: "#B14D3B", iconBg: "#FFFFFF" },
};

export function AlertsPeek({
  count,
  severity,
  headline,
  href = "/dashboard/alerts",
}: {
  count: number;
  severity: Severity;
  /** Primera alerta, o el texto de "nada pendiente". */
  headline: string;
  href?: string;
}) {
  const c = PALETTE[severity];
  const title =
    count === 0
      ? "Sin alertas activas"
      : count === 1
        ? "1 alerta para revisar"
        : `${count} alertas para revisar`;

  return (
    <Link
      href={href}
      data-motion
      className="animate-card-in flex min-h-touch items-center gap-3 rounded-surface px-[15px] py-3 transition-opacity duration-150 ease-sd hover:opacity-90"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-pill"
        style={{ backgroundColor: c.iconBg }}
        aria-hidden
      >
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 2.5a4 4 0 0 0-4 4v3l-1 2h10l-1-2v-3a4 4 0 0 0-4-4ZM7.5 13.5a1.5 1.5 0 0 0 3 0"
            stroke={c.fg}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold" style={{ color: c.fg }}>
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted">{headline}</span>
      </span>
    </Link>
  );
}
