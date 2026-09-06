"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Saldo real de partida del escenario activo: cuenta + efectivo de hoy.
 *
 * Es el punto desde el que se encadena toda la proyección, así que vive en el
 * escenario y no en el usuario — el plan de contingencia puede partir de otro
 * colchón. Se guarda tal como lo escribe la persona: es un dato duro que ella
 * confirma, no una estimación nuestra.
 */
export async function setStartingBalance(formData: FormData): Promise<SaveResult> {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const raw = String(formData.get("starting_balance") ?? "").trim();
  // Formato argentino: se aceptan puntos de miles y coma decimal.
  const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const value = Number(normalized);

  if (raw === "" || Number.isNaN(value)) {
    return { ok: false, message: "Escribí un monto, aunque sea 0." };
  }
  if (value < 0) {
    return {
      ok: false,
      message: "El saldo de partida no puede ser negativo: si estás en rojo, cargalo como deuda.",
    };
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  const { error } = await supabase
    .from("scenarios")
    .update({ starting_balance: value })
    .eq("id", scenario.id);

  if (error) return { ok: false, message: "No pudimos guardar el saldo." };

  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard");
  return { ok: true };
}
