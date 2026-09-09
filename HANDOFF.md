# Dónde quedó esto — para retomar

Última actualización: 9 de septiembre de 2026.

Tres sesiones lo escribieron. La primera construyó la app; la segunda comparó las dieciséis
pantallas contra el prototipo y la desplegó; la tercera la usó en producción y arregló lo
que aparece solo cuando la abrís.

---

## Si vas a hacer una sola cosa

Tocar los dos settings de Supabase del pendiente 1 y 2 —cuatro campos en el dashboard— y
después **abrir la app y cargar una deuda real con su PDF**. Todo lo construido está
verificado contra el prototipo y contra el motor viejo; nada está verificado contra una
sesión de verdad, y ahí es donde vienen apareciendo los bugs.

---

## Lo primero: esto ya está en el aire

`llegas.vercel.app` responde 200 y es público, sirviendo lo que hay en `main`. El dominio y
la Deployment Protection se configuraron a mano en Vercel — el deploy solo NO los resolvía,
como se creía, y se comprobó midiéndolo. `main` y `reset` apuntan al mismo commit.

Hay **una cosa rota en producción ahora mismo**, y es el pendiente número uno: crear cuenta
falla hasta que el dominio esté en los Redirect URLs de Supabase.

## La app

**¿Llegás?** — una app para ver el mes que viene antes de que llegue. No promete salir de
deuda: muestra en qué mes te quedás sin plata, por qué crece cada saldo, y qué cambia si
pagás distinto.

El nombre lleva los signos de pregunta a propósito. Sin ellos se lee como una afirmación,
y la respuesta honesta a veces es que no.

### Las dos reglas que sostienen todo

**Ninguna cifra visible está escrita a mano.** Todo se recalcula desde las deudas y el
escenario activo. Si una pantalla necesita un número que el modelo no puede derivar, el
problema es el modelo, no la pantalla.

**El saldo se deriva, no se guarda.** Saldo base − pagos + gastos abiertos. No hay columna
de saldo que parchear al agregar o quitar un gasto. El único lugar donde se escribe un
saldo es al cargar un resumen, y lo que se escribe es el total que dice el banco.

El resto está en `handoff/PRODUCT-RULES.md`. Las reglas rescatadas del spec viejo, en
`handoff/RESCATE-integridad-y-alertas.md`.

---

## El entorno, que tiene tres trampas

**Node y Python no están en el PATH.** Están instalados igual:

```bash
export PATH="/c/Program Files/nodejs:$PATH"   # node 24, npm 11
# Python: C:/Python314/python.exe
```

Un `command not found` acá significa "no está en el PATH", no "no está instalado".

**El puerto 3000 no es intercambiable.** Los callbacks de Supabase vuelven al origen desde
el que se pidieron, y la lista de Redirect URLs del proyecto los tiene que incluir.
`.claude/launch.json` ya lo fija con `autoPort: false`.

**El prototipo se sirve aparte.** `handoff/prototipo.html` es un bundle de archivo único.
Ya está como configuración fija en `.claude/launch.json`, así que se levanta con el mismo
mecanismo que la app y no depende del scratchpad de ninguna sesión. Va en el **8100**: el
8099 que usaba la sesión anterior quedó reservado por Windows
(`netsh interface ipv4 show excludedportrange protocol=tcp` lo confirma) y no se puede bindear.

---

## Cómo verificar que el motor sigue bien

```bash
npx tsx scripts/cross-check.ts    # el motor contra el prototipo y contra el motor viejo
npx tsx scripts/parser-check.ts   # las regex de los resúmenes, con sus regresiones
```

El cross-check compara contra las cifras que el prototipo muestra en pantalla. Hoy
coinciden **al peso**: saldo total $47.133.454, 26 meses al mínimo para la Patagonia,
$3.875.621 de interés total, $2.757.627 de ahorro pagando el doble, los seis valores del
gráfico de flujo, las cuatro cifras del préstamo puente ($800.000 a un mes al 5%) y las
tres del plan destructor (plazo, interés total y orden de cancelación).

Y hay un banco de pruebas visual: `/dev-preview/pantallas` renderiza las pantallas 04, 06 y
07 a 11 con el dataset del prototipo, sin necesitar sesión ni datos cargados. `/dev-preview`
y `/dev-preview/cashflow` hacen lo mismo con las pantallas 01 y 02. **Es la forma más barata
de ver una pantalla sin poder iniciar sesión**, y fue lo que destapó los formularios que
rompían.

Si alguna deja de coincidir, cambió el motor: entender por qué **antes** de seguir.

---

## Qué está verificado y qué no

Esta distinción importa más que la lista de pantallas, porque marca dónde buscar bugs.

### Verificado contra algo real

| | Contra qué |
|---|---|
| Pantallas 01, 02, 03, 05 | Medidas contra el prototipo renderizado, propiedad por propiedad |
| Pantalla 00 (onboarding) | Los tres pasos, palabra por palabra y cifra por cifra |
| El motor de cálculo | Las cifras que el prototipo muestra en dos pantallas distintas |
| Los tres parsers de PDF | Resúmenes reales de BBVA y Patagonia |
| El esquema | Probado en la base: `copy_scenario` con dos tarjetas homónimas |
| La capa de datos | La app y Postgres derivan el mismo saldo |
| Pantallas 04, 06 y 07 a 11 | Medidas contra el prototipo renderizado, con su banco de pruebas propio |
| El puente, el plan y las cuotas | Sus cifras, contra las que muestra el prototipo, al peso |
| El calendario | El panel del prototipo, contra su captura: kicker, valor, nota, semana desde el lunes y el anillo de hoy |
| El deploy | `llegas.vercel.app` responde 200 y sirve `main` |

### NO verificado — acá es donde hay bugs

**Las dieciséis pantallas ya se compararon** contra el prototipo (sesión del 7 de
septiembre, a la tarde). Lo que sigue sin mirarse:

- Todo lo nuevo de esta tanda **con datos reales**. El banco de pruebas
  (`/dev-preview/pantallas`) verifica el layout y las cifras con el dataset del prototipo,
  pero ninguna de estas pantallas se ejercitó con una sesión de verdad: no se probó cargar
  un puente y verlo entrar al flujo, ni posponer una alerta, ni crear un escenario copiando
  otro, ni borrar todos los datos.
- El flujo de **recuperar clave por código**, que depende de una plantilla de Supabase que
  todavía hay que tocar (ver pendientes).
- **El parseo de PDF por el camino nuevo.** Importar desde el alta de la tarjeta y que lo
  leído llegue al resumen sin volver a pedir el archivo está verificado en estructura, no
  con un PDF de verdad.

**El patrón se repitió tres veces y ya es una regla del proyecto: donde se comparó contra
algo real apareció un bug; donde se razonó sin dato, se inventó.** Vale para el prototipo
renderizado, para un PDF del banco, para la base — y, la última vez, para la app abierta en
un teléfono.

## Lo que la comparación de pantallas encontró

Siete bugs reales, no diferencias de gusto. Los dos primeros aparecieron al mirar las
pantallas 04 y 06, que eran las últimas sin comparar:

1. **Cinco formularios rompían la pantalla entera antes de pintar nada.** Cuatro archivos
   `"use server"` exportaban una constante además de sus funciones (`EMPTY_STATE` y
   compañía). Eso compila, pero en el cliente la constante llega como `undefined`:
   `useActionState` arranca sin estado y la primera lectura de `state.errors` revienta.
   Caían agregar deuda, editar deuda, ingresos, registrar pago y cargar resumen. **Regla
   para el futuro: un archivo `"use server"` solo puede exportar funciones asíncronas.**

2. **Los préstamos entraban al flujo con cuota cero.** La obligación mensual salía del
   mínimo del último resumen, y un préstamo no tiene resúmenes. La proyección los ignoraba
   y el alcance del mes daba más holgado de lo que es. Lo destapó el campo "PAGO MENSUAL
   ESTIMADO" del prototipo, que acá no existía.

3. **Los préstamos puente no llegaban al flujo.** `bridge_loans` se escribía y no lo leía
   nadie: `projectCashflow` nunca supo de su existencia. La pantalla 11 estaba completa y
   era decorativa, y el mensaje de éxito del formulario decía "Miralo en el flujo".

4. **El plan destructor numeraba en orden de ataque, no de cancelación.** Son dos órdenes
   distintos: la deuda de tasa más alta suele ser la más grande y cae última. Con el orden
   de ataque, la frase "libera $X por mes para la siguiente" era falsa en cada fila.

5. **La pantalla de alertas prometía un chequeo que la app no hacía.** `mes_no_reflejado`
   estaba en el enum y en la lista de "Qué miramos", y `deriveAlerts` nunca lo emitía.

6. **Las alertas no traían ni cifra ni destino.** El prototipo da a cada una su número
   etiquetado y un botón al lugar donde se resuelve; la lista mostraba título y flecha.

7. **El menos de `formatMoney` era un guion y no U+2212.** En cifras tabulares el menos
   matemático mide lo mismo que un dígito y el guion no, así que cualquier columna de
   montos con signo se desalineaba sola. Afecta a toda la app.

Y dos diferencias que quedaron a propósito, con su razón:

- **No hay botón de "Recalcular alertas".** El prototipo lo tiene porque ahí las alertas
  viven en un estado que se llena a pedido; acá se derivan al abrir la pantalla. Un botón
  que no cambia nada enseña a desconfiar de la lista.
- **El "termina &lt;mes&gt;" de una cuota difiere en un mes del prototipo.** Con cuota 9/18
  corriendo en septiembre, la 18ª cae en junio; el prototipo dice julio. Su propio contador
  de cuotas y su fecha de fin no cierran entre sí, así que copiarlo exigía meter un
  off-by-one a propósito.

## Lo que encontró usarla en producción

Cuatro más, y ninguno se ve leyendo código. Salieron de abrir `llegas.vercel.app` en un
teléfono:

1. **El onboarding pedía el día de vencimiento con un `<select>` de "Día 1 … Día 31".** El
   prototipo tiene un calendario. Ahora hay un componente único (`CalendarField`) con los
   modos del prototipo, aplicado a las **seis** fechas de la app: día de vencimiento
   (onboarding y editar deuda), mes del resumen, mes de devolución de un puente, mes del
   bono y fecha de un pago. Ya no queda ningún `<select>` de días ni ningún `type="month"`.

2. **La raíz caía directo al onboarding, sin salida a login.** Quien ya tenía cuenta pero no
   la sesión abierta —otro dispositivo, la sesión vencida— tenía que escribir `/login` a
   mano. Ahora hay una pantalla de entrada con dos caminos.

3. **El botón `+` no daba ninguna respuesta en el frame del toque.** El primer feedback era
   la hoja 200 ms después, y por eso se sentía tosco. Ahora se hunde al presionarlo, el
   fondo entra con fade y cerrar tiene salida propia.

4. **"Importar resumen de tarjeta" del onboarding era un link a una pantalla con sesión.**
   Rebotaba al login. Ahora lee el PDF ahí mismo. Y el mismo bloque está en el alta de una
   tarjeta: prellena nombre, saldo, tasa y día, y lo parseado viaja a la pantalla del
   resumen para no pedir el mismo archivo dos veces.

## Pendientes concretos

1. **Supabase → Authentication → URL Configuration.** Agregar `https://llegas.vercel.app` al
   Site URL y `https://llegas.vercel.app/auth/callback` a los Redirect URLs. **Hasta que eso
   pase, crear cuenta y recuperar la clave fallan en producción**: los callbacks se derivan
   del request (no de `NEXT_PUBLIC_APP_URL`), así que apuntan al dominio nuevo, y Supabase
   rechaza cualquier redirect que no esté en la lista. Entrar con clave anda igual.
2. **La plantilla "Reset password" tiene que incluir `{{ .Token }}`.** Recuperar la clave pide
   un código de 6 dígitos, como el prototipo; con la plantilla por defecto llega el link de
   siempre y la pantalla espera un código que nunca aparece. Va en *Authentication → Email
   Templates → Reset password*; el `curl` está más abajo.
3. **Usar la app con datos reales.** Es lo que más bugs está encontrando: cada vuelta de
   "abrirla y mirar" destapó uno (el `<select>` de días, el `+` sin respuesta, la falta de
   login en la raíz, el botón de importar que rebotaba al login). Nada de lo construido se
   ejercitó todavía con un PDF de verdad ni con una sesión.
4. **Activar la protección de contraseñas filtradas** en Supabase Auth. El linter la marca
   desactivada.
5. **Borrar el esquema `backup_pre_reset`** cuando el modelo nuevo esté verificado. Tiene el
   snapshot de los datos viejos (33 deudas, 28 consumos) y es la única copia. Sigue ahí.
6. **El motor viejo (`lib/debt-engine/`, `lib/card-statements/`)** sigue en el repo como
   control cruzado. Decidir si se borra.

El 1 y el 2 son de dashboard y tardan un minuto; el 3 es donde está el valor.
El linter de seguridad de Supabase quedó con **un solo warning**, el 4: los dos de
`rls_auto_enable` se cerraron en la migración 006.

### Deudas de producto conocidas

- **Las preferencias de aviso se guardan y no mandan nada.** La pantalla lo dice, pero no hay
  backend de notificaciones. La anticipación sí cambia cómo se agrupan los vencimientos.
- **Editar deuda no tiene ESTADO (al día / en mora) ni MONTO ORIGINAL**, que el prototipo sí
  tiene. Se dejaron afuera porque ningún cálculo los usaría: serían campos que no mueven
  ningún número. Si la mora tiene que disparar punitorio o cambiar una alerta, hay que
  modelarlo con consumidor antes de agregar el campo.

---

## Migraciones aplicadas en la base

Las de estas sesiones ya corrieron sobre el proyecto `udhqdbpjhifeotgoqaoa` y están en el
repo como `supabase/migration_003_*.sql` a `_006_*.sql`. `supabase/schema.sql` quedó al día.

- `bridge_loans`: se sumaron `is_taken` y `monthly_interest_rate`, y se fue
  `annual_interest_rate` — nunca se escribió desde la app y la tasa que pide la pantalla es
  mensual y simple.
- `scenarios`: se sumó `note`.
- `alert_dismissals`: se sumó `snoozed_until`. La tabla existía sin que la usara nadie y
  guardaba un descarte permanente; posponer necesita saber hasta cuándo.
- `alert_kind`: se sumaron `mes_no_cierra` y `cuotas_fijas`.
- Tabla nueva `alert_settings` (cuándo, por dónde y sobre qué deudas).
- Función nueva `create_scenario_from`, y `copy_scenario` al día con las columnas nuevas.
- `debts`: se sumó `monthly_payment` (migración 005), la cuota de una deuda sin resumen.
- Se le revocó el `EXECUTE` público a `rls_auto_enable()` (migración 006). Es un objeto de
  la plataforma, no nuestro, así que no está en `schema.sql`. Verificado que el guardarraíl
  sigue funcionando: una tabla creada después del revoke sigue quedando con RLS activa.

### La plantilla del código de recuperación

Va en *Authentication → Email Templates → Reset password*, o por la Management API con un
token de https://supabase.com/dashboard/account/tokens:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/udhqdbpjhifeotgoqaoa/config/auth"   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"   -H "Content-Type: application/json"   -d '{"mailer_subjects_recovery":"Tu código para volver a entrar",
       "mailer_templates_recovery_content":"<h2>Tu código</h2><p>Escribí este código en ¿Llegás? para poner una clave nueva:</p><p style=\"font-size:28px;letter-spacing:6px\"><b>{{ .Token }}</b></p><p>Vence en unos minutos. Si no lo pediste, ignorá este mail.</p>"}'
```

## Diferencias de cálculo que hay que conocer

El motor portado del prototipo y el viejo **coinciden en la amortización** pero **difieren
en el cierre de resumen**, por dos razones independientes: el prototipo cobra interés
sobre el saldo antes de restar el pago, y aplica un punitorio del 3% que el viejo no
modela. Sobre la Visa son **$106.199 por mes**.

Gana el prototipo, por instrucción del brief. Está todo medido en `NOTAS-PARA-REVISAR.md`,
que es el documento que hay que leer antes de tocar cualquier cosa del cálculo.

---

## Dos cosas que el brief decía y resultaron falsas

**"El bug del saldo está en el parser."** No estaba. `bbva.ts` lee el saldo del encabezado
del PDF, no lo suma. El bug estaba río abajo y ya estaba arreglado en
`lib/card-statements/`, que `RESET.md` clasificaba como secundario. Por eso se conservó.

**"No hay nada que migrar."** La base tenía 33 deudas y 28 líneas de consumo reales. Se
arrancó de cero igual, por decisión explícita, pero con un snapshot previo en
`backup_pre_reset`.

---

## Lo que los PDFs reales enseñaron

Tres archivos del banco, tres bugs que ningún test sintético encontró:

- **BBVA renombró el producto**: las refinanciaciones ahora dicen `FINANC DE SALDO` y ya no
  `VISA PLAN V`. El parser las perdía y encima las contaba como consumos del mes, inflando
  el total en $2.538.333.
- **El total en dólares se sumaba en vez de leerse**, en los dos parsers. La columna ya
  venía capturada en el encabezado y se descartaba.
- **Patagonia protege sus resúmenes con contraseña.** La app lo detecta y explica qué
  hacer; no pide ni guarda la clave.

Las tres quedaron como regresión en `scripts/parser-check.ts`.
