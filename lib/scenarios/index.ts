/**
 * Escenario activo: el mismo usuario puede tener "Plan base" y
 * "Plan de contingencia" corriendo en paralelo (spec §1). Cuál está
 * activo en esta sesión de navegación se guarda en una cookie —no
 * en la URL de cada link— para no tener que propagar ?scenario=...
 * por todas las pantallas existentes.
 */

import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

export const ACTIVE_SCENARIO_COOKIE_NAME = "active_scenario_id";

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  is_base: boolean;
  notes: string | null;
  starting_cash_balance: number;
  created_at: string;
}

// Todo usuario tiene un "Plan base" — se crea en la migración para
// quien ya tenía datos, pero un usuario nuevo (o uno que corrió la
// app antes de esa migración) puede no tenerlo todavía.
export async function getOrCreateBaseScenario(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Scenario> {
  const { data: existing } = await supabase
    .from("scenarios")
    .select("*")
    .eq("user_id", userId)
    .eq("is_base", true)
    .maybeSingle();

  if (existing) return existing as Scenario;

  const { data: created, error } = await supabase
    .from("scenarios")
    .insert({ user_id: userId, name: "Plan base", is_base: true })
    .select()
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "No se pudo crear el escenario base.");
  }
  return created as Scenario;
}

// El escenario activo en esta sesión: el que eligió el usuario con
// el selector (cookie), o el base si todavía no eligió ninguno, o
// si el que tenía guardado ya no existe (lo borró, por ejemplo).
export async function getActiveScenario(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Scenario> {
  const activeId = cookies().get(ACTIVE_SCENARIO_COOKIE_NAME)?.value;

  if (activeId) {
    const { data } = await supabase
      .from("scenarios")
      .select("*")
      .eq("id", activeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return data as Scenario;
  }

  return getOrCreateBaseScenario(supabase, userId);
}

// Filtro para listar filas de una tabla con scenario_id que
// pertenecen al escenario activo. Al plan base también le sumamos
// las filas con scenario_id NULL: son datos cargados en la ventana
// entre la migración 002 y que el código de creación terminara de
// setear scenario_id en todos los flujos — tratarlas como "no
// asignadas todavía, caen en el base" evita que desaparezcan de la
// vista sin necesidad de un script de backfill aparte.
export function scenarioFilter(scenario: Scenario): string {
  return scenario.is_base ? `scenario_id.eq.${scenario.id},scenario_id.is.null` : `scenario_id.eq.${scenario.id}`;
}
