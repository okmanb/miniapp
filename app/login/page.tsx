import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell, AuthError, AuthProbar } from "@/components/AuthShell";
import { EntrarConGoogle } from "@/components/EntrarConGoogle";

export const dynamic = "force-dynamic";

/**
 * Entrar. Hoy, solo con Google.
 *
 * El mail y la clave salieron de acá a propósito y en forma temporal: el
 * servidor de mail que viene con Supabase solo entrega a los miembros de la
 * organización, así que el alta por mail funciona **para una sola persona** y
 * falla en silencio para cualquier otra. Un formulario que no puede cumplir es
 * peor que no tenerlo.
 *
 * Vuelve cuando haya dominio propio y SMTP: el código sigue en el repo
 * —`login`, `signup`, `/recuperar`, `/clave`— y lo único que hay que hacer es
 * volver a colgarlo de esta pantalla.
 *
 * Entrar y crear cuenta son el mismo gesto con Google, así que no hay dos
 * caminos ni link a "crear una": la primera vez la cuenta se crea sola.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string; desde?: string }>;
}) {
  const query = await searchParams;

  // Viene de la prueba: ya cargó una deuda sin cuenta y lo que quiere saber es
  // qué pasa con eso. Lo sube `DraftImporter` al entrar; acá se dice.
  const desdeOnboarding = query.desde === "onboarding";

  /*
   * Con una cuenta de prueba abierta, esta pantalla haría daño: entrar con
   * Google abre una cuenta NUEVA, y la de prueba —con la deuda, el resumen y
   * todo lo cargado— quedaría esperando que el cron la borre. La pantalla de
   * guardar hace lo contrario: le cuelga la identidad a esta misma cuenta.
   */
  const supabase = await createClient();
  const { data: sesion } = await supabase.auth.getUser();
  if (sesion.user?.is_anonymous) redirect("/signup?desde=prueba");

  return (
    <AuthShell
      title="Ingresar"
      note={
        desdeOnboarding
          ? "Entrás y lo que acabás de cargar se suma a lo que ya tenías, sin volver a escribirlo."
          : "Entrás y recuperás tus deudas, tu flujo y tu plan tal como los dejaste."
      }
    >
      {query.error && <AuthError message={query.error} />}

      <EntrarConGoogle clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} verbo="Entrar" />

      <p className="help mt-3">
        Es el único ingreso por ahora. No hay clave que recordar, y si es tu primera vez la
        cuenta se crea sola. Google nos da tu nombre y tu mail, nada más.
      </p>

      {/*
        La salida a probar. Quien llega acá sin cuenta —desde un link, desde el
        historial— no tenía cómo llegar a probar que no fuera el botón de atrás
        del navegador.
      */}
      <AuthProbar />
    </AuthShell>
  );
}
