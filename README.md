# ¿Llegás?

Mirá el mes que viene antes de que llegue. No promete salir de deuda rápido: muestra en
qué mes te quedás sin plata, por qué crece cada saldo, y qué cambia si pagás distinto.

Está en el aire en **[llegas.vercel.app](https://llegas.vercel.app)**, y se despliega solo
con cada push a `main`.

## Arrancar

```bash
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev
```

Node 20 o superior. En esta máquina Node vive en `C:\Program Files\nodejs` y no está en el
PATH: hay que anteponerlo.

El puerto **3000 no es intercambiable**. `http://localhost:3000` está cargado como origen
autorizado del cliente de Google, y el ingreso con Google no arranca desde un origen que
Google no conozca.

### Las variables

| | |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | El proyecto de Supabase. La anon key es pública por diseño: lo que protege los datos es RLS, activo en todas las tablas. |
| `NEXT_PUBLIC_APP_URL` | A dónde vuelven los links de confirmación. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | El cliente Web de la consola de Google. También público — viaja en la URL de cada login. Sin él, el ingreso cae al camino largo. |

## Cómo se entra

**Solo con Google, por ahora.** El servidor de mail incorporado de Supabase solo entrega a
los miembros de la organización, así que el alta por mail funciona para una persona y falla
para el resto. El código de esa puerta —`login`, `signup`, `/recuperar`, `/clave`— sigue
entero y dormido, esperando un dominio propio y SMTP.

El botón lo dibuja la librería de Google y el token lo pide el navegador
(`components/EntrarConGoogle.tsx`), para que la pantalla de Google muestre el dominio de la
app y no el id del proyecto de Supabase. Si eso no se puede —origen no autorizado, script
bloqueado— cae solo al camino de siempre, el que resuelve el servidor.

**Se puede probar sin cuenta.** El botón abre una cuenta anónima de verdad: mismo tablero,
mismas cuentas, mismas políticas. Dura 24 horas y la borra un cron. Entrar con Google le
cuelga la identidad a **esa misma cuenta** —no crea otra— así que lo cargado no se pierde.

## Cómo está armado

| | |
|---|---|
| `app/` | Pantallas. La raíz es el onboarding; todo lo privado cuelga de `/dashboard`. |
| `app/dev-preview/` | Las pantallas renderizadas sin sesión, para compararlas con el prototipo al lado. |
| `components/` | La interfaz. `ui.tsx` es el sistema: alturas, píldoras, cifras en mono. |
| `lib/calc/` | El motor. Módulos puros, sin base de datos ni React. |
| `lib/data/` | Lecturas para las pantallas. Derivan; no guardan. |
| `lib/statement-parser/` | Lectura de resúmenes en PDF, un parser por banco. |
| `lib/debt-engine/` · `lib/card-statements/` | El motor viejo. No lo usa la app: queda como control del cruzado. |
| `proxy.ts` | Lo que corta `/dashboard` sin sesión. Es el middleware, con el nombre que usa esta versión de Next. |
| `supabase/schema.sql` | El esquema, con las políticas por fila junto a cada tabla. |
| `supabase/migration_*.sql` | Los cambios, en orden y con el porqué escrito arriba de cada uno. |
| `handoff/` | El prototipo aprobado y sus documentos. Fuente de verdad del diseño. |
| `design/` | Los artboards de la puerta de entrada. El lienzo empaquetado no se versiona. |

## Las dos reglas que sostienen todo

**Ninguna cifra visible está escrita a mano.** Todo se recalcula desde las deudas y el
escenario activo. Si una pantalla necesita un número que el modelo no puede derivar, el
problema es el modelo.

**El saldo se deriva, no se guarda.** Saldo base, menos los pagos, más los gastos abiertos.
No hay columna de saldo que parchear al agregar o quitar un gasto — si hiciera falta
revertir un parche, el modelo estaría mal. El único lugar donde se escribe un saldo es al
cargar un resumen, y lo que se escribe es el total que dice el banco.

El resto de las reglas está en `handoff/PRODUCT-RULES.md`.

## Antes de pushear

```bash
npx tsx scripts/cross-check.ts    # el motor contra el prototipo y contra el motor viejo
npx tsx scripts/parser-check.ts   # las regex de los resúmenes, con sus regresiones
npx tsx scripts/forms-check.ts    # los números que viajan entre un campo de texto y el modelo
npx next build
```

El cross-check compara contra las cifras que muestra el prototipo para las mismas deudas.
Si alguna deja de coincidir, cambió el motor y hay que entender por qué antes de seguir.
Los tres corren **antes** del push, no después: `main` es producción.

Hay dos más que no son de control y se usan a mano: `scripts/probar-pdf.ts` corre el parser
sobre un PDF de verdad, y `scripts/generar-icono.py` saca el ícono de la fuente de la app.

## Lo que hay que leer antes de tocar algo

`HANDOFF.md` es lo primero: dónde quedó todo, qué está verificado contra qué, y qué falta.
Se mantiene al día en el mismo commit que el trabajo.

`NOTAS-PARA-REVISAR.md` tiene las diferencias entre los dos motores de cálculo, lo que el
prototipo no definía y hubo que decidir, y lo que quedó pendiente. Se lee antes de cambiar
cualquier cosa del cálculo.

Y una regla de oficio, que este proyecto aprendió a los golpes: **cada vez que la app se usó
con datos reales apareció un bug, y casi ninguno se veía leyendo el código.** Cargar un
resumen de verdad vale más que releer el motor.
