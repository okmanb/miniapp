"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveCardStatement } from "../actions";
import type { ScheduleKind } from "@/lib/debt-engine/schedule";

export async function confirmParsedStatement(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: card } = await supabase.from("debts").select("*").eq("id", debtId).single();
  if (!card) redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent("Tarjeta no encontrada.")}`);

  // Ya no hace falta la fila puente del resumen leído — limpiarla acá
  // evita ir acumulando basura en pending_statement_imports.
  const importId = formData.get("import_id") as string;
  if (importId) await supabase.from("pending_statement_imports").delete().eq("id", importId);

  // --- Crear como deudas hermanas las cuotas/refinanciación que el
  // usuario tildó como nuevas (ver schedule/actions.ts::createPlanVDebt) ---
  const planCount = Number(formData.get("plan_count")) || 0;

  for (let i = 0; i < planCount; i++) {
    const include = formData.get(`plan_include_${i}`) === "on";
    if (!include) continue;

    const cupon = formData.get(`plan_cupon_${i}`) as string;
    const totalInstallments = Number(formData.get(`plan_total_installments_${i}`));
    const installmentAmount = Number(formData.get(`plan_installment_amount_${i}`));
    const tna = formData.get(`plan_tna_${i}`) ? Number(formData.get(`plan_tna_${i}`)) : null;
    // "Cuota 9/18" en el resumen -> ya pasaron 8, quedan 10 por
    // financiar. Si no vino el dato, asumimos que arranca de cero.
    const currentInstallment = Number(formData.get(`plan_current_installment_${i}`)) || 1;
    const description = (formData.get(`plan_description_${i}`) as string) || "";
    const installmentsPaid = Math.max(currentInstallment - 1, 0);
    const installmentsRemaining = Math.max(totalInstallments - installmentsPaid, 0);

    if (!cupon || !totalInstallments || !installmentAmount) continue;

    // Refinanciación (Plan V / Cuotificación) siempre trae una tasa;
    // una compra en cuotas fijas sin interés del comercio, no — esa
    // ausencia es la diferencia real entre ambos productos, así que
    // el nombre la refleja en vez de llamarlos a todos "Plan V". Una
    // cuota SÍ trae el nombre del comercio (una refinanciación no
    // tiene uno propio, es sobre el saldo).
    const isRefinanciacion = tna != null && tna > 0;
    const debtName = isRefinanciacion
      ? `Refinanciación (cupón ${cupon})`
      : description
        ? `Cuota — ${description} (cupón ${cupon})`
        : `Cuota (cupón ${cupon})`;

    await supabase.from("debts").insert({
      user_id: user.id,
      scenario_id: card?.scenario_id,
      parent_debt_id: debtId,
      entity: card?.entity,
      name: debtName,
      debt_type: "plan_v",
      status: "al_dia",
      original_amount: installmentAmount * totalInstallments,
      current_balance: installmentAmount * installmentsRemaining,
      rate_type: "fixed",
      annual_interest_rate: tna,
      installments_total: totalInstallments,
      installments_paid: installmentsPaid,
      due_day: card?.due_day,
    });
  }

  // --- Guardar el resumen con los valores (posiblemente editados) ---
  const periodInput = formData.get("period") as string;
  const newCharges = Number(formData.get("new_charges")) || 0;
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const amountPaid = Number(formData.get("amount_paid")) || 0;
  const dueDate = (formData.get("due_date") as string) || null;
  const saldoAnteriorRaw = formData.get("saldo_anterior");
  const saldoAnterior = saldoAnteriorRaw !== null && saldoAnteriorRaw !== "" ? Number(saldoAnteriorRaw) : null;
  const paymentKind = (formData.get("payment_kind") as ScheduleKind) || undefined;

  if (!periodInput) {
    redirect(
      `/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent("Elegí el mes del resumen.")}`
    );
  }

  // Detalle línea por línea de los consumos, para poder
  // categorizarlos después en fijo/necesario vs. discrecional
  // (spec §2.4) — ver /dashboard/debts/[id]/charges.
  try {
    const chargeLines = JSON.parse((formData.get("charge_lines") as string) || "[]") as {
      description: string;
      amount: number;
    }[];
    if (chargeLines.length > 0) {
      await supabase.from("card_statement_charges").insert(
        chargeLines.map((c) => ({
          debt_id: debtId,
          user_id: user.id,
          period: `${periodInput}-01`,
          description: c.description,
          amount: c.amount,
        }))
      );
    }
  } catch {
    // Si vino mal formado, seguimos sin el detalle — el total ya
    // se guarda igual vía saveCardStatement.
  }

  const { error } = await saveCardStatement(supabase, user.id, debtId, {
    periodInput,
    newCharges,
    minimumPayment,
    amountPaid,
    dueDate,
    saldoAnterior,
    paymentKind,
  });

  if (error) {
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent(error)}`);
  }

  revalidatePath(`/dashboard/debts/${debtId}/schedule`);
  redirect(`/dashboard/debts/${debtId}/schedule`);
}
