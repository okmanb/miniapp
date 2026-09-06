"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/data/dashboard";

export type BridgeResult = { ok: true } | { ok: false; message: string };

export async function createBridgeLoan(formData: FormData): Promise<BridgeResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const lender = String(formData.get("lender") ?? "").trim();
  if (!lender) return { ok: false, message: "Poné de quién viene la plata." };

  const amount = parseArgNumber(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { ok: false, message: "Escribí un monto válido." };

  const takenPeriod = String(formData.get("taken_period") ?? currentPeriod());
  const repayPeriod = String(formData.get("repay_period") ?? "") || null;

  // Devolverlo antes de recibirlo no es un puente: es un error de carga.
  if (repayPeriod && repayPeriod <= takenPeriod) {
    return { ok: false, message: "La devolución tiene que caer después del mes en que entra." };
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  const { error } = await supabase.from("bridge_loans").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    lender,
    amount,
    taken_period: takenPeriod,
    repay_period: repayPeriod,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) return { ok: false, message: "No pudimos guardar el puente." };

  revalidatePath("/dashboard/bridge-loans");
  revalidatePath("/dashboard/cashflow");
  return { ok: true };
}
