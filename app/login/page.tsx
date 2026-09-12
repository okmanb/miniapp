import Link from "next/link";
import { login } from "@/app/auth-actions";
import { AuthShell, AuthField, AuthSubmit, AuthError, AuthProbar } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const query = await searchParams;

  return (
    <AuthShell
      title="Ingresar"
      note="Entrás y recuperás tus deudas, tu flujo y tu plan tal como los dejaste."
    >
      <form action={login} className="mt-6">
        <AuthField id="email" label="Email" type="email" autoComplete="email" />
        <AuthField id="password" label="Clave" type="password" autoComplete="current-password" />

        {query.error && <AuthError message={query.error} />}

        <div className="mt-2 text-right text-[12px]">
          <Link href="/recuperar" className="text-pine underline underline-offset-2">
            Olvidé mi clave
          </Link>
        </div>

        <AuthSubmit>
          Ingresar
          <span className="ml-1" aria-hidden>
            &rarr;
          </span>
        </AuthSubmit>
      </form>

      {/*
        La salida a probar. Quien llega acá sin cuenta —desde un link, desde el
        historial— no tenía cómo llegar a probar que no fuera el botón de atrás
        del navegador.
      */}
      <AuthProbar />

      <p className="mt-6 text-center text-[12px] text-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/signup" className="text-pine underline underline-offset-2">
          Crear una
        </Link>
      </p>
    </AuthShell>
  );
}
