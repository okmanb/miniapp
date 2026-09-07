import Link from "next/link";
import { signup } from "@/app/auth-actions";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const query = await searchParams;

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

  return (
    <AuthShell
      title="Crear cuenta"
      note="Creás la cuenta y todo lo que cargues se guarda solo, sin volver a empezar."
    >
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
          Crear cuenta
          <span className="ml-1" aria-hidden>
            &rarr;
          </span>
        </AuthSubmit>
      </form>

      <p className="mt-5 text-[12px] text-muted">
        <Link href="/login" className="text-pine underline underline-offset-2">
          Ya tengo cuenta
        </Link>
      </p>
    </AuthShell>
  );
}
