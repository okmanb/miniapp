"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/calc/dates";

export type ExpenseResult = { ok: false; message: string };

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const value = Number(normalized);
  return raw.trim() === "" || Number.isNaN(value) ? null : value;
}

/**
 * Crear un gasto (pantalla 05).
 *
 * Guarda siempre el mes y el escenario (regla 1). La diferencia entre fijo y
 * único es de comportamiento y vive en is_recurring: el fijo suma a cada mes
 * de la proyección, el único solo al mes en que se cargó.
 *
 * No toca ninguna columna de saldo. Si el gasto va a una tarjeta, el saldo de
 * esa tarjeta lo refleja porque se deriva — no porque acá lo sumemos.
 */
export async function createExpense(formData: FormData): Promise<ExpenseResult | never> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { ok: false, message: "Poné un nombre para reconocerlo después." };

  const amount = parseAmount(String(formData.get("amount") ?? ""));
  if (amount === null) return { ok: false, message: "Escribí un monto." };
  if (amount <= 0) return { ok: false, message: "El monto tiene que ser mayor que cero." };

  const isRecurring = formData.get("kind") === "fijo";
  const debtId = String(formData.get("debt_id") ?? "");
  const paidWith = debtId ? "tarjeta" : "efectivo";

  // Un consumo único es, por definición de esta pantalla, a una tarjeta.
  if (!isRecurring && !debtId) {
    return { ok: false, message: "Elegí a qué tarjeta va este consumo." };
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { ok: false, message: "No hay un escenario activo." };

  const { error } = await supabase.from("expenses").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    description,
    amount,
    period: currentPeriod(),
    is_recurring: isRecurring,
    paid_with: paidWith,
    debt_id: debtId || null,
    category: String(formData.get("category") ?? "") || null,
  });

  if (error) return { ok: false, message: "No pudimos guardar el gasto." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/expenses");
  redirect("/dashboard/expenses");
}

/**
 * Editar el monto de un gasto fijo (regla 4). Dos alcances:
 *
 * - "siempre": corrige el monto del registro, como si siempre hubiera sido
 *   ese. Es para arreglar un error de carga.
 * - "desde_ahora": cierra el registro viejo con el mes en que dejó de valer y
 *   abre uno nuevo desde este mes. El historial NO se reescribe, porque el
 *   gasto realmente valía lo otro antes.
 *
 * Son dos operaciones distintas a propósito: la app no puede adivinar si un
 * monto distinto es una corrección o un aumento.
 */
export async function updateExpenseAmount(formData: FormData): Promise<ExpenseResult | never> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const id = String(formData.get("id") ?? "");
  const scope = String(formData.get("scope") ?? "siempre");
  const amount = parseAmount(String(formData.get("amount") ?? ""));

  if (!id) return { ok: false, message: "Falta el gasto a editar." };
  if (amount === null || amount <= 0) return { ok: false, message: "Escribí un monto válido." };

  const { data: expense, error: readError } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readError || !expense) return { ok: false, message: "No encontramos ese gasto." };

  const period = currentPeriod();

  if (scope === "siempre" || !expense.is_recurring) {
    const { error } = await supabase.from("expenses").update({ amount }).eq("id", id);
    if (error) return { ok: false, message: "No pudimos guardar el cambio." };
  } else {
    // El registro viejo deja de valer a partir de este mes.
    const { error: closeError } = await supabase
      .from("expenses")
      .update({ ended_period: period })
      .eq("id", id);
    if (closeError) return { ok: false, message: "No pudimos cerrar el registro anterior." };

    const { error: insertError } = await supabase.from("expenses").insert({
      user_id: auth.user.id,
      scenario_id: expense.scenario_id,
      description: expense.description,
      amount,
      period,
      is_recurring: true,
      paid_with: expense.paid_with,
      debt_id: expense.debt_id,
      category: expense.category,
    });
    if (insertError) {
      // Si el nuevo no entró, se revierte el cierre: dejar el viejo cerrado y
      // ningún reemplazo abierto haría desaparecer el gasto de la proyección.
      await supabase.from("expenses").update({ ended_period: null }).eq("id", id);
      return { ok: false, message: "No pudimos crear el registro nuevo; no se cambió nada." };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/expenses");
  redirect("/dashboard/expenses");
}

/**
 * Terminar un gasto fijo (regla 5): deja de contar en la repetición mensual
 * desde este mes. No se borra — lo que ya sumó en meses anteriores sigue
 * siendo cierto.
 */
export async function endRecurringExpense(id: string): Promise<ExpenseResult | { ok: true }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .update({ ended_period: currentPeriod() })
    .eq("id", id);

  if (error) return { ok: false, message: "No pudimos terminarlo." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

/**
 * Recuperar un gasto archivado (regla 3): si el resumen no lo incluía, vuelve
 * a sumar al saldo de la tarjeta.
 */
export async function restoreExpense(id: string): Promise<ExpenseResult | { ok: true }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .update({ is_archived: false, archived_by_statement_id: null })
    .eq("id", id);

  if (error) return { ok: false, message: "No pudimos recuperarlo." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  return { ok: true };
}
