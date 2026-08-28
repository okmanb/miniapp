"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function validatePayment(amountRaw: string, dateRaw: string): string | null {
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return "Ingresá un monto válido, mayor a 0.";
  }

  const date = new Date(dateRaw);
  if (!dateRaw || Number.isNaN(date.getTime())) {
    return "Ingresá una fecha válida.";
  }

  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
  if (date > oneWeekFromNow) {
    return "La fecha de pago no puede ser tan lejana en el futuro.";
  }

  return null;
}

export async function createPayment(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const amount = formData.get("amount") as string;
  const paymentDate = formData.get("payment_date") as string;
  const note = (formData.get("note") as string) || null;

  const validationError = validatePayment(amount, paymentDate);
  if (validationError) {
    redirect(
      `/dashboard/debts/${debtId}/payments?error=${encodeURIComponent(validationError)}`
    );
  }

  const { error } = await supabase.from("debt_payments").insert({
    debt_id: debtId,
    user_id: user.id,
    amount: Number(amount),
    payment_date: paymentDate,
    note,
  });

  if (error) {
    redirect(
      `/dashboard/debts/${debtId}/payments?error=${encodeURIComponent(error.message)}`
    );
  }

  // Restamos el pago del saldo actual de la deuda automáticamente,
  // así el usuario no tiene que actualizar los dos lugares a mano.
  const { data: debt } = await supabase
    .from("debts")
    .select("current_balance")
    .eq("id", debtId)
    .single();

  if (debt) {
    const newBalance = Math.max(Number(debt.current_balance) - Number(amount), 0);
    await supabase
      .from("debts")
      .update({ current_balance: newBalance })
      .eq("id", debtId)
      .eq("user_id", user.id);
  }

  revalidatePath(`/dashboard/debts/${debtId}/payments`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/debts/${debtId}/payments`);
}

export async function deletePayment(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const paymentId = formData.get("payment_id") as string;
  const debtId = formData.get("debt_id") as string;

  // Nota: a propósito NO revertimos el saldo de la deuda al borrar
  // un pago cargado por error — el usuario puede ajustar el saldo
  // a mano desde "Editar deuda" si hace falta. Revertir automático
  // es más confuso que útil acá.
  const { error } = await supabase
    .from("debt_payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", user.id);

  if (error) {
    redirect(
      `/dashboard/debts/${debtId}/payments?error=${encodeURIComponent(`No se pudo borrar el pago: ${error.message}`)}`
    );
  }

  revalidatePath(`/dashboard/debts/${debtId}/payments`);
}
