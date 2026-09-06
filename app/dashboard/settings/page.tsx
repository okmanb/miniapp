import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth-actions";
import { Card, Screen, Amount } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Ajustes (pantalla 16).
 *
 * Los números de arriba no son estadísticas de vanidad: son la respuesta a
 * "¿está todo cargado?". Un cero en ingresos explica por qué la proyección se
 * ve mal, y por eso cada uno lleva a donde se completa.
 */
export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const counts = { debts: 0, payments: 0, incomes: 0, expenses: 0 };

  if (scenario) {
    const [d, p, i, e] = await Promise.all([
      supabase.from("debts").select("id", { count: "exact", head: true }).eq("scenario_id", scenario.id).eq("is_active", true),
      supabase.from("debt_payments").select("id", { count: "exact", head: true }).eq("scenario_id", scenario.id),
      supabase.from("incomes").select("id", { count: "exact", head: true }).eq("scenario_id", scenario.id),
      supabase.from("expenses").select("id", { count: "exact", head: true }).eq("scenario_id", scenario.id),
    ]);
    counts.debts = d.count ?? 0;
    counts.payments = p.count ?? 0;
    counts.incomes = i.count ?? 0;
    counts.expenses = e.count ?? 0;
  }

  const STATS = [
    { label: "Deudas activas", value: counts.debts, href: "/dashboard" },
    { label: "Pagos registrados", value: counts.payments, href: "/dashboard/payments" },
    { label: "Ingresos cargados", value: counts.incomes, href: "/dashboard/incomes" },
    { label: "Gastos cargados", value: counts.expenses, href: "/dashboard/expenses" },
  ];

  const LINKS = [
    { label: "Alertas", note: "Qué miramos y por qué", href: "/dashboard/alerts" },
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
        <div className="text-card text-ink">{auth.user?.email ?? "Sin cuenta"}</div>
        <p className="mt-1 text-[11.5px] text-muted">
          Escenario activo: {scenario?.name ?? "ninguno"}
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border-row pt-3">
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

      <div className="mt-4 space-y-2">
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

      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          Cerrar sesión
        </button>
      </form>
    </Screen>
  );
}
