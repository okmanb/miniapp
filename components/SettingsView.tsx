import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { Card, Screen, Amount } from "@/components/ui";
import { DeleteAllDataForm } from "@/components/DeleteAllDataForm";

/**
 * El cuerpo de la pantalla 16. Aparte de la página por lo mismo que la 03 y la
 * 15. Ojo: es la única pantalla con "Cerrar sesión", así que si alguna vez deja
 * de tener puerta de entrada, entrar a la app vuelve a ser un camino de ida.
 */
export interface SettingsCounts {
  debts: number;
  payments: number;
  incomes: number;
  expenses: number;
}

export function SettingsView({
  displayName,
  email,
  scenarioName,
  counts,
}: {
  displayName: string;
  /** Solo se muestra cuando además hay nombre: si no, ya es el título. */
  email: string;
  scenarioName: string | null;
  counts: SettingsCounts;
}) {
  const STATS = [
    { label: "Deudas activas", value: counts.debts, href: "/dashboard" },
    { label: "Pagos registrados", value: counts.payments, href: "/dashboard/payments" },
    { label: "Ingresos cargados", value: counts.incomes, href: "/dashboard/incomes" },
    { label: "Gastos cargados", value: counts.expenses, href: "/dashboard/expenses" },
  ];

  const LINKS = [
    { label: "Alertas y avisos", note: "Cuándo y por dónde te avisamos", href: "/dashboard/alerts" },
    { label: "Historial de pagos", note: "Todo lo que registraste", href: "/dashboard/payments" },
    { label: "Escenarios", note: "Con qué supuestos proyectamos", href: "/dashboard/scenarios" },
    { label: "Préstamos puente", note: "Plata que entra un mes y se devuelve en otro", href: "/dashboard/bridge-loans" },
  ];

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Ajustes</h1>

      <Card className="mt-4 px-4 py-4">
        <div className="text-card text-ink">{displayName}</div>
        <p className="mt-1 text-[11.5px] text-muted">
          {email ? `${email} · ` : ""}
          Escenario activo: {scenarioName ?? "ninguno"}
        </p>
      </Card>

      {/*
        Los rotulos de seccion salen del prototipo y hacen falta: sin ellos la
        pantalla es una lista de nueve cosas sin jerarquia, y la ultima —que
        borra todo— queda al lado de un enlace cualquiera.
      */}
      <h2 className="mt-6 text-label uppercase text-muted">Tus datos</h2>
      <Card className="mt-2 px-4 py-4">
        <dl className="grid grid-cols-2 gap-2">
          {STATS.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-row bg-surface-sunken px-3 py-2 transition-colors duration-150 ease-sd hover:bg-surface-arch"
            >
              <dt className="text-label uppercase text-muted">{stat.label}</dt>
              <dd>
                <Amount
                  className="text-[18px] font-semibold"
                  // Un cero acá explica por qué la proyección se ve rara, así
                  // que se marca en vez de pasar como un número más.
                >
                  <span style={{ color: stat.value === 0 ? "#A77530" : "#12211D" }}>
                    {stat.value}
                  </span>
                </Amount>
              </dd>
            </Link>
          ))}
        </dl>
      </Card>

      <h2 className="mt-6 text-label uppercase text-muted">Preferencias</h2>
      <div className="mt-2 space-y-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-touch items-center justify-between gap-3 rounded-surface border border-border bg-surface px-4 py-3 transition-colors duration-150 ease-sd hover:bg-surface-sunken"
          >
            <span className="min-w-0">
              <span className="block text-card text-ink">{link.label}</span>
              <span className="block truncate text-[11px] text-muted">{link.note}</span>
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mt-6 text-label uppercase text-muted">Cuenta</h2>

      <form action={logout} className="mt-2">
        <button
          type="submit"
          className="flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          Cerrar sesión
        </button>
      </form>

      <DeleteAllDataForm />
    </Screen>
  );
}
