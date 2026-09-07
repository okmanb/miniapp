import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/ExpenseForm";
import { EmptyState, PrimaryButton, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
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

      <h1 className="mt-2 text-screen text-ink">Agregar gasto</h1>

      {scenario === null ? (
        <div className="mt-4">
          <EmptyState
            title="Falta un escenario activo"
            note="Los gastos cuelgan de un escenario: uno cargado en el plan base no existe en el de contingencia. Creá o activá uno y volvé."
            action={<PrimaryButton href="/dashboard/scenarios">Ir a escenarios</PrimaryButton>}
          />
        </div>
      ) : (
        <ExpenseForm cards={cards ?? []} />
      )}
    </Screen>
  );
}
