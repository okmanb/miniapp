"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveScenario } from "@/lib/scenarios";

export async function createBridgeLoan(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const source = (formData.get("source") as string)?.trim();
  const amount = Number(formData.get("amount"));
  const receivedMonth = formData.get("received_month") as string;
  const repayMonth = formData.get("repay_month") as string;
  const estimatedRate = formData.get("estimated_rate") ? Number(formData.get("estimated_rate")) : null;
  const chainedFromId = (formData.get("chained_from_id") as string) || null;

  if (!source || !amount || amount <= 0 || !receivedMonth || !repayMonth) {
    redirect(`/dashboard/bridge-loans?error=${encodeURIComponent("Revisá los datos del préstamo puente.")}`);
  }

  const scenario = await getActiveScenario(supabase, user.id);

  const { error } = await supabase.from("bridge_loans").insert({
    user_id: user.id,
    scenario_id: scenario.id,
    source,
    amount,
    received_month: `${receivedMonth}-01`,
    repay_month: `${repayMonth}-01`,
    estimated_rate: estimatedRate,
    chained_from_id: chainedFromId,
  });

  if (error) {
    redirect(`/dashboard/bridge-loans?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/bridge-loans");
  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/bridge-loans");
}

export async function markBridgeLoanRepaid(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("bridge_loans")
    .update({ repaid: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/bridge-loans?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/bridge-loans");
}

export async function deleteBridgeLoan(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;

  const { error } = await supabase.from("bridge_loans").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/bridge-loans?error=${encodeURIComponent(`No se pudo borrar: ${error.message}`)}`);
  }

  revalidatePath("/dashboard/bridge-loans");
  revalidatePath("/dashboard/cashflow");
}
