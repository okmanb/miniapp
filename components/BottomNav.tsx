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

/**
 * Qué sección está abierta.
 *
 * Las tres secciones con ruta propia ganan por prefijo; "Deudas" se queda con
 * todo lo demás que cuelgue de `/dashboard` —cargar un resumen, editar una
 * deuda, un puente, ajustes—, que es de donde se entra a esas pantallas.
 *
 * Acá el prototipo se queda corto y no se lo copia: él marca la pestaña solo
 * en las cuatro pantallas raíz, porque las demás son vistas apiladas adentro
 * de un marco de teléfono y no se puede aterrizar en ellas. En la app son URLs
 * y sí se aterriza —el botón + lleva derecho a cinco de ellas—, así que dejar
 * la barra entera apagada sería contestar "en ninguna" a la pregunta de dónde
 * estoy parado.
 */
function activeHref(pathname: string): string {
  const match = ITEMS.slice(1).find((item) => pathname.startsWith(item.href));
  return match ? match.href : "/dashboard";
}

export function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const active = activeHref(pathname);

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
      <ul className="mx-auto flex max-w-[430px] items-stretch justify-around px-1 pt-[9px] [&>li]:min-w-0">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={item.href === active} />
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
            active={item.href === active}
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
  active,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: (props: { strokeWidth: number }) => React.JSX.Element;
  active: boolean;
  badge?: number;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        data-ondark
        aria-current={active ? "page" : undefined}
        /*
          Tres cosas marcan dónde estoy, no una: la píldora mint al 17% detrás
          del ítem, el color mint del texto y el ícono con trazo más grueso.
          Con el color solo —que era lo que había— la diferencia entre activo e
          inactivo es un cambio de opacidad sobre verde oscuro, y de reojo, en
          un teléfono, no se lee. La píldora es la que da el "presionado".
        */
        className="flex min-h-touch flex-col items-center justify-center gap-[3px] rounded-pill px-[2px] pb-2 pt-[7px] transition-colors duration-150 ease-sd"
        style={{
          color: active ? "#97DCBA" : "rgba(226,238,232,.62)",
          backgroundColor: active ? "rgba(151,220,186,.17)" : "transparent",
        }}
      >
        <span className="relative flex h-6 w-11 items-center justify-center">
          <Icon strokeWidth={active ? 2.1 : 1.7} />
          {badge > 0 && (
            <span
              /*
                El anillo del color de la barra recorta el globo del ícono. Sin
                él, el número se apoya encima de la campana y los dos trazos se
                confunden en uno.
              */
              className="absolute right-[9px] top-[-2px] flex h-[15px] min-w-[15px] items-center justify-center rounded-pill px-1 font-mono text-[9.5px] font-semibold leading-[15px] text-pine"
              style={{ backgroundColor: "#F0B0A0", boxShadow: "0 0 0 2px #10402F" }}
            >
              {badge}
            </span>
          )}
        </span>
        <span
          className="text-[10px] tracking-[0.01em]"
          style={{ fontWeight: active ? 600 : 400 }}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}

/*
 * Iconos de línea, 19px sobre caja de 24 — los del prototipo, trazo a trazo.
 * El grosor lo decide el ítem: 2.1 en el activo, 1.7 en el resto.
 */

function WalletIcon({ strokeWidth }: { strokeWidth: number }) {
  return (
    <Glyph strokeWidth={strokeWidth}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Glyph>
  );
}

function FlowIcon({ strokeWidth }: { strokeWidth: number }) {
  return (
    <Glyph strokeWidth={strokeWidth}>
      <path d="M3 3v18h18" />
      <path d="M7 14v4" />
      <path d="M12 9v9" />
      <path d="M17 12v6" />
    </Glyph>
  );
}

function PlanIcon({ strokeWidth }: { strokeWidth: number }) {
  return (
    <Glyph strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </Glyph>
  );
}

function BellIcon({ strokeWidth }: { strokeWidth: number }) {
  return (
    <Glyph strokeWidth={strokeWidth}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </Glyph>
  );
}

function Glyph({
  strokeWidth,
  children,
}: {
  strokeWidth: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
