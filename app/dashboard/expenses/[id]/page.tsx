import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { Screen, Card, MetaChip } from "@/components/ui";
import { ExpenseEditor } from "@/components/ExpenseEditor";

export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthTitle(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("id, description, amount, period, ended_period, is_recurring, is_archived, paid_with, debt_id, debts(name)")
    .eq("id", id)
    .maybeSingle();

  if (!expense) notFound();

  const debtName = (expense as any).debts?.name ?? null;

  return (
    <Screen>
      <Link
        href="/dashboard/expenses"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a los gastos
      </Link>

      <h1 className="mt-2 text-screen text-ink">{expense.description}</h1>

      <Card className="mt-4 px-4 py-4">
        <div className="text-label uppercase text-muted">Monto actual</div>
        <div className="mt-1 font-mono text-[28px] font-semibold text-ink">
          {formatMoney(Number(expense.amount))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-row pt-3">
          <MetaChip>{expense.is_recurring ? "fijo" : "único"}</MetaChip>
          <MetaChip>desde {monthTitle(expense.period)}</MetaChip>
          {debtName ? <MetaChip>no sale del efectivo · {debtName}</MetaChip> : <MetaChip>efectivo</MetaChip>}
          {expense.is_archived && <MetaChip>archivado</MetaChip>}
          {expense.ended_period && <MetaChip>terminó {monthTitle(expense.ended_period)}</MetaChip>}
        </div>

        {expense.is_archived && (
          <p className="mt-3 text-[11.5px] text-muted">
            Está archivado porque el resumen de {debtName ?? "la tarjeta"} ya lo trajo adentro,
            así que dejó de sumar al saldo. Si el resumen no lo incluía, recuperalo.
          </p>
        )}
      </Card>

      <ExpenseEditor
        id={expense.id}
        isRecurring={expense.is_recurring}
        isArchived={expense.is_archived}
        currentAmount={Number(expense.amount)}
        alreadyEnded={Boolean(expense.ended_period)}
      />
    </Screen>
  );
}
