import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  // El nombre que se cargó al crear la cuenta, si se cargó. Encabezar Ajustes
  // con una persona y no con una dirección de mail es todo lo que hace ese dato.
  const fullName =
    typeof auth.user?.user_metadata?.full_name === "string"
      ? auth.user.user_metadata.full_name.trim()
      : "";
  const email = auth.user?.email ?? "";

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

  return (
    <SettingsView
      displayName={fullName || email || "Sin cuenta"}
      email={fullName ? email : ""}
      scenarioName={scenario?.name ?? null}
      counts={counts}
    />
  );
}
