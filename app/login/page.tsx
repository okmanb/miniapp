import Link from "next/link";
import { login } from "@/app/auth-actions";
import { AuthShell, AuthField, AuthSubmit, AuthError } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const query = await searchParams;

  return (
    <AuthShell
      title="Entrar"
      note="Tus deudas, tu proyección y tus escenarios te esperan donde los dejaste."
    >
      <form action={login} className="mt-6">
        <AuthField id="email" label="Mail" type="email" autoComplete="email" />
        <AuthField id="password" label="Clave" type="password" autoComplete="current-password" />

        {query.error && <AuthError message={query.error} />}

        <AuthSubmit>Entrar</AuthSubmit>
      </form>

      <div className="mt-5 space-y-2 text-[12px]">
        <p className="text-muted">
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/signup" className="text-pine underline underline-offset-2">
            Crear una
          </Link>
        </p>
        <p className="text-muted">
          ¿Te olvidaste la clave?{" "}
          <Link href="/recuperar" className="text-pine underline underline-offset-2">
            Recuperarla
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
