import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaymentForm } from "@/components/PaymentForm";
import { EmptyState, PrimaryButton, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Registrar un pago (formulario de la hoja "Agregar").
 *
 * Es un formulario de servidor sin estado de cliente: no necesita nada
 * interactivo, y así funciona aunque el JavaScript no haya cargado todavía.
 */
export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ deuda?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: debts } = scenario
    ? await supabase
        .from("debts")
        .select("id, name")
        .eq("scenario_id", scenario.id)
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver
      </Link>

      <h1 className="mt-2 text-screen text-ink">Registrar un pago</h1>
      <p className="help mt-1">
        Baja el saldo de la deuda desde el momento en que lo cargás. Si te equivocás, borrarlo
        lo devuelve solo.
      </p>

      {!debts || debts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No hay deudas cargadas"
            note="Un pago siempre va contra una deuda. Cargá la deuda primero."
            action={<PrimaryButton href="/dashboard/debts/new">Agregar una deuda</PrimaryButton>}
          />
        </div>
      ) : (
        <PaymentForm debts={debts} defaultDebtId={query.deuda} />
      )}
    </Screen>
  );
}
