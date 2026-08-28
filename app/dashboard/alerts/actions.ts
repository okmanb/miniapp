"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveScenario, scenarioFilter } from "@/lib/scenarios";
import { computeAlerts, type AlertType } from "@/lib/alerts";
import type { DebtScheduleEntry } from "@/lib/debt-engine/schedule";

// Tipos que este archivo sabe calcular solo — ver lib/alerts. Al
// refrescar, solo tocamos alertas de ESTOS tipos (las que el
// usuario pueda haber cargado a mano de otro tipo quedan intactas).
const AUTO_COMPUTED_TYPES: AlertType[] = ["saldo_creciente", "vencimiento_hoy", "tasa_mas_cara"];

export async function refreshAlerts(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenario = await getActiveScenario(supabase, user.id);
  const filter = scenarioFilter(scenario);

  const { data: debts } = await supabase.from("debts").select("*").eq("is_active", true).or(filter);
  const debtIds = (debts ?? []).map((d) => d.id);

  const { data: entries } =
    debtIds.length > 0
      ? await supabase.from("debt_schedule_entries").select("*").in("debt_id", debtIds)
      : { data: [] as DebtScheduleEntry[] };

  const scheduleEntriesByDebt = new Map<string, DebtScheduleEntry[]>();
  for (const entry of entries ?? []) {
    const list = scheduleEntriesByDebt.get(entry.debt_id) ?? [];
    list.push(entry as DebtScheduleEntry);
    scheduleEntriesByDebt.set(entry.debt_id, list);
  }

  const computed = computeAlerts({ debts: debts ?? [], scheduleEntriesByDebt });

  // Los auto-generados anteriores que ya se resolvieron quedan
  // como registro histórico; solo se limpian los que seguían sin
  // resolver, para no duplicar la misma alerta cada vez que se
  // refresca.
  await supabase
    .from("alerts")
    .delete()
    .eq("scenario_id", scenario.id)
    .eq("resolved", false)
    .in("alert_type", AUTO_COMPUTED_TYPES);

  if (computed.length > 0) {
    await supabase.from("alerts").insert(
      computed.map((a) => ({
        user_id: user.id,
        scenario_id: scenario.id,
        debt_id: a.debt_id,
        alert_type: a.alert_type,
        severity: a.severity,
        message: a.message,
      }))
    );
  }

  revalidatePath("/dashboard/alerts");
  redirect("/dashboard/alerts");
}

export async function resolveAlert(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/alerts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/alerts");
}
