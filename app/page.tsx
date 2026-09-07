import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const dynamic = "force-dynamic";

/**
 * La puerta de entrada.
 *
 * La raíz caía directo en el onboarding, y eso deja sin salida a quien ya
 * tiene cuenta pero no tiene la sesión abierta —otro dispositivo, otro
 * navegador, la sesión vencida—: la única forma de llegar a /login era
 * escribirla a mano.
 *
 * Sigue habiendo un solo camino recomendado, el de probar sin cuenta: es lo
 * que hace el prototipo y lo que hace que la app se entienda en treinta
 * segundos. Pero ahora es una elección visible y no la única puerta.
 *
 * `?probar` salta directo al alta guiada, para que el botón no cueste una
 * recarga entera y para poder linkear ahí desde otro lado.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ probar?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Quien ya tiene sesión no vuelve a pasar por la puerta.
  if (data.user) redirect("/dashboard");

  const query = await searchParams;
  if (query.probar !== undefined) return <OnboardingFlow />;

  return (
    <main
      data-motion
      className="animate-screen-in mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-[18px] py-10"
    >
      <span
        className="font-mono text-[12px] uppercase text-leaf-deep"
        style={{ letterSpacing: ".08em" }}
      >
        ¿Llegás?
      </span>

      <h1 className="mt-6 text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
        Mirá el mes que viene antes de que llegue.
      </h1>
      <p className="help mt-3">
        En qué mes te quedás sin plata, por qué crece cada saldo y qué cambia si pagás distinto.
        No promete sacarte de la deuda: te muestra con qué te vas a encontrar.
      </p>

      <div className="mt-8 space-y-2">
        <Link
          href="/?probar"
          className="flex min-h-touch w-full items-center justify-between gap-2 rounded-pill bg-teal px-[18px] py-[13px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
        >
          <span>Probar con una deuda</span>
          <span aria-hidden>→</span>
        </Link>

        <Link
          href="/login"
          className="flex min-h-touch w-full items-center justify-between gap-2 rounded-pill border border-border bg-surface px-[18px] py-[13px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          <span>Ya tengo cuenta</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/*
        Decir que no hace falta cuenta es lo que destraba el primer paso: la
        objeción de alguien que debe plata no es la app, es tener que
        registrarse para mostrarle a un desconocido cuánto debe.
      */}
      <p className="help mt-6">
        Probar no pide cuenta ni datos del banco. Si después querés guardarlo, creás la cuenta y
        lo que cargaste se conserva.
      </p>
    </main>
  );
}
