"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";

export type ScenarioResult = { ok: true } | { ok: false; message: string };

/** Tope de la nota, el mismo que muestra el contador de la pantalla. */
const NOTE_MAX = 200;

function revalidateScenarios() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/scenarios");
}

/**
 * Activar un escenario. La base garantiza que haya uno solo activo por usuario
 * con un índice único parcial, así que hay que apagar el anterior antes de
 * prender el nuevo — si no, el índice rechaza el segundo.
 */
export async function activateScenario(id: string): Promise<ScenarioResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { error: offError } = await supabase
    .from("scenarios")
    .update({ is_active: false })
    .eq("user_id", auth.user.id)
    .eq("is_active", true);

  if (offError) return { ok: false, message: "No pudimos cambiar de escenario." };

  const { error } = await supabase.from("scenarios").update({ is_active: true }).eq("id", id);
  if (error) return { ok: false, message: "No pudimos activar ese escenario." };

  revalidateScenarios();
  return { ok: true };
}

/**
 * Crear un escenario, con o sin plan del que copiar las deudas.
 *
 * Lo hace la función create_scenario_from de la base y no cinco inserts acá:
 * tiene que ser atómica. Un escenario copiado a medias —con las deudas del
 * original y también con sus ingresos— proyecta el doble de plata entrando y
 * parece completo, que es peor que no copiarlo.
 */
export async function createScenario(formData: FormData): Promise<ScenarioResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Ponele un nombre al escenario." };

  const note = String(formData.get("note") ?? "").trim().slice(0, NOTE_MAX) || null;
  const seed = String(formData.get("seed") ?? "").trim();
  const startBalance = parseArgNumber(String(formData.get("starting_balance") ?? "")) ?? 0;
  const monthlyIncome = parseArgNumber(String(formData.get("monthly_income") ?? "")) ?? 0;
  const monthlyFixed = parseArgNumber(String(formData.get("monthly_fixed") ?? "")) ?? 0;

  const { count } = await supabase
    .from("scenarios")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  const isFirst = (count ?? 0) === 0;

  // Un escenario sin ingresos no es optimista: es incalculable. Se deja crear
  // igual —hay que poder empezar por las deudas— pero la lista lo va a marcar
  // como "sin datos para proyectar" en vez de mostrarle un colchón de cero.
  const { data: newId, error } = await supabase.rpc("create_scenario_from", {
    source_id: seed || null,
    new_name: name,
    new_note: note,
    start_balance: startBalance,
    monthly_income: monthlyIncome,
    monthly_fixed: monthlyFixed,
  });

  if (error) return { ok: false, message: "No pudimos crear el escenario." };

  // El primero se activa solo. Crear el primero y dejarlo apagado deja la app
  // en un callejón sin salida: el dashboard pide un escenario activo y no hay
  // ninguno que activar salvo volviendo acá.
  if (isFirst && newId) {
    await supabase.from("scenarios").update({ is_active: true }).eq("id", newId);
  }

  revalidateScenarios();
  return { ok: true };
}

export async function updateScenarioNote(id: string, note: string): Promise<ScenarioResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { error } = await supabase
    .from("scenarios")
    .update({ note: note.trim().slice(0, NOTE_MAX) || null })
    .eq("id", id);

  if (error) return { ok: false, message: "No pudimos guardar la nota." };

  revalidateScenarios();
  return { ok: true };
}

/**
 * Copiar un escenario tal cual, con todos sus datos — incluidos los ingresos.
 * Es distinto de crear uno nuevo copiando las deudas: acá no se reemplaza nada.
 */
export async function duplicateScenario(formData: FormData): Promise<ScenarioResult> {
  const supabase = await createClient();

  const sourceId = String(formData.get("source_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!sourceId) return { ok: false, message: "Falta el escenario a copiar." };
  if (!name) return { ok: false, message: "Poné un nombre para la copia." };

  const { error } = await supabase.rpc("copy_scenario", {
    source_id: sourceId,
    new_name: name,
  });

  if (error) return { ok: false, message: "No pudimos copiar el escenario." };

  revalidateScenarios();
  return { ok: true };
}
