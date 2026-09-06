"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ScenarioResult = { ok: true } | { ok: false; message: string };

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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/scenarios");
  return { ok: true };
}

/**
 * Crear un escenario vacío.
 */
export async function createScenario(formData: FormData): Promise<ScenarioResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Poné un nombre para distinguirlo." };

  // El primero se activa solo. Crear el primer escenario y dejarlo apagado
  // deja la app en un callejón sin salida: el dashboard pide un escenario
  // activo y no hay ninguno que activar salvo volviendo acá.
  const { count } = await supabase
    .from("scenarios")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  const isFirst = (count ?? 0) === 0;

  const { error } = await supabase.from("scenarios").insert({
    user_id: auth.user.id,
    name,
    is_active: isFirst,
  });

  if (error) return { ok: false, message: "No pudimos crear el escenario." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scenarios");
  return { ok: true };
}

/**
 * Copiar un escenario con todos sus datos.
 *
 * La copia la hace la función copy_scenario de la base, no cinco inserts acá:
 * tiene que ser atómica. Un escenario copiado a medias —con las deudas pero
 * sin los gastos— es peor que no copiarlo, porque parece completo.
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

  revalidatePath("/dashboard/scenarios");
  return { ok: true };
}
