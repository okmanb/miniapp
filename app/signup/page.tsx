import Link from "next/link";
import { signup } from "@/app/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/AuthShell";
import { estadoDePrueba } from "@/lib/auth/prueba";

export const dynamic = "force-dynamic";

/**
 * Crear cuenta — o guardar la de prueba, que no es lo mismo.
 *
 * Con una sesión anónima abierta esta pantalla NO da de alta a nadie: le
 * cuelga un mail a la cuenta que ya existe, así que el id no cambia y no hay
 * que mover una sola fila. La diferencia se detecta del lado del servidor
 * —`is_anonymous`— y no del query string, que cualquiera puede escribir.
 *
 * La clave no se pide en ese caso: Supabase no deja ponerle clave a una cuenta
 * anónima hasta que el mail esté confirmado. Se pide en `/clave`, al volver
 * del link. Pedirla acá sería pedir algo que se va a tirar.
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
        {query.desde === "prueba" ? (
          /* La cuenta de prueba sigue viva y sigue teniendo fecha de
             vencimiento hasta que el mail se confirme: decirlo acá evita que
             el link quede para mañana. */
          <p className="help mt-3">
            Lo que cargaste ya está en esa cuenta y no se toca. Confirmá el mail antes de que
            se cumplan las horas de la prueba: recién ahí deja de tener fecha de vencimiento.
            Al volver te pedimos la clave.
          </p>
        ) : (
          /* El borrador vive en ESTE navegador. Confirmar desde el mail del
             teléfono y seguir ahí deja lo cargado del otro lado, así que
             conviene decir dónde está antes de que parezca perdido. */
          <p className="help mt-3">
            Lo que cargaste probando sigue guardado en este navegador y se sube solo la
            primera vez que entres desde acá.
          </p>
        )}
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
        note={`Tu cuenta de prueba se borra sola ${etiqueta}. Con tu mail deja de borrarse y queda tal cual está.`}
      >
        <form action={signup} className="mt-6">
          <AuthField id="name" label="Nombre" type="text" autoComplete="name" />
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            help="Te mandamos un link para confirmarlo. La clave te la pedimos al volver."
          />

          <p className="help mt-4">
            No se crea nada de cero: es la misma cuenta que venís usando. Las deudas, los
            pagos y los resúmenes que cargaste quedan donde están.
          </p>

          {query.error && <AuthError message={query.error} />}

          <AuthSubmit>
            Guardar mi cuenta
            <span className="ml-1" aria-hidden>
              &rarr;
            </span>
          </AuthSubmit>
        </form>

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
          que lo mínimo es decir por qué esto es un formulario. */}
      {query.sin_prueba && (
        <p className="mt-4 rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-3 text-[11.5px] text-gold-ink">
          No pudimos abrirte la cuenta de prueba. Creá la cuenta y lo que cargaste se sube
          igual: no hay que volver a escribir nada.
        </p>
      )}

      <form action={signup} className="mt-6">
        <AuthField id="name" label="Nombre" type="text" autoComplete="name" />
        <AuthField id="email" label="Email" type="email" autoComplete="email" />
        <AuthField
          id="password"
          label="Clave"
          type="password"
          autoComplete="new-password"
          help="Mínimo 8 caracteres. Usá una que no uses en el banco."
        />

        <p className="help mt-4">
          Guardamos tus deudas y tu plan en tu cuenta. No pedimos acceso a tu banco ni a tus
          tarjetas.
        </p>

        {query.error && <AuthError message={query.error} />}

        <AuthSubmit>
          {desdeOnboarding ? "Crear mi tablero" : "Crear cuenta"}
          <span className="ml-1" aria-hidden>
            &rarr;
          </span>
        </AuthSubmit>
      </form>

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
