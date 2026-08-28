import { createClient } from "@/lib/supabase/server";
import { updateDebt } from "../../actions";
import DebtForm from "../../DebtForm";
import { WalletIcon } from "@/lib/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { DebtFormValues, ValidationErrors } from "../../validation";

export default async function EditDebtPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { errors?: string; values?: string };
}) {
  const supabase = createClient();

  let errors: ValidationErrors | undefined;
  let values: DebtFormValues | undefined;

  try {
    if (searchParams.errors) errors = JSON.parse(searchParams.errors);
    if (searchParams.values) values = JSON.parse(searchParams.values);
  } catch {
    // ignoramos parseos rotos, seguimos con lo que traigamos de la DB
  }

  // Si venimos de un error de validación, ya tenemos los valores en
  // la URL — no hace falta ir a buscar la deuda de nuevo. Si no,
  // los traemos de la DB (primera carga de la página de edición).
  if (!values) {
    const { data: debt } = await supabase
      .from("debts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!debt) notFound();

    values = {
      name: debt.name,
      debt_type: debt.debt_type,
      status: debt.status ?? "al_dia",
      original_amount: String(debt.original_amount),
      current_balance: String(debt.current_balance),
      rate_type: debt.rate_type,
      annual_interest_rate: debt.annual_interest_rate ? String(debt.annual_interest_rate) : "",
      installments_total: debt.installments_total ? String(debt.installments_total) : "",
      installments_paid: String(debt.installments_paid ?? 0),
      monthly_payment: debt.monthly_payment ? String(debt.monthly_payment) : "",
      due_day: debt.due_day ? String(debt.due_day) : "",
    };
  }

  // Bindeamos el id de la deuda al server action, así el form no
  // necesita mandarlo como campo oculto ni el action necesita
  // parsearlo de otro lado.
  const boundUpdateDebt = updateDebt.bind(null, params.id);

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WalletIcon width={26} height={26} />
        Editar deuda
      </h1>
      <DebtForm errors={errors} values={values} action={boundUpdateDebt} />
    </main>
  );
}
