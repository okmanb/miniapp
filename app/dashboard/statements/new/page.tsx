import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatementForm } from "@/components/StatementForm";
import { EmptyState, PrimaryButton, Screen } from "@/components/ui";

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
  searchParams: Promise<{ deuda?: string }>;
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
        .select("id, name")
        .eq("scenario_id", scenario.id)
        .eq("kind", "tarjeta")
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver
      </Link>

      <h1 className="mt-2 text-screen text-ink">Cargar el resumen del mes</h1>
      <p className="help mt-1">
        Con estos cuatro números alcanza. El saldo de la tarjeta pasa a ser el que cierra este
        resumen, y los gastos que hayas cargado a mano se archivan porque ya vienen adentro.
      </p>

      {!cards || cards.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No hay tarjetas cargadas"
            note="Un resumen pertenece a una tarjeta. Agregá la tarjeta primero y después cargale el resumen."
            action={<PrimaryButton href="/dashboard/debts/new">Agregar una tarjeta</PrimaryButton>}
          />
        </div>
      ) : (
        <StatementForm
          cards={cards}
          defaultDebtId={query.deuda}
          defaultPeriod={previousPeriod()}
        />
      )}
    </Screen>
  );
}
