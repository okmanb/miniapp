import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/AuthShell";
import { EntrarConGoogle, BotonGoogleRedirect } from "@/components/EntrarConGoogle";
import { estadoDePrueba } from "@/lib/auth/prueba";

export const dynamic = "force-dynamic";

/**
 * Crear cuenta — o guardar la de prueba, que no es lo mismo.
 *
 * Las dos cosas se hacen con Google, que es el único ingreso mientras no haya
 * dominio propio y servidor de mail (ver `/login`). Pero por abajo son dos
 * caminos distintos y la diferencia importa:
 *
 *   * **Sin sesión** se crea la cuenta con el token que da Google en esta misma
 *     página (`EntrarConGoogle`), y la pantalla de Google muestra el dominio de
 *     la app en vez del id del proyecto de Supabase.
 *
 *   * **Con una cuenta de prueba abierta** se ENLAZA la identidad a la cuenta
 *     que ya existe, y eso solo se puede por redirección (`linkIdentity`). Con
 *     el token de acá, Supabase abriría una cuenta nueva y lo cargado quedaría
 *     esperando que el cron borre la vieja. Por eso ahí va el botón largo, y no
 *     es un plan B: es el único que conserva los datos.
 *
 * La diferencia se detecta del lado del servidor —`is_anonymous`— y no del
 * query string, que cualquiera puede escribir.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    check_email?: string;
    desde?: string;
    sin_prueba?: string;
  }>;
}) {
  const query = await searchParams;

  const supabase = await createClient();
  const { data: sesion } = await supabase.auth.getUser();
  const prueba = sesion.user?.is_anonymous ? sesion.user : null;

  /*
   * Quien llega desde la prueba sin cuenta temporal ya cargó una deuda, su
   * ingreso y sus gastos fijos en el navegador, y lo que menos necesita es
   * preguntarse si eso se pierde. Lo sube `DraftImporter` la primera vez que
   * entra con sesión: acá solo se dice, que es la parte que faltaba.
   */
  const desdeOnboarding = query.desde === "onboarding";

  /*
   * Pantalla del alta por mail, hoy dormida: el alta por mail salió de la
   * interfaz hasta que haya SMTP propio. Se queda acá porque la acción que
   * manda a este lugar sigue en el repo, y una acción viva que aterriza en una
   * pantalla que no existe es peor que una pantalla de más.
   */
  if (query.check_email) {
    return (
      <AuthShell
        title="Revisá tu mail"
        note="Te mandamos un link para confirmar la cuenta. Sin ese paso no podemos guardar nada tuyo."
      >
        <p className="mt-6 rounded-surface border border-border bg-surface px-4 py-3 text-[12px] text-muted">
          Si no llega en unos minutos, mirá en spam. El link vence, así que si se pasó el
          tiempo pedí otro creando la cuenta de nuevo con el mismo mail.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-touch items-center text-[12px] text-pine underline underline-offset-2"
        >
          Volver a entrar
        </Link>
      </AuthShell>
    );
  }

  if (prueba) {
    const { etiqueta } = estadoDePrueba(prueba.created_at);

    return (
      <AuthShell
        title="Guardar mi cuenta"
        note={`Tu cuenta de prueba se borra sola ${etiqueta}. Con tu cuenta de Google deja de borrarse y queda tal cual está.`}
      >
        <div className="mt-6">
          <BotonGoogleRedirect verbo="Guardar" />
        </div>

        <p className="help mt-3">
          No se crea nada de cero: es la misma cuenta que venís usando. Las deudas, los pagos y
          los resúmenes que cargaste quedan donde están.
        </p>

        <p className="mt-6 text-center text-[12px] text-muted">
          <Link href="/dashboard" className="text-pine underline underline-offset-2">
            Seguir probando
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={desdeOnboarding ? "Crear mi tablero" : "Crear cuenta"}
      note={
        desdeOnboarding
          ? "Es el último paso: la deuda, el ingreso y los gastos que cargaste se suben a tu cuenta apenas entres."
          : "Creás la cuenta y todo lo que cargues se guarda solo, sin volver a empezar."
      }
    >
      {/* La cuenta de prueba no se pudo abrir —las sesiones anónimas están
          apagadas en el proyecto—. El botón prometía entrar sin cuenta, así
          que lo mínimo es decir por qué esto es otra pantalla. */}
      {query.sin_prueba && (
        <p className="mt-4 rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-3 text-[11.5px] text-gold-ink">
          No pudimos abrirte la cuenta de prueba. Entrá con Google y lo que cargaste se sube
          igual: no hay que volver a escribir nada.
        </p>
      )}

      <EntrarConGoogle
        clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        verbo="Crear cuenta"
      />

      <p className="help mt-3">
        Guardamos tus deudas y tu plan en tu cuenta. Google nos da tu nombre y tu mail, nada
        más: no pedimos acceso a tu banco ni a tus tarjetas.
      </p>

      <p className="mt-6 text-center text-[12px] text-muted">
        <Link
          href={desdeOnboarding ? "/login?desde=onboarding" : "/login"}
          className="text-pine underline underline-offset-2"
        >
          Ya tengo cuenta
        </Link>
      </p>
    </AuthShell>
  );
}
