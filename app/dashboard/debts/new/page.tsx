import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DebtForm } from "@/components/DebtForm";
import { EmptyState, PrimaryButton, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Alta de deuda.
 *
 * Se comprueba el escenario ACÁ y no solo al guardar. Varias pantallas
 * mandan a este formulario cuando están vacías; si no hubiera escenario, la
 * persona llenaría todo el formulario para recibir el error recién al
 * apretar guardar. Es el punto donde convergen esos caminos, así que es el
 * lugar donde conviene atajarlo.
 */
export default async function NewDebtPage() {
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver
      </Link>

      <h1 className="mt-2 text-screen text-ink">Agregar deuda</h1>

      {scenario === null ? (
        <div className="mt-4">
          <EmptyState
            title="Primero hace falta un escenario"
            note="Las deudas viven dentro de un escenario, así podés simular cambios sin tocar tu plan real. Creá el primero y volvé — es un paso de una sola vez."
            action={<PrimaryButton href="/dashboard/scenarios">Crear mi plan base</PrimaryButton>}
          />
        </div>
      ) : (
        <>
          <p className="help mt-1">
            Con el nombre y el saldo alcanza para empezar. Lo demás lo podés completar después,
            o dejar que lo traiga un resumen. Se guarda en “{scenario.name}”.
          </p>
          <DebtForm />
        </>
      )}
    </Screen>
  );
}
