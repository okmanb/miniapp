"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddSheet } from "./AddSheet";

/**
 * Barra inferior. Valores medidos sobre el prototipo: degradado
 * #14503F → #0E3A31, hairline mint al tope, activo en mint y el resto en
 * blanco al 62%.
 *
 * El prototipo la dibuja con las esquinas de abajo redondeadas porque vive
 * dentro de un marco de teléfono. Acá va pegada al borde real de la pantalla,
 * así que esas esquinas no se replican: serían una maqueta dibujada dentro de
 * la app.
 */

const NAV_BACKGROUND = "linear-gradient(#14503F 0%, #0E3A31 100%)";

const ITEMS = [
  { href: "/dashboard", label: "Deudas", icon: WalletIcon },
  { href: "/dashboard/cashflow", label: "Flujo", icon: FlowIcon },
  { href: "/dashboard/payoff-plan", label: "Plan", icon: PlanIcon },
  { href: "/dashboard/alerts", label: "Alertas", icon: BellIcon },
];

export function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20"
      style={{
        backgroundImage: NAV_BACKGROUND,
        borderTop: "1px solid rgba(151,220,186,.22)",
        paddingBottom: "max(13px, env(safe-area-inset-bottom))",
      }}
    >
      <ul className="mx-auto flex max-w-[430px] items-stretch justify-around px-1 pt-[9px]">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} pathname={pathname} />
        ))}

        {/*
          El botón central es más alto que los ítems de texto y se apoya
          arriba, no centrado: así sobresale del borde de la barra en vez de
          flotar en el medio. Es lo que le da el relieve.
        */}
        <li className="flex items-start px-1">
          <AddSheet />
        </li>

        {ITEMS.slice(2).map((item) => (
          <NavItem
            key={item.href}
            {...item}
            pathname={pathname}
            badge={item.label === "Alertas" ? alertCount : 0}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  pathname: string;
  badge?: number;
}) {
  // El dashboard es prefijo de todas las demás, así que solo coincide exacto.
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <li className="flex-1">
      <Link
        href={href}
        data-ondark
        aria-current={active ? "page" : undefined}
        className="flex min-h-touch flex-col items-center justify-center gap-1 rounded-pill px-1 pb-2 pt-[7px] text-[11px] font-medium transition-colors duration-150 ease-sd"
        style={{ color: active ? "#97DCBA" : "rgba(226,238,232,.62)" }}
      >
        <span className="relative">
          <Icon />
          {badge > 0 && (
            <span
              className="absolute -right-2 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-1 font-mono text-[9.5px] font-semibold text-pine"
              style={{ backgroundColor: "#97DCBA" }}
            >
              {badge}
            </span>
          )}
        </span>
        {label}
      </Link>
    </li>
  );
}

/* Iconos de línea, 18px, trazo 1.6 — el sistema no usa iconos rellenos. */

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 5.5A1.5 1.5 0 0 1 4 4h9a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 14H4a1.5 1.5 0 0 1-1.5-1.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M11.5 9h1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 12.5 6 8.5l3 2.5 4.5-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 3.5h10M4 9h10M4 14.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 2.5a4 4 0 0 0-4 4v3l-1 2h10l-1-2v-3a4 4 0 0 0-4-4ZM7.5 13.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
