import { notFound } from "next/navigation";
import { getDebtDetail } from "@/lib/data/debt";
import { DebtDetailView } from "@/components/DebtDetailView";

export const dynamic = "force-dynamic";

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debt = await getDebtDetail(id);
  if (!debt) notFound();

  return <DebtDetailView debt={debt} />;
}
