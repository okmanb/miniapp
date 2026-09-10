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

          {/*
            El PDF ya no se sube acá —se subía, y partía el alta de una tarjeta
            en dos pantallas— pero sacarlo sin dejar esta señal fue peor: quien
            llegaba con el resumen en la mano no tenía forma de saber que el
            camino existe. Una pantalla puede estar bien y aun así ser un
            callejón si no dice adónde sigue.
          */}
          <div className="mt-4 rounded-surface border border-border bg-mint-wash px-4 py-3">
            <p className="text-[12px] text-leaf-deep">
              ¿Es una tarjeta y tenés el PDF del resumen? Cargala desde ahí: el archivo trae el
              nombre, el saldo, la tasa y el día, y de paso queda cargado el resumen del mes.
            </p>
            <Link
              href="/dashboard/statements/new"
              className="mt-2 inline-flex min-h-touch items-center text-[12px] text-pine underline underline-offset-2"
            >
              Cargar el resumen de una tarjeta
            </Link>
          </div>

          <DebtForm />
        </>
      )}
    </Screen>
  );
}
