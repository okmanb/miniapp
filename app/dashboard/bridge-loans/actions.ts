"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/data/dashboard";
import { monthsBetween } from "@/lib/calc/bridge";

export type BridgeResult = { ok: true } | { ok: false; message: string };

/** Las tres pantallas que cambian cuando cambia un puente tomado. */
function revalidateBridge() {
  revalidatePath("/dashboard/bridge-loans");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard");
}

export async function createBridgeLoan(formData: FormData): Promise<BridgeResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const lender = String(formData.get("lender") ?? "").trim();
  if (!lender) return { ok: false, message: "Poné de dónde sale la plata." };

  const amount = parseArgNumber(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { ok: false, message: "Escribí un monto válido." };

  const takenPeriod = String(formData.get("taken_period") || currentPeriod());
  const repayPeriod = String(formData.get("repay_period") ?? "").trim();

  // Un puente sin mes de devolución es plata que entra y nunca sale: la
  // proyección quedaría más optimista de lo que es. Es el dato que hace que
  // esta pantalla sirva para algo.
  if (!repayPeriod) return { ok: false, message: "Falta en qué mes lo devolvés." };
  if (monthsBetween(takenPeriod, repayPeriod) < 1) {
    return { ok: false, message: "La devolución tiene que caer después del mes en que entra." };
  }

  // La tasa es mensual y opcional: un préstamo de un familiar suele no cobrar.
  const rawRate = String(formData.get("monthly_interest_rate") ?? "").replace(",", ".").trim();
  const rate = rawRate === "" ? null : Number(rawRate);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
    return { ok: false, message: "La tasa mensual tiene que ser un número, o vacía." };
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  // Nace simulado. Tomarlo es un segundo acto deliberado, porque es el que
  // mueve la proyección.
  const { error } = await supabase.from("bridge_loans").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    lender,
    amount,
    taken_period: takenPeriod,
    repay_period: repayPeriod,
    monthly_interest_rate: rate,
    is_taken: false,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) return { ok: false, message: "No pudimos guardar el puente." };

  revalidateBridge();
  return { ok: true };
}

/**
 * Simulado ⇄ tomado.
 *
 * Es el único interruptor de la pantalla que cambia números en otras: un
 * puente tomado entra en el flujo del mes en que llega y sale entero, con su
 * costo, en el mes en que se devuelve.
 */
export async function toggleBridgeTaken(id: string, taken: boolean): Promise<BridgeResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { error } = await supabase.from("bridge_loans").update({ is_taken: taken }).eq("id", id);
  if (error) return { ok: false, message: "No pudimos cambiar el estado del puente." };

  revalidateBridge();
  return { ok: true };
}

export async function deleteBridgeLoan(id: string): Promise<BridgeResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { error } = await supabase.from("bridge_loans").delete().eq("id", id);
  if (error) return { ok: false, message: "No pudimos borrar el puente." };

  revalidateBridge();
  return { ok: true };
}
