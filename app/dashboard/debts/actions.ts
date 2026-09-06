"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readDebtInput, validateDebt, hasErrors, type FieldErrors } from "./validation";

export interface DebtFormState {
  errors: FieldErrors;
  message: string | null;
}

export const EMPTY_STATE: DebtFormState = { errors: {}, message: null };

/**
 * Alta y edición de una deuda.
 *
 * La validación corre acá aunque el formulario ya haya validado en el
 * cliente: lo del cliente es una cortesía para no hacer ida y vuelta, y un
 * POST puede llegar sin pasar por él.
 *
 * Nunca se escribe un saldo derivado. base_balance es el punto de partida —
 * el saldo del último resumen— y el saldo vigente sale de sumarle los gastos
 * abiertos y restarle los pagos.
 */
export async function saveDebt(
  _prev: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { errors: {}, message: "Tenés que iniciar sesión." };

  const input = readDebtInput(formData);
  const errors = validateDebt(input);
  if (hasErrors(errors)) {
    return { errors, message: "Revisá los campos marcados." };
  }

  const id = String(formData.get("id") ?? "");

  const values = {
    name: input.name,
    kind: input.kind,
    base_balance: input.baseBalance,
    annual_interest_rate: input.annualRate,
    due_day: input.dueDay,
    installments_total: input.installmentsTotal,
    installments_paid: input.installmentsPaid ?? 0,
  };

  if (id) {
    const { error } = await supabase.from("debts").update(values).eq("id", id);
    if (error) return { errors: {}, message: "No pudimos guardar los cambios." };
  } else {
    const { data: scenario } = await supabase
      .from("scenarios")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (!scenario) {
      return { errors: {}, message: "No hay un escenario activo donde guardar la deuda." };
    }

    const { error } = await supabase.from("debts").insert({
      ...values,
      user_id: auth.user.id,
      scenario_id: scenario.id,
      base_balance_at: new Date().toISOString().slice(0, 10),
    });
    if (error) return { errors: {}, message: "No pudimos crear la deuda." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  redirect(id ? `/dashboard/debts/${id}` : "/dashboard");
}

/**
 * Archivar una deuda. No se borra: sus pagos y resúmenes son historial real, y
 * borrarla los dejaría huérfanos o se los llevaría puestos.
 */
export async function archiveDebt(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("debts").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, message: "No pudimos archivarla." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  return { ok: true };
}
