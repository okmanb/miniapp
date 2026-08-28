"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  calculateStatement,
  resolveCarriedBalance,
  totalInstallmentsDue,
  totalRemainingInstallmentBalance,
  type InstallmentPlan,
} from "@/lib/card-statements";
import type { ScheduleKind } from "@/lib/debt-engine/schedule";

// --- Compras en cuotas (Plan V) ---
//
// Cada compra financiada es su propia deuda hija (debt_type =
// 'plan_v', parent_debt_id = la tarjeta), no una fila en una tabla
// aparte. Así el motor de proyección (lib/debt-engine/schedule.ts)
// la amortiza con la misma lógica de sistema francés que ya usan
// los préstamos personales, sin tener que reimplementar nada, y el
// dashboard la agrupa visualmente bajo la tarjeta madre.

export async function createPlanVDebt(cardDebtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: card } = await supabase.from("debts").select("*").eq("id", cardDebtId).single();
  if (!card) redirect(`/dashboard/debts/${cardDebtId}/schedule?error=${encodeURIComponent("Tarjeta no encontrada.")}`);

  const description = (formData.get("description") as string)?.trim();
  const totalInstallments = Number(formData.get("total_installments"));
  const installmentAmount = Number(formData.get("installment_amount"));
  const tna = formData.get("tna") ? Number(formData.get("tna")) : null;

  if (!description || !Number.isInteger(totalInstallments) || totalInstallments <= 0 || Number.isNaN(installmentAmount) || installmentAmount <= 0) {
    redirect(
      `/dashboard/debts/${cardDebtId}/schedule?error=${encodeURIComponent("Revisá los datos de la compra en cuotas.")}`
    );
  }

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    scenario_id: card.scenario_id,
    parent_debt_id: cardDebtId,
    entity: card.entity,
    name: description,
    debt_type: "plan_v",
    status: "al_dia",
    original_amount: installmentAmount * totalInstallments,
    current_balance: installmentAmount * totalInstallments,
    rate_type: "fixed",
    annual_interest_rate: tna,
    installments_total: totalInstallments,
    installments_paid: 0,
    due_day: card.due_day,
  });

  if (error) {
    redirect(`/dashboard/debts/${cardDebtId}/schedule?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/debts/${cardDebtId}/schedule`);
  redirect(`/dashboard/debts/${cardDebtId}/schedule`);
}

export async function deactivatePlanVDebt(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const planDebtId = formData.get("plan_debt_id") as string;
  const cardDebtId = formData.get("card_debt_id") as string;

  const { error } = await supabase
    .from("debts")
    .update({ is_active: false, status: "cancelado" })
    .eq("id", planDebtId)
    .eq("user_id", user.id);

  if (error) {
    redirect(
      `/dashboard/debts/${cardDebtId}/schedule?error=${encodeURIComponent(`No se pudo dar de baja la compra: ${error.message}`)}`
    );
  }

  revalidatePath(`/dashboard/debts/${cardDebtId}/schedule`);
}

// --- Resúmenes mensuales ---
//
// Lógica compartida: recalcula y guarda el balance real de la
// tarjeta a partir del resumen (igual que antes — ver el fix del
// bug de doble conteo en resolveCarriedBalance), y además deja una
// fila en debt_schedule_entries con lo que efectivamente se pagó
// ese mes. Esa fila es la que alimenta la proyección de
// lib/debt-engine/schedule.ts — reemplaza a debt_payments como
// registro de "esto se pagó de verdad" (spec §4.4: un solo lugar
// para el dato confirmado, no dos).
export async function saveCardStatement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  debtId: string,
  params: {
    periodInput: string; // "2026-09"
    newCharges: number;
    minimumPayment: number | null;
    amountPaid: number;
    dueDate: string | null;
    saldoAnterior?: number | null;
    paymentKind?: ScheduleKind;
  }
): Promise<{ error: string | null }> {
  const period = `${params.periodInput}-01`;

  const [{ data: debt }, { data: previousStatement }, { data: plans }, { data: existingThisPeriod }, { data: planVChildren }] = await Promise.all([
    supabase.from("debts").select("*").eq("id", debtId).single(),
    supabase
      .from("card_statements")
      .select("*")
      .eq("debt_id", debtId)
      .lt("period", period)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("card_installment_plans").select("*").eq("debt_id", debtId).eq("is_active", true),
    supabase.from("card_statements").select("id").eq("debt_id", debtId).eq("period", period).maybeSingle(),
    supabase.from("debts").select("*").eq("parent_debt_id", debtId).eq("is_active", true),
  ]);

  if (!debt) return { error: "Deuda no encontrada." };

  const monthlyInterestRate = debt.annual_interest_rate
    ? Number(debt.annual_interest_rate) / 100 / 12
    : 0;

  const installmentPlans = (plans ?? []) as InstallmentPlan[];
  const installmentsChargeThisPeriod = totalInstallmentsDue(installmentPlans, params.periodInput);

  const carriedBalance = resolveCarriedBalance({
    statementSaldoAnterior: params.saldoAnterior,
    previousStatement,
    debtCurrentBalance: Number(debt.current_balance),
  });

  const calc = calculateStatement({
    carriedBalance,
    monthlyInterestRate,
    newCharges: params.newCharges,
    installmentsChargeThisPeriod,
  });

  const { error } = await supabase.from("card_statements").upsert(
    {
      debt_id: debtId,
      user_id: userId,
      period,
      previous_balance: calc.previousBalance,
      interest_charged: calc.interestCharged,
      new_charges: params.newCharges,
      installments_charge: calc.installmentsCharge,
      total_due: calc.totalDue,
      minimum_payment: params.minimumPayment,
      amount_paid: params.amountPaid,
      due_date: params.dueDate,
    },
    { onConflict: "debt_id,period" }
  );

  if (error) return { error: error.message };

  // Cargar el resumen de un período NUEVO (no un reguardado del
  // mismo mes) es la única señal real de que "pasó un mes más" —
  // así que es el único momento en que le toca avanzar una cuota más
  // a cada cuota/refinanciación hija activa. Sin esto quedaban
  // congeladas para siempre en el installments_paid que tenían al
  // crearlas, sin importar cuántos resúmenes reales se cargaran
  // después (ver Product Principle: nunca dejar que un número
  // "confirmado" se desactualice en silencio).
  if (!existingThisPeriod) {
    for (const child of planVChildren ?? []) {
      if (child.installments_total == null) continue;
      const newInstallmentsPaid = child.installments_paid + 1;
      const installmentAmount = child.installments_total > 0 ? Number(child.original_amount) / child.installments_total : 0;

      if (newInstallmentsPaid >= child.installments_total) {
        await supabase
          .from("debts")
          .update({ installments_paid: child.installments_total, current_balance: 0, is_active: false, status: "cancelado" })
          .eq("id", child.id)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("debts")
          .update({
            installments_paid: newInstallmentsPaid,
            current_balance: Math.max(Number(child.current_balance) - installmentAmount, 0),
          })
          .eq("id", child.id)
          .eq("user_id", userId);
      }
    }
  }

  const nextPeriodDate = new Date(period);
  nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
  const nextPeriodStr = `${nextPeriodDate.getFullYear()}-${String(nextPeriodDate.getMonth() + 1).padStart(2, "0")}`;

  const futureInstallmentBalance = totalRemainingInstallmentBalance(installmentPlans, nextPeriodStr);
  const unpaidThisStatement = Math.max(calc.totalDue - params.amountPaid, 0);
  const newCurrentBalance = unpaidThisStatement + futureInstallmentBalance;

  await supabase.from("debts").update({ current_balance: newCurrentBalance }).eq("id", debtId).eq("user_id", userId);

  // La proyección general de cash flow todavía usa monthly_payment
  // como estimación simple para tarjetas — la mantenemos
  // actualizada con lo que se está pagando en la práctica.
  const estimatedMonthlyPayment = calc.installmentsCharge + params.newCharges;
  await supabase
    .from("debts")
    .update({ monthly_payment: Math.round(estimatedMonthlyPayment * 100) / 100 })
    .eq("id", debtId)
    .eq("user_id", userId);

  // Registro canónico de "qué se pagó este mes y de qué tipo" — lo
  // que consume lib/debt-engine/schedule.ts para proyectar. Solo se
  // escribe si hay un pago real confirmado (amountPaid > 0); si
  // todavía no se pagó este resumen, no hay nada confirmado que
  // registrar todavía.
  if (params.amountPaid > 0) {
    const kind: ScheduleKind =
      params.paymentKind ??
      (params.minimumPayment != null && Math.abs(params.amountPaid - params.minimumPayment) < 1
        ? "minimo_estimado"
        : "pago_variable");

    await supabase.from("debt_schedule_entries").upsert(
      {
        debt_id: debtId,
        month: period,
        amount: params.amountPaid,
        kind,
        is_estimate: false,
        note: "Cargado desde resumen mensual de tarjeta.",
      },
      { onConflict: "debt_id,month" }
    );
  }

  revalidatePath(`/dashboard/debts/${debtId}/schedule`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");

  return { error: null };
}

export async function createStatement(debtId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const periodInput = formData.get("period") as string;
  const newCharges = Number(formData.get("new_charges")) || 0;
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const amountPaid = Number(formData.get("amount_paid")) || 0;
  const dueDate = (formData.get("due_date") as string) || null;
  const paymentKind = (formData.get("payment_kind") as ScheduleKind) || undefined;

  if (!periodInput) {
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent("Elegí el mes del resumen.")}`);
  }

  const { error } = await saveCardStatement(supabase, user.id, debtId, {
    periodInput,
    newCharges,
    minimumPayment,
    amountPaid,
    dueDate,
    paymentKind,
  });

  if (error) {
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent(error)}`);
  }

  redirect(`/dashboard/debts/${debtId}/schedule`);
}
