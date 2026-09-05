# RESET.md — arrancar de cero sin tirar lo que no se puede rehacer

Sí, se puede: el repo se puede vaciar y volver a levantar. La pregunta útil no es si se
puede, es qué de lo que hay no se puede reescribir de memoria. Son dos cosas, y las dos
valen más que todo el resto junto.

## Lo que NO se rehace (guardarlo antes de limpiar)

**`lib/statement-parser/`** — `bbva.ts` (10 KB), `patagonia.ts` (6,8 KB),
`pdf-layout.ts`, `generic.ts`. Es ingeniería inversa sobre PDFs reales de resúmenes
bancarios: posiciones de texto, encabezados, formatos de fecha y monto de cada banco. Eso
salió de mirar archivos concretos y no se puede volver a inferir sin volver a tenerlos. Hay
un bug conocido (daba un saldo muy por encima del real, probablemente sumando movimientos
en vez de tomar el saldo del resumen), pero el bug se arregla; el trabajo de layout no se
recupera.

**`lib/debt-engine/schedule.ts`** (14,6 KB) más `index.ts`, `payoff-plan.ts` y
`personal-cashflow.ts`. Es la amortización mes a mes con los tres tipos de pago y las
reglas de integridad. El prototipo tiene la misma lógica en su propia versión, así que acá
hay una decisión real: conservar la del repo y ajustarla, o portar la del prototipo, que es
la que produjo las cifras que ya viste y aprobaste. **Mi recomendación: portar la del
prototipo** y usar la del repo como control — si las dos dan lo mismo en un caso real, el
port está bien.

Secundario pero útil: `lib/bcra/index.ts` (si trae datos de tasas reales),
`lib/alerts/`, `lib/scenarios/`, `lib/card-statements/` y las migraciones de
`supabase/` como referencia del modelo, aunque el esquema se vuelva a escribir.

## Lo que se va sin discusión

- `design_horizon_saas_template/` y `stitch_debt_freedom_flow/` — dos volcados de
  plantillas de diseño, más de 100 archivos, ninguno es el diseño que vamos a usar.
- `.impeccable/design.json` y `DESIGN.md` — la dirección visual retirada.
- `03-Dashboard.tsx` en la raíz, `00-BRIEF-para-claude-code.md`, `01-SPEC.md`,
  `02-schema.sql`, `PRODUCT.md` — handoffs viejos. Los reemplazan los de `handoff/`.
  Rescatá de `01-SPEC.md` la sección de reglas de integridad si tiene algo que no esté en
  `PRODUCT-RULES.md`.
- `app/globals.css` (15,6 KB) — es el sistema visual viejo entero.
- `app/dashboard/**` — las 40 pantallas y componentes se rehacen contra el prototipo. Las
  `actions.ts` de cada carpeta conviene leerlas antes de borrarlas: ahí está resuelto el
  ida y vuelta con Supabase.
- `lib/billing/` (Stripe + MercadoPago) y `app/api/webhooks/` — vienen del boilerplate.
  Si no vas a cobrar suscripciones ahora, se van y se recuperan del boilerplate cuando haga
  falta.

## Cómo limpiar sin perder el historial

No borres el repo ni el proyecto de Vercel: perdés el enlace, las variables de entorno y el
dominio. Hacelo con git, que además te deja volver:

1. Etiquetá lo que hay hoy, para poder mirarlo siempre: `git tag v0-preliminar && git push --tags`.
2. Rama nueva desde main: `git checkout -b reset`.
3. Borrá en esa rama todo lo de la lista de arriba, dejando `lib/statement-parser/`,
   `lib/debt-engine/`, `lib/supabase/`, `middleware.ts`, `package.json` y la config.
4. Levantá la app nueva ahí, pantalla por pantalla, según `SCREENS.md`.
5. Cuando la rama corra, mergeá a main. Vercel despliega en cada push como ya lo hace, y
   `v0-preliminar` te queda como red.

Así el "de cero" es de cero en el código que se ve, y no de cero en la infraestructura ni en
las dos piezas que costaron trabajo real.

## Lo que sigue igual

Next.js 14 App Router, TypeScript, Supabase con auth y políticas por fila, y el deploy en
Vercel enganchado al repo. Se agrega Zustand y Tailwind con los tokens de `DESIGN.md`.
