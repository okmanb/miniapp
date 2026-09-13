import { redirect } from "next/navigation";
import { guardarClaveDeCuentaNueva } from "@/app/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

/**
 * El último paso de guardar una cuenta de prueba: ponerle una clave.
 *
 * Existe porque Supabase no deja poner clave antes de confirmar el mail
 * —"Updating password of an anonymous user without an email or phone is not
 * allowed"—, así que la conversión queda partida en dos y esta es la segunda
 * mitad. Sin ella la cuenta tiene mail y datos pero nada con qué volver a
 * entrar, que es la peor de las combinaciones.
 *
 * A esta pantalla se llega sola: el callback del link de confirmación manda
 * acá mientras el metadata diga `clave_pendiente`.
 */
export default async function ClavePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Sin sesión no hay a quién ponerle la clave.
  if (!data.user) redirect("/login");
  /*
   * Anónima y sin mail es la cuenta de prueba que todavía no empezó a
   * guardarse: Supabase rechazaría la clave. Se mira el mail y no solo
   * `is_anonymous` a propósito — si algún día la confirmación dejara la
   * cuenta marcada como anónima, esta pantalla sería la única forma de
   * ponerle clave y no puede cerrarse sola.
   */
  if (data.user.is_anonymous && !data.user.email) redirect("/dashboard");

  return (
    <AuthShell
      title="Ponete una clave"
      note="Tu cuenta ya está guardada y no se borra más. Con esta clave volvés a entrar desde cualquier lado."
    >
      <form action={guardarClaveDeCuentaNueva} className="mt-6">
        <AuthField
          id="password"
          label="Clave"
          type="password"
          autoComplete="new-password"
          help="Mínimo 8 caracteres. Usá una que no uses en el banco."
        />

        {query.error && <AuthError message={query.error} />}

        <AuthSubmit>
          Guardar la clave
          <span className="ml-1" aria-hidden>
            &rarr;
          </span>
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
