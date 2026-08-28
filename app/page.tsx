import { FactoryIcon } from "@/lib/icons";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <FactoryIcon width={28} height={28} />
        Mini App Factory
      </h1>
      <p>
        Si estás viendo esto en <code>localhost:3000</code>, el boilerplate
        arrancó bien.
      </p>
      <ol>
        <li>Configurá tu proyecto de Supabase y completá el <code>.env.local</code></li>
        <li>
          Corré <code>supabase/schema.sql</code> en el SQL Editor de tu
          proyecto
        </li>
        <li>Empezá a construir tu primera mini app acá adentro</li>
      </ol>
      <p>
        La lógica de suscripciones vive en <code>lib/billing/index.ts</code> —
        desde ahí llamás <code>createSubscription()</code> sin importar si el
        usuario paga con Stripe o MercadoPago.
      </p>
      <p style={{ marginTop: 24 }}>
        <a href="/login" style={{ marginRight: 16 }}>Iniciar sesión</a>
        <a href="/signup">Crear cuenta</a>
      </p>
    </main>
  );
}
