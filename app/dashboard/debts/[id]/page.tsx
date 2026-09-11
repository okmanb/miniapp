import { notFound } from "next/navigation";
import { getDebtDetail } from "@/lib/data/debt";
import { Suspense } from "react";
import { DebtDetailView } from "@/components/DebtDetailView";
import { ArchivedExpensesToast } from "@/components/ArchivedExpensesToast";

export const dynamic = "force-dynamic";

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debt = await getDebtDetail(id);
  if (!debt) notFound();

  return (
    <>
      {/* useSearchParams necesita un límite de Suspense en una página que se
          prerenderiza; no dibuja nada, solo consume el aviso de la URL. */}
      <Suspense fallback={null}>
        <ArchivedExpensesToast />
      </Suspense>
      <DebtDetailView debt={debt} />
    </>
  );
}
