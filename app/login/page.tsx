import { login } from "@/app/auth-actions";
import Link from "next/link";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 24px" }}>
      <h1>Iniciar sesión</h1>

      {searchParams.error && (
        <p style={{ color: "var(--led-red)", fontSize: 14 }}>{searchParams.error}</p>
      )}

      <form action={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          Entrar
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        ¿No tenés cuenta? <Link href="/signup">Registrate</Link>
      </p>
    </main>
  );
}
