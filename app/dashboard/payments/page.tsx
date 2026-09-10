import { createClient } from "@/lib/supabase/server";
import { PaymentsHistory } from "@/components/PaymentsHistory";

export const dynamic = "force-dynamic";

export default async function PaymentsHistoryPage() {
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data } = scenario
    ? await supabase
        .from("debt_payments")
        .select("id, amount, period, paid_on, kind, statement_id, debts(name)")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false })
        .order("paid_on", { ascending: false })
    : { data: [] };

  const rows = (data ?? []).map((p: any) => ({
    id: p.id,
    amount: Number(p.amount),
    period: p.period,
    paidOn: p.paid_on as string | null,
    kind: p.kind as string,
    debtName: p.debts?.name ?? "—",
    fromStatement: p.statement_id != null,
  }));

  return <PaymentsHistory rows={rows} />;
}
