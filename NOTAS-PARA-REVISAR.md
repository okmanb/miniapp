# NOTAS PARA REVISAR

Las tres cosas que pide el brief. Se va actualizando a medida que avanzan las pantallas.

---

## 1. Diferencias entre el motor viejo y el del prototipo

Corré `npx tsx scripts/cross-check.ts` para reproducir todo esto. El caso es el dataset
base del prototipo: las cinco deudas que suman $47.133.454, el mismo total que muestra su
dashboard.

### Amortización — coinciden exactamente

En las cinco deudas, pagando el mínimo, los dos motores dan el mismo plazo y el mismo
interés total, al peso:

| Deuda | Plazo | Interés total |
|---|---|---|
| Mastercard Patagonia …4139 | 26 meses | $ 3.875.621 |
| Mastercard Black …3311 | 7 meses | $ 1.348.475 |
| Visa Signature …2166 | no se salda | — |
| Prestamo 2 BBVA | 12 meses | $ 2.466.851 |
| Prestamo 1 BBVA | 7 meses | $ 316.243 |

Que la Visa dé "no se salda" no es un borde raro: con $30,8M al 98,03% el interés mensual
es $2.519.819 y el mínimo es $1.300.000. El mínimo no llega ni a la mitad del interés. Los
dos motores lo dicen igual, devolviendo que no se salda a ese ritmo en vez de un plazo.

Hay una diferencia de implementación que en este caso no cambia el resultado: el motor
viejo topea el último pago al saldo restante (`Math.min(pago, saldo)`) y el prototipo paga
la cuota entera aunque se pase. El plazo y el interés acumulado salen iguales porque el
interés se devenga antes del pago en los dos.

### Cierre de resumen — difieren, y gana el prototipo

Acá sí difieren, por dos razones independientes:

1. **Base del interés.** El prototipo cobra interés sobre el saldo *antes* de restar el
   pago; el motor viejo lo cobra sobre el saldo ya neto de lo pagado. El prototipo siempre
   da igual o más.
2. **Punitorio.** El prototipo cobra 3% sobre lo que faltó cuando se pagó algo pero menos
   que el mínimo. El motor viejo no modela punitorio.

Sobre la Visa, con $450.000 de consumos:

| Pagado | Prototipo cierra en | Viejo cierra en | Diferencia |
|---|---|---|---|
| $1.300.000 (el mínimo) | $32.515.299 | $32.409.100 | **$106.199** |
| $1.000.000 (menos que el mínimo) | $32.824.299 | $32.733.607 | **$90.692** |
| $0 | $33.815.299 | $33.815.299 | $0 |

Pagando $0 coinciden, porque sin pago las dos bases de interés son la misma y no hay
punitorio. La diferencia de $90.692 del caso del medio se descompone en $81.692 de interés
más $9.000 de punitorio.

**Cuál es el correcto:** el del prototipo, por instrucción del brief, y además tiene más
sentido — un banco cobra el interés del período sobre el saldo del resumen, no sobre lo
que quede después de que pagues. Igual conviene contrastarlo contra un resumen real de la
Visa, porque la diferencia sobre ese saldo es de seis cifras por mes.

### El bug del parser no estaba donde dice el brief

El brief y `RESET.md` dicen que `lib/statement-parser/` tiene un bug conocido: devuelve un
saldo muy por encima del real, probablemente sumando movimientos en vez de leer el saldo
del resumen.

Revisado: **el parser no tiene ese bug.** `bbva.ts` lee `saldoActual` del bloque de
cabecera del PDF (`CIERRE ACTUAL / VENCIMIENTO ACTUAL / SALDO ACTUAL`), que es exactamente
"el saldo del resumen". No suma movimientos para obtenerlo.

El bug era río abajo y **ya está arreglado**, en `lib/card-statements/index.ts`. El
comentario de su función `calculateStatement` describe el sintoma con estas palabras:
tomar el "saldo actual" del PDF —que ya es el total calculado por el banco— y sumarle otra
vez interés, consumos y cuotas encima, mostrando un saldo de $2-3M como $33M.

Esto importa para la limpieza: `RESET.md` clasifica `lib/card-statements/` como
"secundario pero útil". En realidad es donde vive el arreglo del bug que el brief pide
arreglar. **Se conservó**, y `lib/calc/statement.ts` hereda la misma precaución: recibe el
saldo anterior y los consumos por separado, nunca el total del resumen.

---

## 2. Lo que el prototipo no definía y hubo que decidir

- **Tipos de alerta.** Ningún documento de `handoff/` los define, pero la pantalla 10 los
  muestra. Se rescataron los seis del `01-SPEC.md` viejo a
  `handoff/RESCATE-integridad-y-alertas.md` y quedaron como enum `alert_kind`.
- **Alertas descartadas.** El prototipo guarda `seenAlerts` y `snoozes` en localStorage.
  Como las alertas se derivan del modelo en cada lectura, la tabla `alert_dismissals`
  guarda solo el descarte, con el id del sujeto concreto para no silenciar una categoría
  entera de por vida.
- **Un escenario activo por usuario.** El prototipo tiene un único `scen` en su estado. Se
  volvió un índice único parcial en la base en vez de una regla de la app, para que dos
  pestañas abiertas no puedan dejar dos activos.
- **`recurringCharge` en la amortización.** El `_amort` del prototipo no lo recibe; su
  `_payoff` sí aplica un `rec` por deuda. Se unificó en un parámetro opcional que por
  defecto es 0, con lo cual el comportamiento es idéntico al del prototipo cuando no se
  usa. Cuando se usa, además entra en la condición de "no se salda", que es lo que hace
  falta para el caso de una tarjeta con gastos fijos cargados encima.
- **Punitorio del 3%.** Sale de `_stmtProj` del prototipo, que lo tiene hardcodeado. No
  está en ningún documento ni es configurable por tarjeta. Probablemente debería salir de
  `min_payment_formula`, pero se portó como está.

---

### El motor coincide con el prototipo en dos pantallas distintas

`npx tsx scripts/cross-check.ts` verifica, además de lo de arriba, las cinco cifras que la
pantalla 03 del prototipo muestra para la Patagonia. Las cinco dan igual **al peso**:

| | Nuestro | Prototipo |
|---|---|---|
| Interés del mes | $236.519 | $236.519 |
| Meses pagando el mínimo | 26 | 26 |
| Interés total al mínimo | $3.875.621 | $3.875.621 |
| Meses pagando el doble | 8 | 8 |
| Ahorro pagando el doble | $2.757.627 | $2.757.627 |

Y en la pantalla 02, los seis valores del gráfico de disponible por mes (−0.6M, −0.6M,
−0.8M, −1.1M, −1.3M) también coinciden.

## 3. Pendiente

- **Verificar las pantallas con datos reales.** Todas están construidas y el build de
  producción pasa limpio (24 rutas, ningún enlace roto), pero solo se compararon contra el
  prototipo usando `app/dev-preview/`, que existe únicamente en desarrollo. Para verlas con
  datos de verdad hace falta una sesión iniciada, y no creo cuentas ni manejo contraseñas.
  Creá tu usuario en `/signup` y la app queda lista para cargar el primer escenario.
- **El parser de PDF ya está enganchado a la pantalla 06.** Se sube el PDF, se lee y se
  prellenan los campos — pero prellena, no guarda: el parser depende de la maquetación de
  cada banco y se rompe cuando el banco la cambia, así que lo leído va a campos editables
  y lo que no se pudo leer se dice en gold en vez de quedar en cero.
  `npx tsx scripts/parser-check.ts` lo verifica con 17 comprobaciones sobre el layout real
  de BBVA. La que más importa es negativa: comprueba que el saldo **no** coincida con la
  suma de los consumos, que es como se detectaría que alguien "arregló" el parser
  volviendo a calcularlo.

  **Probado contra un resumen real de Visa BBVA (septiembre 2026), y encontró un bug de
  verdad.** BBVA renombró el producto: las refinanciaciones ahora vienen como
  `FINANC DE SALDO` y ya no como `VISA PLAN V`. El parser no solo las perdía —como tampoco
  las excluía de los consumos, las contaba como gasto del mes—. En ese resumen inflaba los
  consumos de $738.668 a $3.277.001: un 344% de más, porque $2.538.333 de refinanciación
  entraban como si fueran compras del mes.

  Arreglado en `bbva.ts`, con dos capas: se reconoce el nombre nuevo, y además se descarta
  de los consumos cualquier línea que traiga `(TNA ...)` al lado. Esa segunda es la red
  para la próxima vez que el banco le cambie el nombre: un consumo del mes nunca trae su
  propia tasa. Queda como regresión en `scripts/parser-check.ts`.

  **Segundo bug del mismo PDF: el total en dólares se sumaba en vez de leerse.** La regex
  del encabezado ya capturaba la columna `SALDO ACTUAL U$S` y la descartaba, así que la
  pantalla mostraba la suma de las líneas de consumo en dólares que se podían reconocer —
  US$ 102,08 en vez de los US$ 127,06 que declara el resumen. Era el mismo pecado que el
  parser tiene prohibido con el saldo en pesos, cometido en la otra moneda. Ahora se lee
  del encabezado, y si la suma línea por línea no llega a ese total se avisa, porque el
  faltante viene de una limitación nuestra y no de que se haya gastado menos.

  **Los resúmenes de Patagonia vienen protegidos con contraseña.** El de septiembre no se
  pudo abrir. La app lo detecta y lo dice con la solución concreta (abrirlo con la clave
  del banco, guardar una copia sin protección, subir esa) en vez del error genérico. No se
  pide ni se guarda la contraseña: no hay razón para que la app maneje una clave personal.
  **Patagonia probado con un PDF real (septiembre 2026), y tenía el mismo bug.** El
  encabezado sí trae columna de dólares —yo había escrito `saldoActualUsd: null`
  *afirmando lo contrario sin verificarlo*— y la regex ya la capturaba en `match[3]` para
  descartarla, exactamente igual que en BBVA. Eran US$ 20,24. Corregido.

  Lo demás de Patagonia sale bien y está verificado contra el texto crudo: cierre
  27-Ago-26, TNA punitoria 80,50%, saldo $4.644.435,68, mínimo $675.505, y las 22 líneas
  de consumo excluyen correctamente `IMPUESTO DE SELLOS`, `INTERESES FINANCIACION`,
  `DB IVA` e `IVA RG 4240`.

  Los tres parsers quedan probados contra archivos reales del banco.
- **La pantalla 00 estaba mal y se rehizo.** Lo que había construido era una landing de
  marketing con tres tarjetas explicativas, y **eso no existe en el prototipo**. El
  onboarding real es un alta guiada de la primera deuda en tres pasos, y ahora está
  portado palabra por palabra, con los cuatro tipos de deuda y sus tasas típicas
  prellenadas (tarjeta 83,80% día 10 · préstamo 95% día 5 · familiar 0% día 30 · servicio
  60% día 15).

  Funciona **sin cuenta**, porque el prototipo lo dice con todas las letras. Lo cargado
  vive en el navegador y sube a Supabase recién cuando la persona crea la cuenta. Esa
  importación es idempotente: si el usuario ya tiene un escenario, no importa nada.

  Contrastado contra el prototipo con los mismos números: mínimo $40.000, interés del mes
  $34.917, sobrante $4.860.000, "vence en 3 días", "10 de septiembre". Todo igual.
- **Borrar `backup_pre_reset` cuando el modelo nuevo esté verificado.** El esquema ya se
  aplicó a `miniapp_deb` (`udhqdbpjhifeotgoqaoa`). El proyecto **no estaba vacío**: tenía
  33 deudas, 28 líneas de consumo, 3 resúmenes y 2 escenarios reales, contra lo que asumía
  el brief. Se decidió arrancar de cero igual, pero antes del drop quedó un snapshot
  completo de `public` en el esquema `backup_pre_reset`, dentro del mismo proyecto. Está
  ahí a propósito: es la única copia de esos datos.
- **Activar la protección de contraseñas filtradas en Supabase Auth.** El linter la marca
  como desactivada; contrasta las contraseñas contra HaveIBeenPwned. Es un cambio de
  configuración de la cuenta, así que no lo toqué.
- **Migrado a Next 16 — `npm audit` da 0 vulnerabilidades.** Primero se subió dentro de la
  línea 14 (`14.2.15` → `14.2.35`), y no alcanzó: los avisos que quedaban no tenían arreglo
  dentro de 14.x. Como el objetivo era cero, se hizo la mayor. Esto **contradice a propósito**
  la línea de `RESET.md` que decía que Next 14 seguía igual: fue una decisión explícita del
  usuario, tomada después de ver que el parche no bastaba.

  Lo que cambió con la mayor, por si algo se comporta raro:

  - **React 19.** `useFormState` (de `react-dom`) quedó obsoleto y se reemplazó por
    `useActionState` (de `react`), que además devuelve el estado de pendiente — así
    desapareció `useFormStatus` y con él los subcomponentes que existían solo para leerlo.
  - **`cookies()` es asíncrono**, así que `createClient()` de `lib/supabase/server.ts`
    también, y los 28 archivos que lo usan hacen `await`. Se pasó de la API `get/set/remove`
    de cookies a `getAll/setAll`, que es la vigente en `@supabase/ssr` 0.7.
  - **`params` y `searchParams` son promesas** en las páginas. Se desenvuelven con `await`.
  - **`middleware.ts` pasó a llamarse `proxy.ts`**, que es la convención de Next 16. Es el
    mismo archivo con otro nombre; lo pedía el propio aviso de deprecación.
  - **Turbopack** es el bundler por defecto. Hubo que fijarle `turbopack.root`, porque si no
    sube buscando un lockfile y encuentra uno en el home del usuario, fuera del repo.

  Después de migrar: build limpio sin avisos, las 24 rutas responden (públicas 200, privadas
  307 al login), cero errores de consola, y el control cruzado sigue dando las mismas cifras
  al peso.
- ~~**Contrastar el cierre de resumen contra un PDF real**~~ — hecho el 11 de septiembre, con
  dos resúmenes reales de la Patagonia. Ver la sección 4.
- El `lib/debt-engine/` viejo queda en el repo como control cruzado, no como
  implementación. Cuando las pantallas estén, conviene decidir si se borra o se deja.

---

## 4. El motor contra un banco de verdad

Hasta acá el motor se había medido contra el prototipo y contra el motor viejo. **Nunca
contra la aritmética de un banco.** Con los resúmenes de agosto y septiembre de la Patagonia
se pudo, porque encadenan: el saldo con el que cierra agosto ($3.295.526,81) es exactamente
el saldo anterior de septiembre. El banco da su propia verdad de referencia.

Con TNA 80,5% —TEM 6,7083%— y el interés despejado de cada resumen (cierre − anterior −
consumos):

| | Interés del motor | Interés del banco | Diferencia |
|---|---|---|---|
| Agosto (cierre 30/07) | $143.328 | $181.241 | **−$37.913** |
| Septiembre (cierre 27/08) | $221.075 | $197.950 | **+$23.124** |

**El signo cambia, y eso es lo que importa.** Si fuera la tasa mal puesta, o el interés
aplicado sobre el saldo equivocado, el error iría siempre para el mismo lado. Que un mes
falte y al otro sobre dice que la base de cálculo es otra: el banco casi con seguridad cobra
sobre el **saldo diario promedio** del período, no sobre el saldo de apertura.

Encaja con lo que muestran los dos resúmenes: en agosto los consumos entraron temprano y
levantaron el promedio por encima del saldo inicial; en septiembre un pago lo bajó.

### Qué hacer con esto

**Por ahora, nada — pero que quede escrito.** La fórmula actual es la del prototipo
(`interés = saldo anterior × TEM`) y el prototipo manda. El error es de entre el 1% y el 2%
del saldo por mes, y en una proyección a doce meses se acumula.

Si alguna vez se quiere cerrar esa brecha, **el dato está**: el parser ya extrae las líneas
de consumo con su fecha (22 en el resumen de septiembre). Con eso se puede promediar el
saldo día por día. Es un cambio al modelo, no un arreglo, así que se propone antes de
hacerlo — y habría que decidir qué pasa con el control cruzado contra el prototipo, que
dejaría de coincidir al peso.

---

## 5. Lo que el propio resumen dice sobre cómo cobra

Del texto legal del resumen de la Patagonia (septiembre 2026). No es interpretación: está
escrito ahí, y contesta tres cosas que se venían suponiendo.

### El interés se devenga desde el vencimiento anterior

> Los intereses de financiación se calculan desde el Vto. de su resumen anterior.

**Desde el vencimiento, no desde el cierre.** Eso explica por qué ninguna de las dos
hipótesis que se midieron cerró: ni el saldo de apertura ni el saldo diario promedio
calculado entre cierres, porque el período de devengamiento es otro y arranca once días
después del cierre anterior.

Y: **"Banco Patagonia S.A. no aplica capitalización de intereses"** — es simple, no compuesto.

### La tasa punitoria es la misma que la de financiación

> La tasa de interés punitorio en pesos es igual a la tasa de interés de financiación en su
> respectiva moneda.

Esto **relaja la advertencia** del rótulo del formulario. El campo dice "Tasa de interés
punitorio anual (%)" porque así lo dice el prototipo, y se venía avisando que el campo en
realidad es la nominal de financiación. Para este banco son el mismo número —TNA 80,50% las
dos— así que cargar una no corrompe la otra. La advertencia sigue valiendo como principio
—son conceptos distintos— pero deja de ser un riesgo concreto acá.

### La fórmula del pago mínimo, completa

> El pago mínimo está compuesto por el 10% de los consumos en 1 pago, el 10% del saldo
> financiado, el 25% de las compras de 2 a 6 cuotas, el 50% de las compras en 7 cuotas o
> más, el 100% de adelantos en efectivo en pesos y dólares, el 100% intereses y cargos del
> período, el 100% del pago mínimo anterior impago, el 100% de todo saldo que exceda el
> límite de financiación asignado.

Es consistente con los números de septiembre: mínimo $675.505, de los cuales $190.581 son
los intereses al 100%, y los $484.924 restantes se acercan al 10% del saldo ($464.444) más
lo que aportan los tramos de cuotas.

### Y acá está la consecuencia que importa

**La proyección congela el mínimo.** `debtDueFor` devuelve el mismo `totalDue` para todos los
meses futuros: la suma de los mínimos del último resumen de cada tarjeta. Pero el mínimo real
**crece con el saldo** —es 10% del financiado más el 100% de los intereses— así que en un
escenario donde el saldo sube, la obligación mensual que proyectamos se queda corta y **el
mes en que te quedás sin plata sale más tarde de lo que va a ser**. Es exactamente la
pregunta que la app existe para contestar.

La columna `debts.min_payment_formula` (jsonb) existe desde la migración 002 justamente para
esto, y **no la lee nadie**: solo la menciona `lib/debt-engine/`, el motor viejo.

**No se cambió nada.** Tocar `debtDueFor` mueve los seis valores del gráfico de flujo que el
control cruzado compara contra el prototipo al peso. Es un cambio de modelo y se propone
antes de hacerse. Pero es, de todo lo encontrado, lo que más afecta la respuesta que la app
da.
