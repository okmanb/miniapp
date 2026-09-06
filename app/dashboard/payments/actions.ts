"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/data/dashboard";

export interface PaymentState {
  message: string | null;
}

export const EMPTY_PAYMENT_STATE: PaymentState = { message: null };

/**
 * Registrar un pago.
 *
 * No toca el saldo de la deuda: el saldo se deriva restando los pagos. Por eso
 * borrar un pago devuelve el saldo solo, sin ningún trabajo de reversión.
 *
 * Toma (estado, formData) en vez de solo formData porque el action de un form
 * tiene que devolver void, y acá hace falta poder mostrar el error —sobre todo
 * el de "ya hay un mínimo este mes", que es una regla de integridad y no un
 * detalle técnico.
 */
export async function createPayment(
  _prev: PaymentState,
  formData: FormData
): Promise<PaymentState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Tenés que iniciar sesión." };

  const debtId = String(formData.get("debt_id") ?? "");
  if (!debtId) return { message: "Elegí a qué deuda va el pago." };

  const amount = parseArgNumber(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { message: "Escribí un monto válido." };

  const { data: debt } = await supabase
    .from("debts")
    .select("id, scenario_id")
    .eq("id", debtId)
    .maybeSingle();

  if (!debt) return { message: "No encontramos esa deuda." };

  const kind = String(formData.get("kind") ?? "pago_variable");
  const paidOn = String(formData.get("paid_on") ?? "") || new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("debt_payments").insert({
    user_id: auth.user.id,
    scenario_id: debt.scenario_id,
    debt_id: debtId,
    period: paidOn.slice(0, 7),
    paid_on: paidOn,
    amount,
    kind,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) {
    // 23505 = el índice único parcial: un mínimo por deuda por mes.
    if (error.code === "23505") {
      return { message: "Ya hay un pago mínimo registrado para esta deuda este mes." };
    }
    return { message: "No pudimos registrar el pago." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/payments");
  redirect(`/dashboard/debts/${debtId}`);
}

/**
 * Borrar un pago mal cargado. El saldo vuelve solo porque se deriva.
 */
export async function deletePayment(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("debt_payments").delete().eq("id", id);
  if (error) return { ok: false, message: "No pudimos borrarlo." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}

export { currentPeriod };
