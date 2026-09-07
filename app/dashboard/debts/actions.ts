"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readDebtInput, validateDebt, hasErrors, type FieldErrors } from "./validation";
import type { DebtFormState } from "./form-state";

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
  let newId = "";

  const values = {
    name: input.name,
    kind: input.kind,
    base_balance: input.baseBalance,
    annual_interest_rate: input.annualRate,
    due_day: input.dueDay,
    installments_total: input.installmentsTotal,
    installments_paid: input.installmentsPaid ?? 0,
    monthly_payment: input.monthlyPayment,
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

    const { data: created, error } = await supabase
      .from("debts")
      .insert({
        ...values,
        user_id: auth.user.id,
        scenario_id: scenario.id,
        base_balance_at: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (error || !created) return { errors: {}, message: "No pudimos crear la deuda." };
    newId = created.id;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");

  if (id) redirect(`/dashboard/debts/${id}`);

  // Una tarjeta recién creada sigue derecho al resumen: el PDF trae el saldo,
  // el mínimo y las cuotas de una, y cargarlos a mano es el trabajo que esta
  // app existe para ahorrar. Se puede saltear desde ahí.
  redirect(
    input.kind === "tarjeta"
      ? `/dashboard/statements/new?deuda=${newId}&nueva=1`
      : `/dashboard/debts/${newId}`
  );
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
