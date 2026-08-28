"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveScenario } from "@/lib/scenarios";

const INCOME_KINDS = ["sueldo", "adelanto", "bono", "aguinaldo", "changa", "otro"] as const;

function validateAmount(raw: string, label: string): string | null {
  const amount = Number(raw);
  if (!raw || Number.isNaN(amount)) return `Ingresá un ${label} válido.`;
  if (amount <= 0) return `El ${label} tiene que ser mayor a 0.`;
  if (amount > 1_000_000_000_000) return `Ese ${label} parece demasiado alto, revisalo.`;
  return null;
}

function currentMonthInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function createIncome(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const amount = formData.get("amount") as string;
  const kindRaw = (formData.get("kind") as string) || "otro";
  const kind = (INCOME_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "otro";
  const month = (formData.get("month") as string) || currentMonthInput();
  const isRecurring = formData.get("is_recurring") === "on";

  const amountError = validateAmount(amount, "monto");
  if (!name || amountError) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(amountError ?? "Ingresá un nombre.")}`);
  }

  const scenario = await getActiveScenario(supabase, user.id);

  const { error } = await supabase.from("incomes").insert({
    user_id: user.id,
    scenario_id: scenario.id,
    name,
    kind,
    month: `${month}-01`,
    amount: Number(amount),
    is_recurring: isRecurring,
  });

  if (error) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/cashflow");
}

export async function updateIncome(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const amount = formData.get("amount") as string;
  const kindRaw = (formData.get("kind") as string) || "otro";
  const kind = (INCOME_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "otro";
  const month = (formData.get("month") as string) || currentMonthInput();
  const isRecurring = formData.get("is_recurring") === "on";

  const amountError = validateAmount(amount, "monto");
  if (!name || amountError) {
    redirect(
      `/dashboard/cashflow/income/${id}/edit?error=${encodeURIComponent(amountError ?? "Ingresá un nombre.")}`
    );
  }

  const { error } = await supabase
    .from("incomes")
    .update({
      name,
      kind,
      month: `${month}-01`,
      amount: Number(amount),
      is_recurring: isRecurring,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/cashflow/income/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/cashflow");
}

export async function deleteIncome(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;
  const { error } = await supabase.from("incomes").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(`No se pudo borrar el ingreso: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/cashflow");
}

export async function createExpense(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const amount = formData.get("amount") as string;
  const month = (formData.get("month") as string) || currentMonthInput();
  const isRecurring = formData.get("is_recurring") === "on";
  const paidViaDebtId = (formData.get("paid_via_debt_id") as string) || null;

  const amountError = validateAmount(amount, "monto");
  if (!name || amountError) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(amountError ?? "Ingresá un nombre.")}`);
  }

  const scenario = await getActiveScenario(supabase, user.id);

  const { error } = await supabase.from("fixed_expenses").insert({
    user_id: user.id,
    scenario_id: scenario.id,
    name,
    month: `${month}-01`,
    amount: Number(amount),
    is_recurring: isRecurring,
    paid_via_debt_id: paidViaDebtId,
  });

  if (error) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/cashflow");
}

export async function updateExpense(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const amount = formData.get("amount") as string;
  const month = (formData.get("month") as string) || currentMonthInput();
  const isRecurring = formData.get("is_recurring") === "on";
  const paidViaDebtId = (formData.get("paid_via_debt_id") as string) || null;

  const amountError = validateAmount(amount, "monto");
  if (!name || amountError) {
    redirect(
      `/dashboard/cashflow/expenses/${id}/edit?error=${encodeURIComponent(amountError ?? "Ingresá un nombre.")}`
    );
  }

  const { error } = await supabase
    .from("fixed_expenses")
    .update({
      name,
      month: `${month}-01`,
      amount: Number(amount),
      is_recurring: isRecurring,
      paid_via_debt_id: paidViaDebtId,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/cashflow/expenses/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/cashflow");
}

export async function deleteExpense(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;
  const { error } = await supabase.from("fixed_expenses").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(`No se pudo borrar el gasto: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/cashflow");
}
