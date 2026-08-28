"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { extractFormValues, validateDebtForm } from "./validation";
import { getActiveScenario } from "@/lib/scenarios";

export async function createDebt(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const values = extractFormValues(formData);
  const result = validateDebtForm(values);

  if (!result.valid) {
    // Mandamos los errores por campo y los valores ya tipeados de
    // vuelta al form, codificados en la URL, para que el usuario no
    // pierda lo que ya había cargado.
    const params = new URLSearchParams({
      errors: JSON.stringify(result.errors),
      values: JSON.stringify(values),
    });
    redirect(`/dashboard/debts/new?${params.toString()}`);
  }

  const scenario = await getActiveScenario(supabase, user.id);

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    scenario_id: scenario.id,
    ...result.data,
  });

  if (error) {
    // Esto ahora solo debería pasar por errores inesperados de DB/red,
    // no por datos mal formados (ya los filtramos arriba).
    const params = new URLSearchParams({
      errors: JSON.stringify({ name: `Error guardando: ${error.message}` }),
      values: JSON.stringify(values),
    });
    redirect(`/dashboard/debts/new?${params.toString()}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateDebt(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const values = extractFormValues(formData);
  const result = validateDebtForm(values);

  if (!result.valid) {
    const params = new URLSearchParams({
      errors: JSON.stringify(result.errors),
      values: JSON.stringify(values),
    });
    redirect(`/dashboard/debts/${debtId}/edit?${params.toString()}`);
  }

  const { error } = await supabase
    .from("debts")
    .update(result.data)
    .eq("id", debtId)
    .eq("user_id", user.id); // defensa en profundidad además de RLS

  if (error) {
    const params = new URLSearchParams({
      errors: JSON.stringify({ name: `Error guardando: ${error.message}` }),
      values: JSON.stringify(values),
    });
    redirect(`/dashboard/debts/${debtId}/edit?${params.toString()}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteDebt(formData: FormData) {
  const supabase = createClient();
  const debtId = formData.get("debt_id") as string;

  // RLS ya garantiza que solo puede borrar sus propias deudas, pero
  // igual filtramos por user_id como defensa en profundidad.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Borrar una tarjeta se lleva puestas sus cuotas/refinanciaciones
  // hijas — no quedan sueltas. El aviso de DeleteDebtButton ya le
  // dio al usuario la chance de cancelar si no quería perderlas.
  const { error: childrenError } = await supabase
    .from("debts")
    .delete()
    .eq("parent_debt_id", debtId)
    .eq("user_id", user.id);

  if (childrenError) {
    redirect(`/dashboard?error=${encodeURIComponent(`No se pudieron borrar las cuotas vinculadas: ${childrenError.message}`)}`);
  }

  const { error } = await supabase.from("debts").delete().eq("id", debtId).eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(`No se pudo borrar la deuda: ${error.message}`)}`);
  }

  revalidatePath("/dashboard");
}
