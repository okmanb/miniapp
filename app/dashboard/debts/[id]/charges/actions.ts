"use server";

import { createClient } from "@/lib/supabase/server";
import { currentPeriodString } from "@/lib/card-statements";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Cargar un gasto suelto apenas pasa (nafta, super, lo que sea) en
// vez de esperar al resumen del mes que viene — así el gasto queda
// como dato real desde ya, y "Con qué te enfrentás" lo puede sumar
// al saldo proyectado del mes en curso en vez de asumir $0 de
// consumo nuevo hasta que llegue el resumen bancario. Siempre se
// carga al mes calendario actual: no tiene sentido cargar un gasto
// "para el mes que viene" antes de que pase.
export async function addCardCharge(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const description = (formData.get("description") as string)?.trim();
  const amount = Number(formData.get("amount"));

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/dashboard/debts/${debtId}/charges?error=${encodeURIComponent("Completá descripción y monto.")}`);
  }

  const period = `${currentPeriodString()}-01`;

  const { error } = await supabase.from("card_statement_charges").insert({
    debt_id: debtId,
    user_id: user.id,
    period,
    description,
    amount,
    category: "sin_categorizar",
  });

  if (error) {
    redirect(`/dashboard/debts/${debtId}/charges?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/debts/${debtId}/charges`);
  revalidatePath(`/dashboard/debts/${debtId}/schedule`);
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/payoff-plan");
}

// Misma carga que addCardCharge, pero para el botón genérico "+
// Agregar gasto" del dashboard: ahí la tarjeta se elige en el propio
// formulario (no viene ya fijada por la URL de una tarjeta puntual),
// así que vuelve al dashboard en vez de a /charges de una tarjeta
// específica.
export async function addOneOffCardCharge(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const debtId = formData.get("debt_id") as string;
  const description = (formData.get("description") as string)?.trim();
  const amount = Number(formData.get("amount"));

  if (!debtId || !description || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/dashboard/expenses/new?error=${encodeURIComponent("Elegí la tarjeta y completá descripción y monto.")}`);
  }

  const period = `${currentPeriodString()}-01`;

  const { error } = await supabase.from("card_statement_charges").insert({
    debt_id: debtId,
    user_id: user.id,
    period,
    description,
    amount,
    category: "sin_categorizar",
  });

  if (error) {
    redirect(`/dashboard/expenses/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/debts/${debtId}/charges`);
  revalidatePath(`/dashboard/debts/${debtId}/schedule`);
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/payoff-plan");
  redirect("/dashboard");
}

export async function categorizeCharge(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;
  const category = formData.get("category") as string;

  if (!["fijo_necesario", "discrecional", "sin_categorizar"].includes(category)) {
    redirect(`/dashboard/debts/${debtId}/charges?error=${encodeURIComponent("Categoría inválida.")}`);
  }

  const { error } = await supabase
    .from("card_statement_charges")
    .update({ category })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/debts/${debtId}/charges?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/debts/${debtId}/charges`);
}
