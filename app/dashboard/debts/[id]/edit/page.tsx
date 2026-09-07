import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DebtForm } from "@/components/DebtForm";
import { Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditDebtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: debt } = await supabase
    .from("debts")
    .select("id, name, kind, base_balance, annual_interest_rate, due_day, installments_total, installments_paid")
    .eq("id", id)
    .maybeSingle();

  if (!debt) notFound();

  return (
    <Screen>
      <Link
        href={`/dashboard/debts/${debt.id}`}
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a la deuda
      </Link>

      <h1 className="mt-2 text-screen text-ink">Editar deuda</h1>
      <p className="help mt-1">
        El saldo que edites acá es el punto de partida. Los pagos y los gastos que ya cargaste
        se siguen aplicando encima, así que no hace falta descontarlos a mano.
      </p>

      <DebtForm
        initial={{
          id: debt.id,
          name: debt.name,
          kind: debt.kind,
          baseBalance: debt.base_balance != null ? Number(debt.base_balance) : null,
          annualRate: debt.annual_interest_rate != null ? Number(debt.annual_interest_rate) : null,
          dueDay: debt.due_day,
          installmentsTotal: debt.installments_total,
          installmentsPaid: debt.installments_paid,
        }}
      />
    </Screen>
  );
}
