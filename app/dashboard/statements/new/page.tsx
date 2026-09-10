import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatementForm } from "@/components/StatementForm";
import { monthlyRateFromAnnual } from "@/lib/calc/money";
import { Screen, Chevron } from "@/components/ui";

export const dynamic = "force-dynamic";

/** El resumen que se carga suele ser el del mes pasado, no el de este. */
function previousPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function NewStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ deuda?: string; nueva?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: cards } = scenario
    ? await supabase
        .from("debts")
        .select("id, name, base_balance, annual_interest_rate, tem")
        .eq("scenario_id", scenario.id)
        .eq("kind", "tarjeta")
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  /*
   * Los dólares que ya convertimos en un resumen anterior.
   *
   * Si no se pagan, el banco los convierte él y los unifica con los pesos en
   * el resumen siguiente. Como acá ya entraron al saldo en pesos, cargarlos de
   * nuevo en "consumos nuevos" los sumaría dos veces — la misma forma que la
   * Regla 6 para los gastos. La app no lo puede detectar sola porque no lee el
   * saldo anterior del PDF, usa el nuestro; pero sí sabe que pasó, y avisar es
   * lo que puede hacer.
   */
  const { data: usdHistory } = scenario
    ? await supabase
        .from("card_statements")
        .select("debt_id, period, usd_balance, usd_rate")
        .eq("scenario_id", scenario.id)
        .gt("usd_balance", 0)
        .not("usd_rate", "is", null)
        .order("period", { ascending: false })
    : { data: [] };

  // El más reciente de cada tarjeta: es contra ese que se avisa.
  const lastUsdByDebt = new Map<string, { period: string; balance: number; rate: number }>();
  for (const row of usdHistory ?? []) {
    if (lastUsdByDebt.has(row.debt_id)) continue;
    lastUsdByDebt.set(row.debt_id, {
      period: row.period,
      balance: Number(row.usd_balance),
      rate: Number(row.usd_rate),
    });
  }

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver
      </Link>

      <h1 className="mt-2 text-screen text-ink">Agregar resumen del mes</h1>

      {/*
        Llegar acá recién creada la tarjeta es el camino corto: el PDF trae el
        saldo, el mínimo y las cuotas de una. Pero no puede ser obligatorio —
        el resumen puede no estar a mano — así que la salida está a la vista.
      */}
      {query.nueva && query.deuda && (
        <div className="mt-3 rounded-surface border border-border bg-mint-wash px-4 py-3">
          <p className="text-[12px] text-leaf-deep">
            Tarjeta creada. Si tenés el PDF del resumen a mano, subilo acá: de ahí salen el saldo,
            el pago mínimo y las compras en cuotas, sin cargar nada a mano.
          </p>
          <Link
            href={`/dashboard/debts/${query.deuda}`}
            className="mt-2 inline-flex min-h-touch items-center text-[12px] text-pine underline underline-offset-2"
          >
            Saltear por ahora
          </Link>
        </div>
      )}

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 text-card text-pine hover:text-leaf">
          Cómo funciona
          <Chevron className="group-open:rotate-180" />
        </summary>
        <p className="help mt-1">
          Con estos cuatro números alcanza. El saldo anterior y el interés se calculan solos; vos
          confirmás los consumos nuevos, el pago mínimo y cuánto pagaste realmente. El saldo de la
          tarjeta pasa a ser el que cierra este resumen, y los gastos que hayas cargado a mano se
          archivan porque ya vienen adentro. Lo que pongas en “cuánto pagaste” queda como un pago
          en tu historial. Si la tarjeta todavía no existe, elegí “Es una tarjeta nueva” y se crea
          acá con los datos del PDF.
        </p>
      </details>

      {/*
        Sin tarjetas cargadas esta pantalla mandaba al alta y volvía. Ya no hace
        falta: el formulario tiene "Es una tarjeta nueva" y la crea con este
        mismo resumen, que es de donde salen sus cuatro datos.
      */}
      <StatementForm
        cards={(cards ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          balance: Number(c.base_balance),
          // La misma prioridad que el resto de la app: la TEM cargada manda
          // sobre la TNA cuando están las dos.
          monthlyRate:
            c.tem != null ? Number(c.tem) : monthlyRateFromAnnual(c.annual_interest_rate),
          lastUsd: lastUsdByDebt.get(c.id) ?? null,
        }))}
        defaultDebtId={query.deuda}
        defaultPeriod={previousPeriod()}
      />
    </Screen>
  );
}
