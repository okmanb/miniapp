# Dónde quedó esto — para retomar

Fecha: 7 de septiembre de 2026. Escrito al cerrar una sesión larga y actualizado al cerrar
la siguiente, que comparó las pantallas 07 a 16 contra el prototipo.

---

## Lo primero: nada de esto está desplegado

```
main   →  bd19b15   el boilerplate viejo + handoff/     ← esto es lo que sirve Vercel
reset  →  38 commits por delante                        ← esto es la aplicación
```

`main` **no tiene ni uno** de los archivos nuevos. La rama `reset` está completa, con el
build limpio y `npm audit` en cero, pero sin mergear. Es la primera decisión pendiente y
es del usuario.

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

Y hay un banco de pruebas visual: `/dev-preview/pantallas` renderiza las pantallas 07 a 11
con el dataset del prototipo, sin necesitar sesión ni datos cargados. `/dev-preview` y
`/dev-preview/cashflow` hacen lo mismo con las pantallas 01 y 02.

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
| Pantallas 07 a 11 | Medidas contra el prototipo renderizado, con su banco de pruebas propio |
| El puente, el plan y las cuotas | Sus cifras, contra las que muestra el prototipo, al peso |

### NO verificado — acá es donde hay bugs

**Las pantallas 07 a 16 ya se compararon** contra el prototipo (sesión del 7 de septiembre,
a la tarde). Lo que sigue sin mirarse:

- Las pantallas **04** (editar deuda) y **06** (resumen del mes), que nunca entraron en
  ninguna de las dos pasadas.
- Todo lo nuevo de esta tanda **con datos reales**. El banco de pruebas
  (`/dev-preview/pantallas`) verifica el layout y las cifras con el dataset del prototipo,
  pero ninguna de estas pantallas se ejercitó con una sesión de verdad: no se probó cargar
  un puente y verlo entrar al flujo, ni posponer una alerta, ni crear un escenario copiando
  otro, ni borrar todos los datos.
- El flujo de **recuperar clave por código**, que depende de una plantilla de Supabase que
  todavía hay que tocar (ver pendientes).

El patrón de la sesión anterior se repitió y conviene recordarlo: donde se comparó contra
algo real apareció un bug; donde se razonó sin dato, se inventó. Los cinco que aparecieron
esta vez están en la sección siguiente.

## Lo que la comparación 07–16 encontró

Cinco bugs reales, no diferencias de gusto:

1. **Los préstamos puente no llegaban al flujo.** `bridge_loans` se escribía y no lo leía
   nadie: `projectCashflow` nunca supo de su existencia. La pantalla 11 estaba completa y
   era decorativa, y el mensaje de éxito del formulario decía "Miralo en el flujo".

2. **El plan destructor numeraba en orden de ataque, no de cancelación.** Son dos órdenes
   distintos: la deuda de tasa más alta suele ser la más grande y cae última. Con el orden
   de ataque, la frase "libera $X por mes para la siguiente" era falsa en cada fila.

3. **La pantalla de alertas prometía un chequeo que la app no hacía.** `mes_no_reflejado`
   estaba en el enum y en la lista de "Qué miramos", y `deriveAlerts` nunca lo emitía.

4. **Las alertas no traían ni cifra ni destino.** El prototipo da a cada una su número
   etiquetado y un botón al lugar donde se resuelve; la lista mostraba título y flecha.

5. **El menos de `formatMoney` era un guion y no U+2212.** En cifras tabulares el menos
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

## Pendientes concretos

1. **Mergear `reset` a `main`** (o apuntar Vercel a `reset`). Nada se ve hasta que pase.
   Era el paso siguiente al terminar la comparación de pantallas.
2. **`llegas.vercel.app` devuelve `DEPLOYMENT_NOT_FOUND`.** El dominio ya está enrutado a
   la cuenta pero sin deployment asociado; se resuelve solo en el próximo deploy a
   producción. `mini-app-factory-okmanb.vercel.app` sigue sirviendo mientras tanto.
3. **Deployment Protection está activa.** La URL redirige a `vercel.com/login`: hoy solo la
   ve el dueño de la cuenta. Se saca en *Project Settings → Deployment Protection*.
4. **Supabase → Authentication → URL Configuration**: agregar el dominio de producción a
   Redirect URLs. Sin eso, confirmar mail y recuperar clave fallan en producción. (El
   login con clave anda igual.) Los callbacks ya no dependen de `NEXT_PUBLIC_APP_URL`: se
   derivan del request, así que funcionan en local, preview y producción sin configurar.
5. **Activar la protección de contraseñas filtradas** en Supabase Auth. El linter la marca
   desactivada.
6. **La plantilla "Reset password" de Supabase tiene que incluir `{{ .Token }}`.** Recuperar
   la clave ahora pide un código de 6 dígitos, como el prototipo. Con la plantilla por
   defecto llega el link de siempre y la pantalla se queda esperando un código que nunca
   aparece. Va en *Authentication → Email Templates → Reset password*.
7. **Borrar el esquema `backup_pre_reset`** cuando el modelo nuevo esté verificado. Tiene
   el snapshot de los datos viejos (33 deudas, 28 consumos) y es la única copia.
8. **El motor viejo (`lib/debt-engine/`, `lib/card-statements/`)** sigue en el repo como
   control cruzado. Decidir si se borra.

---

## Migraciones aplicadas en la base

Las de esta tanda ya corrieron sobre el proyecto `udhqdbpjhifeotgoqaoa` y están en el repo
como `supabase/migration_003_*.sql` y `_004_*.sql`. `supabase/schema.sql` quedó al día.

- `bridge_loans`: se sumaron `is_taken` y `monthly_interest_rate`, y se fue
  `annual_interest_rate` — nunca se escribió desde la app y la tasa que pide la pantalla es
  mensual y simple.
- `scenarios`: se sumó `note`.
- `alert_dismissals`: se sumó `snoozed_until`. La tabla existía sin que la usara nadie y
  guardaba un descarte permanente; posponer necesita saber hasta cuándo.
- `alert_kind`: se sumaron `mes_no_cierra` y `cuotas_fijas`.
- Tabla nueva `alert_settings` (cuándo, por dónde y sobre qué deudas).
- Función nueva `create_scenario_from`, y `copy_scenario` al día con las columnas nuevas.

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
