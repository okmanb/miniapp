"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/data/dashboard";

export type ImportResult =
  | { ok: true; imported: boolean }
  | { ok: false; message: string };

/**
 * Subir el borrador del onboarding a la cuenta recién creada.
 *
 * El onboarding funciona sin sesión y guarda en el navegador. Cuando la
 * persona decide guardar de verdad, esto siembra el primer escenario con lo
 * que ya había cargado — si no, habría que pedirle los mismos tres datos otra
 * vez, que es la forma más rápida de perder a alguien.
 *
 * Es idempotente por omisión: si el usuario ya tiene un escenario, no importa
 * nada y devuelve imported:false. Volver a la raíz con un borrador viejo en
 * el navegador no puede duplicarle las deudas.
 */
export async function importOnboardingDraft(draft: {
  kind: string;
  balance: number;
  annualRate: number;
  dueDay: number;
  monthlyIncome: number;
  fixedExpenses: number;
}): Promise<ImportResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  if (!(draft.balance > 0)) return { ok: true, imported: false };

  // Si ya hay escenario, el onboarding llegó tarde: esta cuenta ya tiene
  // datos y sembrarle una deuda de un borrador viejo sería ensuciarla.
  const { count } = await supabase
    .from("scenarios")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  if ((count ?? 0) > 0) return { ok: true, imported: false };

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .insert({
      user_id: auth.user.id,
      name: "Plan base",
      is_active: true,
      // Lo que sobra después de vivir es el punto de partida de la caja.
      starting_balance: Math.max(draft.monthlyIncome - draft.fixedExpenses, 0),
    })
    .select("id")
    .single();

  if (scenarioError || !scenario) {
    return { ok: false, message: "No pudimos crear tu plan base." };
  }

  // "familiar" y "servicio" no tienen tipo propio en el esquema: son deudas
  // que se pagan en cuotas sin ser ni tarjeta ni préstamo bancario.
  const schemaKind =
    draft.kind === "tarjeta"
      ? "tarjeta"
      : draft.kind === "prestamo_personal"
        ? "prestamo_personal"
        : "otro";

  const debtName =
    draft.kind === "tarjeta"
      ? "Tarjeta de crédito"
      : draft.kind === "prestamo_personal"
        ? "Préstamo personal"
        : draft.kind === "familiar"
          ? "Familiar o amigo"
          : "Servicio atrasado";

  const { error: debtError } = await supabase.from("debts").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    name: debtName,
    kind: schemaKind,
    base_balance: draft.balance,
    base_balance_at: new Date().toISOString().slice(0, 10),
    annual_interest_rate: draft.annualRate,
    due_day: draft.dueDay,
  });

  if (debtError) return { ok: false, message: "No pudimos guardar tu deuda." };

  const period = currentPeriod();

  if (draft.monthlyIncome > 0) {
    await supabase.from("incomes").insert({
      user_id: auth.user.id,
      scenario_id: scenario.id,
      description: "Ingreso mensual",
      amount: draft.monthlyIncome,
      kind: "mensual",
      eligible_months: [],
      period,
    });
  }

  if (draft.fixedExpenses > 0) {
    // Entra como UN gasto fijo llamado como lo llamó el onboarding, no
    // desglosado: la persona cargó un total, no una lista, e inventarle
    // categorías sería ponerle palabras que no dijo.
    await supabase.from("expenses").insert({
      user_id: auth.user.id,
      scenario_id: scenario.id,
      description: "Gastos fijos del mes",
      amount: draft.fixedExpenses,
      period,
      is_recurring: true,
      paid_with: "efectivo",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  return { ok: true, imported: true };
}
