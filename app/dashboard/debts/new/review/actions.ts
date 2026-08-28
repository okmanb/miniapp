"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { saveCardStatement } from "../../[id]/schedule/actions";
import type { ScheduleKind } from "@/lib/debt-engine/schedule";
import { getActiveScenario } from "@/lib/scenarios";

export async function confirmNewDebtFromStatement(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const annualInterestRate = formData.get("annual_interest_rate")
    ? Number(formData.get("annual_interest_rate"))
    : null;
  const dueDay = formData.get("due_day") ? Number(formData.get("due_day")) : null;
  const initialBalance = Number(formData.get("initial_balance")) || 0;

  if (!name) {
    redirect(`/dashboard/debts/new/upload?error=${encodeURIComponent("Falta el nombre de la tarjeta.")}`);
  }

  // original_amount queda como referencia informativa del saldo que
  // leyó el PDF al importar (no se usa en ningún cálculo). El saldo
  // real (current_balance) arranca en 0 a propósito: lo va a fijar
  // saveCardStatement más abajo, reconstruido desde SALDO ANTERIOR +
  // interés + consumos + cuotas de este resumen — nunca desde
  // "saldo actual" directo, que ya es un total y sumarle cosas
  // encima duplicaría todo (ver saveCardStatement).
  const scenario = await getActiveScenario(supabase, user.id);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      scenario_id: scenario.id,
      name,
      debt_type: "credit_card",
      original_amount: initialBalance,
      current_balance: 0,
      rate_type: "fixed",
      annual_interest_rate: annualInterestRate,
      due_day: dueDay,
    })
    .select()
    .single();

  if (debtError || !debt) {
    redirect(
      `/dashboard/debts/new/upload?error=${encodeURIComponent(debtError?.message ?? "Error creando la tarjeta.")}`
    );
  }

  const debtId = debt.id;

  // Ya no hace falta la fila puente del resumen leído — limpiarla acá
  // evita ir acumulando basura en pending_statement_imports.
  const importId = formData.get("import_id") as string;
  if (importId) await supabase.from("pending_statement_imports").delete().eq("id", importId);

  // --- Crear como deudas hermanas las cuotas/refinanciación que el
  // usuario tildó (ver schedule/actions.ts::createPlanVDebt) ---
  const planCount = Number(formData.get("plan_count")) || 0;
  for (let i = 0; i < planCount; i++) {
    const include = formData.get(`plan_include_${i}`) === "on";
    if (!include) continue;

    const cupon = formData.get(`plan_cupon_${i}`) as string;
    const totalInstallments = Number(formData.get(`plan_total_installments_${i}`));
    const installmentAmount = Number(formData.get(`plan_installment_amount_${i}`));
    const tna = formData.get(`plan_tna_${i}`) ? Number(formData.get(`plan_tna_${i}`)) : null;
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
      parent_debt_id: debtId,
      name: debtName,
      debt_type: "plan_v",
      status: "al_dia",
      original_amount: installmentAmount * totalInstallments,
      current_balance: installmentAmount * installmentsRemaining,
      rate_type: "fixed",
      annual_interest_rate: tna,
      installments_total: totalInstallments,
      installments_paid: installmentsPaid,
      due_day: dueDay,
    });
  }

  // --- Guardar el primer resumen ---
  const periodInput = formData.get("period") as string;
  const newCharges = Number(formData.get("new_charges")) || 0;
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const amountPaid = Number(formData.get("amount_paid")) || 0;
  const dueDate = (formData.get("due_date") as string) || null;
  const saldoAnteriorRaw = formData.get("saldo_anterior");
  const saldoAnterior = saldoAnteriorRaw !== null && saldoAnteriorRaw !== "" ? Number(saldoAnteriorRaw) : null;
  const paymentKind = (formData.get("payment_kind") as ScheduleKind) || undefined;

  try {
    const chargeLines = JSON.parse((formData.get("charge_lines") as string) || "[]") as {
      description: string;
      amount: number;
    }[];
    if (chargeLines.length > 0 && periodInput) {
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
    // Seguimos sin el detalle si vino mal formado.
  }

  if (periodInput) {
    await saveCardStatement(supabase, user.id, debtId, {
      periodInput,
      newCharges,
      minimumPayment,
      amountPaid,
      dueDate,
      saldoAnterior,
      paymentKind,
    });
  }

  redirect(`/dashboard/debts/${debtId}/schedule`);
}
