# Mini App Factory — boilerplate base

Repo base para clonar en cada mini app nueva. Trae auth (Supabase) y
suscripciones (Stripe + MercadoPago) ya resueltos detrás de una sola
interfaz en `lib/billing`.

## Cómo correrlo local (fase 1: solo para vos)

1. **Instalá dependencias**

   ```bash
   npm install
   ```

2. **Creá un proyecto en [supabase.com](https://supabase.com)** (plan free)

   - Copiá `.env.example` a `.env.local`
   - Completá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
     `SUPABASE_SERVICE_ROLE_KEY` desde Project Settings > API

3. **Corré el schema de base de datos**

   - Abrí el SQL Editor en tu proyecto de Supabase
   - Pegá y ejecutá el contenido de `supabase/schema.sql`

4. **Cuentas de test para pagos** (no hace falta plata real)

   - Stripe: creá cuenta en [stripe.com](https://stripe.com), quedate en
     modo **Test**, copiá las keys que empiezan con `sk_test_` /
     `pk_test_`
   - MercadoPago: [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers),
     usá las **credenciales de prueba** (empiezan con `TEST-`)
   - Completá esas keys en `.env.local`

5. **Corré la app**

   ```bash
   npm run dev
   ```

   Abrí [http://localhost:3000](http://localhost:3000)

## Probar webhooks en local

Los webhooks de Stripe/MercadoPago necesitan una URL pública. Para
testear local, usá la Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Eso te da un `whsec_...` temporal para tu `.env.local`.

## Estructura

```
app/
  page.tsx                        → home
  api/webhooks/stripe/route.ts    → confirma pagos Stripe
  api/webhooks/mercadopago/route.ts → confirma pagos MercadoPago
lib/
  billing/index.ts   → interfaz única: createSubscription(), cancelSubscription()
  billing/stripe.ts        → implementación Stripe
  billing/mercadopago.ts   → implementación MercadoPago
  supabase/client.ts       → cliente browser
  supabase/server.ts       → cliente server + admin
supabase/schema.sql        → tablas: subscriptions, webhook_events
```

## Siguiente paso: fase 2 (preview privado)

Cuando quieras mostrárselo a alguien sin publicarlo:

```bash
npx vercel
```

Te da una URL tipo `tuapp-git-main.vercel.app` que podés compartir
sin comprar dominio ni activar modo live de pagos.
