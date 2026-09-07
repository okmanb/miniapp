"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextDueDate, snoozeUntil, type AlertKind } from "@/lib/calc/alerts";
import type { AlertChannel } from "@/lib/data/alert-settings";

export type AlertActionResult = { ok: true } | { ok: false; message: string };

function revalidateAlerts() {
  revalidatePath("/dashboard/alerts");
  revalidatePath("/dashboard");
}

/**
 * Posponer no descarta.
 *
 * La alerta vuelve mañana, o antes si el vencimiento aprieta: posponer no
 * puede tapar el aviso justo el día que importa. Por eso lo que se guarda es
 * hasta cuándo, y no un "vista" que la apague para siempre.
 */
export async function snoozeAlert(
  kind: AlertKind,
  subjectId: string,
  debtId: string | null
): Promise<AlertActionResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  let dueDate: Date | null = null;
  if (debtId) {
    const { data: debt } = await supabase
      .from("debts")
      .select("id, name, kind, due_day")
      .eq("id", debtId)
      .maybeSingle();

    if (debt) {
      dueDate = nextDueDate(
        {
          id: debt.id,
          name: debt.name,
          kind: debt.kind,
          balance: 0,
          annualRate: null,
          monthlyRate: 0,
          dueDay: debt.due_day,
          minimumPayment: null,
        },
        new Date()
      );
    }
  }

  const until = snoozeUntil({ dueDate });

  const { error } = await supabase.from("alert_dismissals").upsert(
    {
      user_id: auth.user.id,
      scenario_id: scenario.id,
      kind,
      subject_id: subjectId,
      dismissed_at: new Date().toISOString(),
      snoozed_until: until.toISOString(),
    },
    { onConflict: "scenario_id,kind,subject_id" }
  );

  if (error) return { ok: false, message: "No pudimos posponer esa alerta." };

  revalidateAlerts();
  return { ok: true };
}

export async function unsnoozeAllAlerts(): Promise<AlertActionResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  const { error } = await supabase
    .from("alert_dismissals")
    .delete()
    .eq("scenario_id", scenario.id);

  if (error) return { ok: false, message: "No pudimos reactivar las alertas." };

  revalidateAlerts();
  return { ok: true };
}

export async function saveAlertSettings(settings: {
  leadDays: number;
  channels: AlertChannel[];
  scope: "todas" | "algunas";
  onlyDebtIds: string[];
}): Promise<AlertActionResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  if (![0, 1, 3, 7].includes(settings.leadDays)) {
    return { ok: false, message: "Esa anticipación no es una de las opciones." };
  }
  // Una preferencia sin canales no es una preferencia: es no avisar, y para eso
  // están las alertas pospuestas.
  if (settings.channels.length === 0) {
    return { ok: false, message: "Dejá al menos un canal activo." };
  }
  if (settings.scope === "algunas" && settings.onlyDebtIds.length === 0) {
    return { ok: false, message: "Elegí al menos una deuda." };
  }

  const { error } = await supabase.from("alert_settings").upsert(
    {
      user_id: auth.user.id,
      lead_days: settings.leadDays,
      channels: settings.channels,
      scope: settings.scope,
      only_debt_ids: settings.scope === "algunas" ? settings.onlyDebtIds : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, message: "No pudimos guardar las preferencias." };

  revalidateAlerts();
  return { ok: true };
}
