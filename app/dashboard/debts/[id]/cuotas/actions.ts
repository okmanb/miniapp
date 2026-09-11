"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/calc/dates";
import { installmentFor } from "@/lib/calc/installments";

export type InstallmentResult = { ok: true } | { ok: false; message: string };

/** Más de 60 cuotas no es un plan de tarjeta. El tope es el del prototipo. */
const MAX_INSTALLMENTS = 60;

/**
 * Cargar a mano una compra en cuotas.
 *
 * Dos escrituras, y las dos son necesarias:
 *
 *  - El plan, para que la compra aparezca con su plazo y su tasa propios.
 *  - Un gasto cargado a la tarjeta por el monto total, porque comprar en
 *    cuotas sube el saldo de la tarjeta hoy. Sin eso el plan existiría y el
 *    saldo seguiría siendo el de antes de la compra.
 *
 * El gasto se archiva solo cuando entre el resumen que ya lo traiga: es el
 * mismo camino que sigue cualquier gasto cargado a mano.
 */
export async function createInstallmentPlan(formData: FormData): Promise<InstallmentResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const debtId = String(formData.get("debt_id") ?? "");
  if (!debtId) return { ok: false, message: "Falta la tarjeta." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { ok: false, message: "Falta qué compraste." };

  const total = parseArgNumber(String(formData.get("total") ?? ""));
  if (total === null || total <= 0) return { ok: false, message: "Falta el monto total de la compra." };

  const count = parseArgNumber(String(formData.get("installments") ?? ""));
  if (count === null || count < 1) return { ok: false, message: "Falta en cuántas cuotas quedó." };
  if (count > MAX_INSTALLMENTS) {
    return { ok: false, message: "Más de 60 cuotas no es un plan de tarjeta." };
  }

  const rawTna = String(formData.get("tna") ?? "").replace(",", ".").trim();
  const tna = rawTna === "" ? 0 : Number(rawTna);
  if (!Number.isFinite(tna) || tna < 0) {
    return { ok: false, message: "La TNA tiene que ser un número, o vacía." };
  }

  const { data: debt } = await supabase
    .from("debts")
    .select("id, scenario_id")
    .eq("id", debtId)
    .maybeSingle();

  if (!debt) return { ok: false, message: "No encontramos esa tarjeta." };

  const period = currentPeriod();
  const amount = Math.round(installmentFor(total, Math.round(count), tna / 100 / 12));

  const { error: planError } = await supabase.from("card_installment_plans").insert({
    user_id: auth.user.id,
    scenario_id: debt.scenario_id,
    debt_id: debtId,
    cupon: null,
    description,
    first_period: period,
    total_installments: Math.round(count),
    installment_amount: amount,
    tna,
    is_active: true,
  });

  if (planError) return { ok: false, message: "No pudimos guardar la compra en cuotas." };

  const { error: expenseError } = await supabase.from("expenses").insert({
    user_id: auth.user.id,
    scenario_id: debt.scenario_id,
    description,
    amount: total,
    period,
    is_recurring: false,
    paid_with: "tarjeta",
    debt_id: debtId,
  });

  if (expenseError) {
    return {
      ok: false,
      message: "Guardamos la compra pero no pudimos sumarla al saldo de la tarjeta.",
    };
  }

  revalidatePath(`/dashboard/debts/${debtId}`);
  revalidatePath(`/dashboard/debts/${debtId}/cuotas`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  return { ok: true };
}

/**
 * Regla 3: archivar, no borrar. Una compra en cuotas que se saca de la lista
 * sigue habiendo pasado, y su gasto ya movió el saldo de la tarjeta.
 */
export async function archiveInstallmentPlan(
  id: string,
  debtId: string
): Promise<InstallmentResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { error } = await supabase
    .from("card_installment_plans")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { ok: false, message: "No pudimos sacarla de la lista." };

  revalidatePath(`/dashboard/debts/${debtId}/cuotas`);
  revalidatePath(`/dashboard/debts/${debtId}`);
  revalidatePath("/dashboard/cashflow");
  return { ok: true };
}
