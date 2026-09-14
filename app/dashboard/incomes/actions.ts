"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/calc/dates";
import type { IncomeState } from "./form-state";

export type IncomeResult = { ok: false; message: string };

/**
 * Agregar un ingreso.
 *
 * El tipo decide en qué meses entra, y por eso no es una etiqueta:
 *  - mensual: todos los meses (eligible_months vacío).
 *  - aguinaldo: junio y diciembre.
 *  - bono: el mes que se elija.
 *
 * El sueldo puede venir en dos partes con montos distintos; se cargan como dos
 * ingresos mensuales separados, no como uno con el total, para poder cambiar
 * uno sin tocar el otro.
 */
export async function createIncome(
  _prev: IncomeState,
  formData: FormData
): Promise<IncomeState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Tenés que iniciar sesión." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { message: "Poné un nombre para reconocerlo." };

  const amount = parseArgNumber(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { message: "Escribí un monto válido." };

  const kind = String(formData.get("kind") ?? "mensual");

  let eligibleMonths: number[] = [];
  if (kind === "aguinaldo") {
    eligibleMonths = [6, 12];
  } else if (kind === "bono") {
    const month = Number(formData.get("bonus_month") ?? 0);
    if (!month || month < 1 || month > 12) {
      return { message: "Elegí en qué mes entra el bono." };
    }
    eligibleMonths = [month];
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { message: "No hay un escenario activo." };

  const { error } = await supabase.from("incomes").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    description,
    amount,
    kind,
    eligible_months: eligibleMonths,
    period: currentPeriod(),
  });

  if (error) return { message: "No pudimos guardar el ingreso." };

  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/incomes");
  redirect("/dashboard/incomes");
}

