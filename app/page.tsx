import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Entrada (pantalla 00).
 *
 * Los tres pasos no prometen que salir de deuda sea fácil: dicen qué hace la
 * app. La promesa es ver el mes que viene antes de que llegue, no un truco
 * para pagar menos.
 */
const STEPS = [
  {
    title: "Cargá lo que debés",
    note: "Tarjetas, préstamos, lo que sea. Con el nombre y el saldo alcanza para empezar.",
  },
  {
    title: "Mirá el mes que viene",
    note: "Cuánto entra, cuánto sale y hasta cuándo te alcanza. Sin adornos.",
  },
  {
    title: "Probá antes de decidir",
    note: "Qué pasa si pagás el doble, si pedís un puente, si dejás de pagar una. Sin tocar tu plan real.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Quien ya entró no necesita ver la presentación de nuevo.
  if (data.user) redirect("/dashboard");

  return (
    <main data-motion className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] py-10">
      <p
        className="font-mono text-[12px] uppercase text-leaf-deep"
        style={{ letterSpacing: ".08em" }}
      >
        Simuladeudas
      </p>

      <h1 className="mt-6 text-[26px] font-semibold leading-[1.15] text-ink" style={{ letterSpacing: "-.02em" }}>
        Mirá el mes que viene antes de que llegue.
      </h1>
      <p className="mt-3 text-[13px] leading-[1.55] text-muted" style={{ textWrap: "pretty" }}>
        No promete que salgas de deuda rápido. Te muestra en qué mes te quedás sin plata, por
        qué crece cada saldo, y qué cambia si pagás distinto.
      </p>

      <ol className="mt-8 space-y-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            data-motion
            className="flex animate-card-in gap-3 rounded-surface-lg border border-border bg-surface px-4 py-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-mint-wash font-mono text-[12px] font-semibold text-leaf-deep"
              aria-hidden
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-card text-ink">{step.title}</span>
              <span className="mt-1 block text-[11.5px] leading-[1.5] text-muted">{step.note}</span>
            </span>
          </li>
        ))}
      </ol>

      <Link
        href="/signup"
        className="mt-8 flex min-h-touch w-full items-center justify-center rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
      >
        Empezar
      </Link>

      <p className="mt-4 text-center text-[12px] text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-pine underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </main>
  );
}
