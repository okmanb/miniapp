import Link from "next/link";
import { requestPasswordReset } from "@/app/auth-actions";
import { AuthShell, AuthField, AuthSubmit } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

/**
 * Recuperar la clave (pantalla 14).
 *
 * El mensaje de confirmación es el mismo exista o no la cuenta: decir "ese
 * mail no está registrado" le confirmaría a cualquiera que pruebe una
 * dirección si esa persona usa la app, que en una app de deudas no es un
 * detalle menor.
 */
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const query = await searchParams;

  if (query.enviado) {
    return (
      <AuthShell
        title="Listo"
        note="Si hay una cuenta con ese mail, le mandamos un link para poner una clave nueva."
      >
        <p className="mt-6 rounded-surface border border-border bg-surface px-4 py-3 text-[12px] text-muted">
          Mirá también en spam. El link sirve una sola vez y vence, así que si tarda mucho
          pedí otro desde acá.
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
      title="Recuperar la clave"
      note="Te mandamos un link al mail para poner una nueva. Tus datos quedan como estaban."
    >
      <form action={requestPasswordReset} className="mt-6">
        <AuthField id="email" label="Mail" type="email" autoComplete="email" />
        <AuthSubmit>Mandame el link</AuthSubmit>
      </form>

      <p className="mt-5 text-[12px] text-muted">
        ¿Te acordaste?{" "}
        <Link href="/login" className="text-pine underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
