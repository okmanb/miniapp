import { signup } from "@/app/auth-actions";
import Link from "next/link";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; check_email?: string };
}) {
  if (searchParams.check_email) {
    return (
      <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 24px" }}>
        <h1>Revisá tu email</h1>
        <p>
          Te mandamos un link de confirmación. Hacé click ahí para activar tu
          cuenta y después volvé a <Link href="/login">iniciar sesión</Link>.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 24px" }}>
      <h1>Crear cuenta</h1>

      {searchParams.error && (
        <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>
      )}

      <form action={signup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            name="password"
            required
            minLength={6}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button type="submit" style={{ padding: 10, marginTop: 8, cursor: "pointer" }}>
          Registrarme
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        ¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>
      </p>
    </main>
  );
}
