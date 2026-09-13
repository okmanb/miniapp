# Dónde quedó esto — para retomar

Última actualización: 13 de septiembre de 2026.

Ocho sesiones lo escribieron. La primera construyó la app; la segunda comparó las dieciséis
pantallas contra el prototipo y la desplegó; la tercera la usó en producción y arregló lo
que aparece solo cuando la abrís; la cuarta arregló los cuatro controles que la tercera dejó
rotos al mirarlos en un teléfono de verdad. La quinta y la sexta la usaron con resúmenes
reales del banco, y ahí apareció casi todo lo que sigue. La séptima encontró que la TEM se
guardaba y no se usaba, y diseñó la puerta de entrada. **La octava encontró que "cuánto pagaste" invitaba a borrar el pago que el banco ya había
tomado, que los 504 del gateway se leían como datos faltantes, que las cuotas
del PDF nunca se guardaron** —la tabla tenía cero filas después de seis resúmenes— y
convirtió la prueba sin cuenta en una cuenta de prueba de verdad, que se borra sola a las 24
horas.

---

## Si vas a hacer una sola cosa

**Cargar los resúmenes de agosto y de septiembre, en ese orden, sobre la misma tarjeta.**

Es el único camino que ejercita tres cosas que solo existen en el código: el segundo resumen
sobre una tarjeta que ya tiene uno, la absorción del pago anterior, y el aviso de doble
conteo de dólares. Los dos PDF están en `Downloads` y encadenan —el cierre de agosto es
exactamente el saldo anterior de septiembre— así que sirven además como control.

El patrón lleva cuatro sesiones seguidas cumpliéndose: **cada vez que la app se usó con
datos reales apareció un bug, y casi ninguno se veía leyendo el código.**

Al cargarlos, mirá que las cuotas queden: hasta la migración 012 no quedaba ninguna. Después
de guardar un resumen con compras en cuotas, `card_installment_plans` tiene que dejar de
estar vacía.

---

## Lo que encontró la octava sesión

### Entrar con Google o con Apple: el lado de la app está hecho y espera el interruptor

Los botones ya están en `/login` y en `/signup`, y **aparecen solos**: `proveedoresHabilitados()`
le pregunta a `/auth/v1/settings` de Supabase cuáles están prendidos y cachea la respuesta
cinco minutos. Hoy están los dos apagados, así que no se ve nada. El día que se habilite uno,
el botón aparece sin tocar código — y si se apaga, desaparece.

**Por qué importa más de lo que parece:** el servidor de mail incorporado de Supabase solo
entrega a los miembros de la organización, así que hoy **nadie que no sea `okmanb@gmail.com`
puede crear cuenta**. Con Google no hay mail que mandar: es la forma más barata de destrabar
el alta sin resolver el SMTP (pendiente 2).

**Con una cuenta de prueba abierta se ENLAZA, no se crea otra.** `entrarConProveedor` usa
`linkIdentity` cuando la sesión es anónima: mismo id, misma deuda cargada. Con
`signInWithOAuth` se abriría una cuenta nueva y la de prueba quedaría esperando que el cron
la borre con todo adentro. Eso necesita **manual linking** habilitado en el proyecto.

Lo que falta no es código:

1. **Google.** Crear un proyecto en console.cloud.google.com, configurar la pantalla de
   consentimiento, y crear un *OAuth client ID* de tipo **Web application** con esta URI de
   redirección:

       https://udhqdbpjhifeotgoqaoa.supabase.co/auth/v1/callback

   Después, con el client id y el secret, en *Supabase → Authentication → Sign In / Providers
   → Google*, o por la Management API con un token de
   https://supabase.com/dashboard/account/tokens:

   ```bash
   curl -X PATCH "https://api.supabase.com/v1/projects/udhqdbpjhifeotgoqaoa/config/auth"      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"      -H "Content-Type: application/json"      -d '{"external_google_enabled":true,
          "external_google_client_id":"EL_CLIENT_ID",
          "external_google_secret":"EL_SECRET",
          "security_manual_linking_enabled":true}'
   ```

   El CLI de Supabase (`supabase config push`) también puede, pero empuja **toda** la config
   de auth del `config.toml`, así que puede pisar cosas que hoy están prendidas a mano —las
   sesiones anónimas, sin ir más lejos—. El PATCH toca solo lo que se nombra.

   Dos cosas que aparecieron al configurarlo, las dos verificadas contra la consola:

   - **`supabase.co` NO se puede poner como *Authorized domain*.** Google contesta *"must be
     a top private domain"*: está en la lista de sufijos públicos, porque Supabase reparte
     subdominios ahí. En estado **Testing** ese campo no hace falta, así que se deja vacío.
   - **Publicar (salir de Testing) va a necesitar dominio propio.** Pide política de
     privacidad, términos y un *authorized domain*, y `vercel.app` también es un sufijo
     público. En Testing entran solo los mails cargados como *test users*, hasta 100, que
     para probar alcanza. **Es el mismo dominio que falta para el SMTP**: dos cosas
     bloqueadas por la misma compra.

2. **Apple.** Necesita **cuenta paga de Apple Developer** (US$ 99 por año) para crear el
   Services ID y la clave privada del *Sign in with Apple*. No hay forma de saltearlo, y por
   eso el botón está escrito pero probablemente no se use por ahora.

#### "Prendido" no es "configurado", y se aprendió a los golpes

Apple quedó prendido en el panel **sin credenciales**. `/auth/v1/settings` lo daba por activo
—`apple: true`— así que el botón se mostraba, y arrancar el flujo devolvía:

    400 · "Unsupported provider: missing OAuth secret"

Un botón que lleva derecho a un error. Por eso `proveedoresHabilitados()` pregunta **dos**
cosas: `settings` para saber qué está prendido, y `/auth/v1/authorize?provider=…` con
`redirect: "manual"` para saber si además arranca. Un 3xx es que sí; un 400 es que falta el
secret. Solo se prueba lo que dice estar prendido, y las dos respuestas se cachean cinco
minutos.

Verificado contra el proyecto real: hoy `settings` dice `apple: true`, el authorize da 400, y
la app no muestra ningún botón — que es lo correcto.

#### Borrar la cuenta, no solo los datos

Ajustes tenía "Borrar todos mis datos", que borra los escenarios en cascada y deja la cuenta
abierta y vacía. Faltaba la otra mitad, y se notó al escribir la política de privacidad: la
página tenía que decir "escribinos un mail y te damos de baja", que es pedirle a alguien que
confíe en que otro se acuerde.

Ahora hay **Borrar mi cuenta** debajo, con el mismo patrón —plegado, con palabra de
confirmación— y en ese orden a propósito: primero la reversible de las dos.

El borrado lo hace `borrar_mi_cuenta()` **adentro de la base** (migración 015), no la API de
admin. Hacerlo desde la app necesitaría la service role key, que saltea RLS entera y ni
siquiera está en el entorno local. La función es `security definer`, no recibe argumentos y
borra una sola fila: la de `auth.uid()`. Ese filtro es toda la seguridad del asunto — no hay
forma de pedirle que borre a otro.

Probado de punta a punta en el navegador: se abrió una cuenta de prueba con una deuda, se
borró desde Ajustes, y en la base quedaron en cero la cuenta, su escenario y su deuda, sin
tocar las otras dos cuentas de prueba que había en ese momento.

#### Privacidad y términos, en `/privacidad` y `/terminos`

Las pide Google para publicar la pantalla de consentimiento, pero la razón buena es la otra:
una app donde alguien escribe cuánto debe tiene que poder decir en un clic qué hace con eso.
Se llegan desde el pie de la landing y desde Ajustes.

**Todo lo que afirman está verificado contra el código**, no es una plantilla:

- el PDF no se guarda (`parse-actions.ts` lo dice y lo cumple: se lee en memoria y se
  descarta),
- la base está en `us-west-2` (Oregón) —consultado al proyecto, no supuesto—,
- no hay una sola librería de analítica ni de rastreo en el `package.json`,
- la única cookie es la de sesión, y el borrador del onboarding vive en `localStorage`,
- las cuentas de prueba se borran a las 24 h y las tarjetas archivadas a los 7 días, que es
  lo que hacen los dos cron de las migraciones 013 y 014,
- **"Borrar todos mis datos" no borra la cuenta**: borra los escenarios en cascada y las
  preferencias de alerta, y la cuenta queda abierta y vacía. La página lo dice y ofrece el
  mail para pedir la baja.

La regla que queda: **si cambia alguna de esas conductas, la página cambia en el mismo
commit.** Una política de privacidad desactualizada es peor que no tenerla, por lo mismo que
un handoff desactualizado.

Dos cosas para que las mire una persona: el mail de contacto es el personal
(`okmanb@gmail.com`, el mismo que ya va a quedar público en la pantalla de Google), y esto
lo escribió un modelo, no un abogado.

#### El CLI quedó linkeado, y `config diff` es la herramienta que vale

`supabase/config.toml` está en el repo y salió de un `config pull`, así que refleja el
proyecto. Dos cosas aprendidas al usarlo:

- **En PowerShell hay que llamar `npx.cmd`**, no `npx`: la política de ejecución de Windows
  bloquea `npx.ps1` (*"running scripts is disabled on this system"*). Vale para todo el
  proyecto, no solo para Supabase.
- **Un `pull` no deja el archivo idéntico al proyecto.** Corriendo `config diff` justo
  después aparecen dos diferencias que el pull no trajo: `auth.sms.twilio.enabled` (local
  `false`, remoto **`true`**) y `auth.password_requirements`. O sea que un push le apagaría
  el Twilio al proyecto sin que nadie lo haya pedido. Nadie usa el alta por teléfono, pero la
  regla queda: **`config diff` siempre antes de `config push`**, y lo que el diff llama
  *unmanaged* —el OAuth server, los `client_id`, los límites de mails— ni se compara ni se
  empuja.

**`enable_manual_linking` está en `false` en el proyecto**, y hace falta prenderlo antes de
que Google sirva para guardar una cuenta de prueba: sin eso `linkIdentity` falla y la única
salida es abrir una cuenta nueva, que deja la de prueba —con todo lo cargado— esperando que
el cron la borre. Se prende en *Authentication → Sign In / Providers*.

#### El "OAuth Server" del panel es otra cosa, y quedó prendido

Es el camino contrario: hace que **¿Llegás? sea el proveedor de identidad de otras apps**
("entrar con ¿Llegás?" desde un tercero), no que se pueda entrar con Google. No aporta nada
al alta y hoy está prendido, con dos consecuencias:

- El `Authorization Path` apunta a `/oauth/consent`, **que la app no implementa**. Cualquier
  intento de autorización cae en un 404.
- `Allow Dynamic OAuth Apps` está prendido, así que
  `…/auth/v1/oauth/clients/register` acepta registros de cualquiera. Verificado: el
  `.well-known/openid-configuration` responde y publica ese endpoint.

**Conviene apagarlo** (*Authentication → OAuth Server*) mientras no haya una app de terceros
que lo necesite. Si alguna vez la hay, lo que falta es la pantalla de consentimiento. Al
13 de septiembre sigue prendido: el `.well-known/openid-configuration` responde 200.

Apple, en cambio, **ya se apagó**: `/auth/v1/settings` da `apple: false`.

### Archivar una deuda ahora es una papelera con fecha, no un para siempre

Borrar una tarjeta nunca borró nada: `archiveDebt` pone `is_active = false`, con el
argumento —escrito en el código— de que sus pagos y resúmenes son historial real. **El
argumento no se sostenía**: ese historial no se muestra en ningún lado. La pantalla de pagos
filtra por `debts.is_active`, y el tablero y el flujo solo leen las activas. Archivar
guardaba datos que nadie podía mirar nunca más.

Y se juntan rápido por un camino de lo más normal: volver a cargar el resumen de una tarjeta
como "tarjeta nueva" crea una fila nueva y archiva la anterior. En una sola tarde quedaron
**siete**, todas del período 2026-08, todas versiones viejas de las tres tarjetas vivas. Se
borraron a mano, con un respaldo en `Downloads/llegas-tarjetas-archivadas-2026-09-13.md`.

De ahora en más lo hace solo (migración 014): `debts.archived_at` lo pone un **trigger** —no
la app, para que cualquier camino que apague `is_active` quede marcado igual— y
`borrar_tarjetas_archivadas()` corre por pg_cron todos los días a las 4:23 UTC y borra las
de más de **7 días**, con sus resúmenes, pagos y cuotas en cascada.

`created_at` no servía para medir esa espera: dice cuándo se creó la tarjeta, no cuándo se
archivó, así que una tarjeta vieja archivada hoy se habría borrado en el acto.

Verificado en la base, en una transacción que después se revirtió: el trigger marca la fecha
al archivar, una archivada hoy sobrevive a la pasada del cron, y una con la fecha corrida
ocho días atrás se borra.

Los 7 días están en dos lados que tienen que coincidir: la migración y el texto de
`DebtActionsSheet` ("se borran del todo" a los 7 días).

### "Cuánto pagaste" no es lo que vas a pagar: es lo que el banco ya te tomó

La Visa quedó mostrando **$ 9.841.296** con un resumen que cierra en **$ 8.042.456**, y la
diferencia es exactamente el pago que trae el PDF: **$ 1.798.840**.

No fue un error de cálculo. Son dos cargas del mismo resumen, a quince minutos una de otra:

| Hora  | "Cuánto pagaste" | Cierre guardado | ¿Coincide con el banco? |
| ----- | ---------------- | --------------- | ----------------------- |
| 17:48 | 1.798.840        | 8.042.456       | sí                      |
| 18:13 | 0                | 9.841.296       | no, por 1.798.840       |

El saldo con el que un resumen cierra **ya tiene descontado** el pago que el banco recibió
durante el período — es la línea "SU PAGO" del PDF, y el parser la lee (`pagosDelPeriodo`).
Poner cero ahí no dice "todavía no pagué el resumen": dice "el banco no me tomó ningún
pago", y deja el cierre por encima del suyo por el monto exacto de ese pago.

**La ayuda del campo empujaba a eso.** Decía, con todas las letras, *"Dejalo en cero si
todavía no pagaste"* — que leído desde el vencimiento del mes que viene es exactamente lo que
no hay que hacer. Ahora dice qué es: el pago que el banco ya tomó en este resumen.

Y arriba de eso hay un aviso nuevo, `PagoDeclarado`, pegado al campo: cuando el PDF declara
un pago y el campo no lo tiene, lo nombra, dice cuánto se va a desviar la tarjeta y trae un
botón para ponerlo. La comparación del final ya mostraba la diferencia —"nuestra cuenta da
$ 1.798.840 más que el resumen"— pero nombra el síntoma sin decir de dónde sale. Se puede
mirar en `/dev-preview/pantallas`, sección 06b, en sus dos estados.

**Queda una ambigüedad conocida:** los atajos de "tipo de pago" (mínimo / total) escriben en
ese mismo campo, y bajo esta lectura significan "el banco ya me tomó esto". Es del prototipo
y no se tocó, pero si alguna vez el campo se parte en dos —lo que el banco tomó y lo que voy
a pagar—, este es el motivo.

### Los 504 del gateway, y un cartel que echaba la culpa a los datos

Cargando la segunda tarjeta del día salió **"No hay un escenario activo donde guardar la
tarjeta"** con el escenario activo y sano en la base. Los `edge_logs` tienen el evento real:

    17:50:12 · GET /rest/v1/scenarios?select=id&is_active=eq.true → 504 · 5012 ms

Un timeout del gateway de Supabase. La consulta ni llegó a Postgres. El código descartaba el
error del `select`, así que "la lectura falló" y "no hay escenario" terminaban en el mismo
cartel — y el cartel mandaba a buscar un problema que no existe.

**No fue un caso aislado.** En veinticuatro horas hubo cuatro, en cuatro tablas distintas
(`scenarios`, `expenses`, `card_statements`, `incomes`), todos a los **5 segundos clavados**.
Es el borde de Supabase cansándose de esperar, no una consulta pesada.

Dos arreglos, uno por capa:

1. **`lib/supabase/server.ts` reintenta las lecturas.** El cliente lleva su propio `fetch`:
   hasta tres intentos para GET y HEAD, con 250 y 500 ms de espera. **Solo lecturas** — un
   504 no quiere decir que no pasó nada, así que repetir un POST podría crear la tarjeta dos
   veces o cobrar el resumen dos veces, que es peor que el error. Probado con un servidor de
   juguete que falla dos veces: el GET vuelve con 200 a los 829 ms y el POST sale una sola
   vez.
2. **`saveStatement` dejó de descartar los errores de sus cinco lecturas.** Cada una dice qué
   pasó y que no se guardó nada. Tres de esas cinco no eran solo cosmética: si los gastos
   abiertos, el resumen del mes o los pagos vivos vuelven vacíos por un error de red, el
   saldo se calcula mal y nadie se entera.

### Las cuotas del PDF nunca se guardaron, y el índice era el motivo

`card_installment_plans` tenía **cero filas** en producción después de seis resúmenes reales
cargados, varios con refinanciaciones y compras en cuotas que la pantalla reconocía bien
("Encontramos 8 compras en cuotas … Se guardan al confirmar"). Se leían, viajaban en el
formulario en un `<input type="hidden">`, y desaparecían al guardar.

El motivo era el índice único, que era **parcial**:

```sql
create unique index card_installment_plans_debt_cupon_idx
  on card_installment_plans (debt_id, cupon) where cupon is not null;
```

El código hace `upsert(..., { onConflict: "debt_id,cupon" })`, que PostgREST traduce a
`on conflict (debt_id, cupon)`. Postgres solo acepta un índice parcial como árbitro si el
INSERT repite su cláusula WHERE, y PostgREST no la emite. Cada upsert moría con
`42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`
—y el código **descartaba el error**, igual que hacía con `debtError` antes de la sesión
anterior. Fallo total, silencioso, en el único camino por el que las cuotas entran a la app.

La migración 012 lo cambia por un índice completo, que conserva la intención: dos NULL son
distintos entre sí en un índice único (NULLS DISTINCT es el default), así que dos cuotas
cargadas a mano sin cupón siguen conviviendo. Verificado contra la base: el `explain` del
INSERT ahora resuelve el árbitro, y dos upserts seguidos dejan **una** fila con el importe
del segundo, que es lo que tiene que pasar al cargar dos veces el mismo resumen.

Del lado del código, el error del upsert ahora se devuelve: "Guardamos el resumen pero no
pudimos guardar las N compras en cuotas: …". La lección se repite por tercera vez en el
proyecto: **un error de Supabase que no se lee es un bug que no existe hasta que alguien
mira la tabla.** Si ves un `await supabase...` sin `error`, eso es un candidato.

### Probar sin cuenta ahora es una cuenta de prueba de 24 horas

El paso 3 del onboarding vuelve a decir **"Ir a mi tablero"**, como el prototipo, y esta vez
cumple: abre una **sesión anónima de Supabase** y entra al tablero de verdad. Esa cuenta es
igual a cualquier otra —su propio `auth.uid()`, sus propias filas, las mismas políticas de
RLS— con una sola diferencia: no tiene mail, así que nadie puede volver a abrirla. Ni
nosotros.

Por eso vive **24 horas** y lo dice en todas las pantallas. El número está en dos lados que
tienen que coincidir: `HORAS_DE_PRUEBA` en `lib/auth/prueba.ts` y el `interval '24 hours'`
de la migración 013. No hay forma de que uno lea al otro.

- **El cartel** (`components/CuentaDePrueba.tsx`) vive en el marco del tablero, así que sale
  en las dieciséis pantallas privadas y dice cuánto falta, no "temporal" a secas.
- **Ajustes** encabeza con "Cuenta de prueba", ofrece guardarla, y el botón de salir dice lo
  que hace de verdad: "Salir y descartar la prueba".
- **El borrado** lo hace `public.borrar_cuentas_de_prueba()`, que corre por pg_cron en el
  minuto 7 de cada hora. Supabase no tiene limpieza automática de usuarios anónimos, lo dice
  su documentación. Verificado contra la base que las once tablas caen en cascada: se borró
  una cuenta de prueba real con su deuda adentro y la deuda se fue con ella.

#### El advisor de Supabase ahora tira trece avisos, y están bien

Apenas se habilitan las sesiones anónimas, `get_advisors` marca
`auth_allow_anonymous_sign_ins` en las once tablas nuestras (más dos de `cron`): dice que
hay políticas que le dan acceso a usuarios anónimos. **Es correcto y es a propósito.** Las
políticas son `auth.uid() = user_id`, así que un usuario anónimo ve exactamente sus propias
filas y nada más — que es justo lo que hace falta para que el tablero de la prueba sea el
tablero de verdad.

**No las "arregles"** agregando políticas restrictivas con `is_anonymous is false`: eso deja
a la cuenta de prueba sin poder leer ni escribir nada, y la prueba entera se cae. El aviso
existe para proyectos donde una tabla es compartida entre usuarios; acá no hay ninguna.

#### Guardar la cuenta es un `updateUser`, no un alta

El usuario es **el mismo** —el mismo id— así que no se mueve una sola fila. La otra opción
sería crear una cuenta nueva y mover los datos, y es la peligrosa: para hacerla habría que
creerle al navegador de quién era la cuenta vieja.

La conversión queda partida en dos porque Supabase no deja ponerle clave a una cuenta
anónima sin mail confirmado. Está medido, con estas palabras:

    422 · "Updating password of an anonymous user without an email or phone is not allowed"

Entonces: `/signup` con sesión anónima pide **nombre y mail, sin clave**, hace
`updateUser({ email })` y deja `clave_pendiente` en el metadata. El link de confirmación
vuelve por `/auth/callback`, que mira esa marca y manda a **`/clave`**, la única pantalla
nueva. Ahí se pone la clave y se apaga la marca.

**Ojo con el hueco:** entre que se pide el mail y se confirma, la cuenta **sigue siendo
anónima**, así que el cron la puede borrar si se cumplen las 24 horas. La pantalla de
"revisá tu mail" lo dice.

Lo que falta verificar es exactamente eso: el mail de confirmación de punta a punta. Está
probado que el link se acepta (HTTP 200, `email_change_sent_at` con fecha), pero no que al
volver la cuenta quede permanente y la clave se guarde — hace falta un buzón de verdad.

Y ojo con el pendiente 2, que ahora pesa más: **el servidor de mail incorporado solo entrega
a los miembros de la organización**. Guardar una cuenta de prueba manda un mail, así que hoy
solo puede guardarla `okmanb@gmail.com`. Para cualquier otra persona la prueba funciona
entera y **no se puede guardar**: se le borra a las 24 horas. Eso es SMTP propio, no código.

### La prueba sin cuenta terminaba en la pantalla de login

El paso 3 del onboarding tenía "Ir a mi tablero" apuntando a `/dashboard`, que `proxy.ts`
protege: sin sesión rebota a `/login?redirectTo=/dashboard`, sin decir por qué, tres
renglones después de prometer que probar no pide cuenta. Es el mismo callejón que ya se
había cerrado en el paso 1 con el botón del PDF.

El primer arreglo fue de texto: el botón pasó a decir "Crear mi tablero" y a mandar al
alta. **Eso duró una hora**: se habilitaron las sesiones anónimas en el proyecto y el botón
volvió a ser el del prototipo, con la cuenta de prueba detrás (arriba). Queda acá porque
explica por qué `/signup` y `/login` entienden `?desde=onboarding`: quien llega sin cuenta
de prueba —porque las sesiones anónimas estén apagadas— sigue teniendo ese camino, y las dos
pantallas dicen qué pasa con lo que cargó.

`DraftImporter` sube el borrador del navegador la primera vez que se entra con sesión, sea
una cuenta de prueba o una de verdad.

---

## Lo que pasó en las dos sesiones anteriores

Por si venís en frío y querés el titular de cada cosa. El detalle está más abajo y en los
mensajes de commit, que explican el porqué.

- **El pago del resumen no dejaba recibo** y se podía descontar dos veces. Ahora es un pago
  como cualquier otro y el resumen absorbe los que ya trae adentro.
- **El PDF se pide una sola vez**: el resumen crea la tarjeta. De paso se cerró un bug que
  sumaba un mes entero de interés de más.
- **Los dólares cuentan**, con la cotización que trae un botón y su aviso de doble conteo.
- **El worker de pdfjs no viajaba al deploy**, así que ningún PDF entraba en producción
  aunque anduviera local.
- **La tasa mensual la declara el resumen** y no es la anual sobre doce: el banco usa 30/365.
  Calculábamos 1,4% de más todos los meses.
- **El mínimo proyectado ya no se congela**: sigue al saldo, con la proporción que el banco
  efectivamente pidió. La fórmula literal NO se implementó, y la razón está medida.
- **Tres notas de este mismo documento resultaron falsas** al ir a usarlas. Están corregidas,
  pero la lección es del documento: **si vas a apoyarte en algo de acá, verificalo.**
- **El cierre no contaba las cuotas del mes, y nadie lo veía.** El campo decía "consumos
  nuevos (sin contar cuotas) — esas ya las tiene cargadas el sistema", y era falso: las
  cuotas se guardan en `card_installment_plans`, que alimenta la lista y la proyección y
  **nunca toca el saldo**. En la Visa de septiembre eran $ 2.593.755 afuera de un cierre de
  ocho millones.
- **El parser sumaba líneas en vez de leer el total que declara el banco.** Se le escapaban
  dos renglones ($ 17.666,66) y nada lo decía. Ahora manda la línea "Total Consumos" del
  resumen, igual que `saldoActualUsd` manda sobre lo que se lee línea por línea.
- **La pantalla ahora muestra el saldo con el que el resumen dice que cierra**, al lado del
  nuestro, y nombra la diferencia. El dato estaba y no se comparaba con nada.
- **Los impuestos, la cuotificacion y el saldo financiado ya se modelan** (migracion 011).
  Los seis resumenes reales cierran exacto.
- **La TEM solo se podía guardar al crear la tarjeta.** El formulario de editar deuda no la
  tiene, así que cualquier tarjeta anterior se quedaba con `tem` en null para siempre. Ahora
  la declara el resumen de cada mes, para cualquier tarjeta, y se guarda al cargarlo.
- **El cierre ignoraba la TEM** (12 de septiembre). Se guardaba en `debts.tem`, se leía en la
  acción, y no se pasaba: el saldo se escribía con la anual sobre doce. $ 3.043 por mes de
  más en la Patagonia, arrastrándose al mes siguiente. Lo fija la sección 9 del cross-check.
- **La pantalla y el servidor no partían del mismo saldo anterior.** La cuenta que se veía
  antes de guardar no era la que quedaba guardada.
- **Los errores de Postgres ya no se esconden.** La acción del resumen decía "No pudimos
  crear la tarjeta." sin el motivo, ni en pantalla ni en los logs.

---

## Lo primero: esto ya está en el aire

`llegas.vercel.app` responde 200 y es público, sirviendo lo que hay en `main`. El dominio y
la Deployment Protection se configuraron a mano en Vercel — el deploy solo NO los resolvía,
como se creía, y se comprobó midiéndolo.

**No hay nada roto en producción.** Crear cuenta funciona para la dirección de la
organización; para cualquier otra hace falta el SMTP del pendiente 2, que sigue bloqueado
por no tener dominio propio.

**Commitear y pushear van juntos** en este proyecto: `main` se despliega solo y la app se
prueba en la web, así que un commit sin pushear deja a alguien usando código viejo sin
saberlo. Verificar antes de pushear, no después.

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

**El saldo se deriva, no se guarda.** Saldo base − pagos vivos + gastos abiertos. No hay
columna de saldo que parchear al agregar o quitar un gasto. El único lugar donde se escribe
un saldo es al cargar un resumen, y lo que se escribe es el cierre del banco **antes de
restar lo pagado**: el pago se guarda como pago, no adentro del saldo.

**Un pago absorbido no resta.** El saldo anterior de un resumen ya trae adentro todo lo que
se pagó antes, así que al cargarlo esos pagos quedan absorbidos (`is_absorbed`) y dejan de
restar. No se borran: siguen en el historial. Es la Regla 3 —la que archiva los gastos que
el resumen ya trae— aplicada a los pagos.

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
npx tsx scripts/forms-check.ts    # los números que van y vuelven entre campo y modelo
```

El cross-check compara contra las cifras que el prototipo muestra en pantalla. Hoy
coinciden **al peso**: saldo total $47.133.454, 26 meses al mínimo para la Patagonia,
$3.875.621 de interés total, $2.757.627 de ahorro pagando el doble, las cuatro cifras del
préstamo puente ($800.000 a un mes al 5%) y las tres del plan destructor (plazo, interés
total y orden de cancelación).

**Ojo: el gráfico de flujo NO está verificado contra el prototipo.** Esta lista decía "los
seis valores del gráfico de flujo" y era falso — no hay ninguna sección que los compare.
Se descubrió el 11 de septiembre al ir a tocar la proyección justamente por eso.

Y hay un banco de pruebas visual, que ahora cubre **las dieciséis pantallas**:

| Ruta | Pantallas |
|---|---|
| `/dev-preview` | 01 · Dashboard |
| `/dev-preview/cashflow` | 02 · Flujo de caja |
| `/dev-preview/pantallas` | 04, 06 y 07 a 11 |
| `/dev-preview/privadas` | 03, 05, 15 y 16 — las que piden sesión |
| `/` , `/login`, `/signup`, `/recuperar` | 00 y 12 a 14, que no piden sesión |

Todas con el dataset del prototipo, sin necesitar sesión ni datos cargados. **Es la forma
más barata de ver una pantalla sin poder iniciar sesión**, y fue lo que destapó los
formularios que rompían.

`/dev-preview/privadas` se sumó tarde y por una razón concreta: mientras esas cuatro no se
podían mirar, nadie las comparaba contra el prototipo, y se notó. La 06 se quedó con el
`<input type="file">` crudo después de que se arreglara el del alta de la tarjeta, y la 16
—la única pantalla con "Cerrar sesión"— estuvo sin puerta de entrada sin que nadie lo
notara. Para que existiera, el cuerpo de las pantallas 03, 15 y 16 se separó de su página en
`DebtDetailView`, `PaymentsHistory` y `SettingsView`: la página consulta y el componente
dibuja. **Si agregás una pantalla, dejala montable sin sesión.**

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
| La geometría del calendario | El panel del prototipo abierto y medido: `bottom: 80px`, 10px de aire al costado, radio 22 en los cuatro vértices, celdas topeadas en 44px, meses en píldora. Y probado a 375, 430 y 500px de alto: el pie siempre entra |
| La barra inferior | Los cuatro ítems del prototipo, propiedad por propiedad: píldora `rgba(151,220,186,.17)`, trazo 2,1 vs 1,7, etiqueta 10px en 600 vs 400, globo durazno con anillo. Verificado en `/dev-preview`, que la renderiza sin sesión |
| El importador de resúmenes | La tarjeta del prototipo, medida: fondo, borde, radio, padding, la píldora y el nombre del archivo |

### NO verificado — acá es donde hay bugs

**Las dieciséis pantallas ya se compararon** contra el prototipo (sesión del 7 de
septiembre, a la tarde). Lo que sigue sin mirarse:

- **Borrar todos los datos** sigue sin ejercitarse con sesión, pero **se verificó contra el
  esquema real** (11 de septiembre). La acción borra los escenarios y confía en el cascade:
  se listaron las once tablas de `public` y las nueve que tienen `scenario_id` cascadean
  desde `scenarios`, la propia `scenarios` se borra directo, y `alert_settings` —la única sin
  `scenario_id`, porque la preferencia es de la persona y no del escenario— la borra la
  acción aparte. No queda nada suelto. El cascade además se ejercitó de verdad: los dos
  escenarios de prueba que se crearon para probar `copy_scenario` se borraron y no dejaron
  una fila.
- Lo que sí se ejercitó (11 de septiembre), con lo que encontró cada uno:
  - **Copiar un escenario** — corrido contra la base de verdad. Encontró un bug de plata:
    los pagos copiados perdían `statement_id`, así que volver a guardar ese resumen en la
    copia agregaba un segundo pago en vez de corregir el primero. Migración 010.
  - **El puente entrando al flujo** — cubierto por la sección 7 del `cross-check`, que
    recorre el camino entero (fila de la base → `BridgeFlow` → proyección) y no solo la
    cuenta del puente. La cuenta ya daba bien cuando el bug era que nadie leía
    `bridge_loans`, así que verificarla sola no probaba nada. Anda.
  - **Posponer una alerta** — auditado contra el prototipo, no ejercitado con sesión. La
    lógica de `snoozeUntil` es idéntica a la suya, incluido el caso raro: **si el
    vencimiento es hoy, `pre` queda en el pasado y la alerta se esconde hasta mañana**, o
    sea justo el día que importa. Es lo que hace el prototipo, así que se deja. El único
    `onConflict` del upsert está respaldado por la constraint real en la base, verificado.
- El flujo de **recuperar clave por código**, que depende de una plantilla de Supabase que
  todavía hay que tocar (ver pendientes).
- **El parseo de PDF por el camino nuevo.** Importar desde el alta de la tarjeta y que lo
  leído llegue al resumen sin volver a pedir el archivo está verificado en estructura, no
  con un PDF de verdad.

**Una columna que se lee de la base y no se usa no la agarra nada.** `saveStatement` traía
`tem` en su `select` y nunca se la pasaba a `closeStatement`: TypeScript no se queja —el
campo existe y es válido no usarlo—, el build compila, y los tres controles pasaban porque
ninguno miraba ese camino. Se descubrió leyendo el código para otra cosa. **Si una consulta
pide una columna, algo tiene que usarla; si no, o sobra en el `select` o falta en la cuenta.**
La otra mitad del mismo bug: el formulario sí usaba la TEM, pero multiplicándola por doce
para que `closeStatement` volviera a dividirla. **Un ida y vuelta así esconde que del otro
lado no se hace lo mismo** — si la función hubiera pedido la mensual desde el principio, la
diferencia se veía en la firma.

**Una función exportada de un archivo `"use client"` no se puede llamar desde un componente
de servidor, y el build NO lo agarra.** Todos los exports de un módulo `"use client"` se
vuelven referencias de cliente al importarlos desde el servidor; llamarlas tira *"Attempted
to call X() from the server"* en runtime. `npx next build` compila igual, porque las
pantallas con sesión son `force-dynamic` y no se prerenderizan, así que el error aparece
recién al abrir la página. Pasó importando `describeCalendarValue` de `CalendarField` en
`DebtDetailView`. Si hace falta una función pura en los dos lados, va en `lib/calc/` — que
es exactamente para lo que existe `lib/calc/dates.ts`, y su comentario lo dice. **Es
hermana de la regla de `"use server"`: un archivo con directiva de borde no es un módulo
común.**

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

## Lo que encontró mirar de nuevo esos controles

Los cuatro arreglos de arriba se escribieron sin volver a medir contra el prototipo, y los
cuatro salieron mal de una forma que solo se ve en pantalla. Se midió el prototipo
propiedad por propiedad y se corrigieron:

1. **El calendario quedaba debajo de la barra inferior.** Eran dos bugs encimados. El
   visible: el panel iba `bottom: 0` y la barra le tapaba el pie —los botones "Hoy" y
   "Listo"—, así que no había forma de cerrarlo tocando. El de fondo: `Screen` anima su
   opacidad al entrar, y **una animación de opacidad crea un contexto de apilado**; adentro
   de él el `z-50` del panel no competía contra el `z-20` de la barra sino contra el
   `z-index: 0` del `<main>`, y perdía. Ahora el panel va por un portal al `body` —donde su
   z-index vale de verdad— y flota a 80px del piso con 10px de aire a los lados y los cuatro
   vértices redondeados, que es como lo dibuja el prototipo.

   **Ojo con esto para lo que venga: cualquier overlay que se renderice adentro de `Screen`
   va a quedar por debajo de la barra por más z-index que le pongas.** El portal es la
   salida.

2. **Las celdas del calendario crecían con la pantalla.** Sin tope, en 430px de ancho cada
   día medía 55px y el panel entero dejaba de entrar. El prototipo las topea en 44px, que es
   también el mínimo táctil. Además los meses eran rectángulos y en el prototipo son
   píldoras. Y el panel ahora tiene la altura topeada con la grilla scrolleando adentro: el
   encabezado y el pie no se salen de pantalla por baja que sea.

3. **El importador de resúmenes mostraba el `<input type="file">` crudo.** El control nativo
   trae su propio botón, su propia tipografía y su propio idioma —"Choose File", "No file
   chosen"— y no hay CSS que lo alinee con el resto. Ahora es lo del prototipo: tarjeta
   blanca sólida (el punteado quedó solo en la fila del archivo), la píldora "Seleccionar
   archivo" y el nombre del archivo al lado. El input sigue existiendo, oculto pero
   alcanzable con el teclado.

4. **La tira del flujo cortaba el anillo del mes elegido.** `overflow-x: auto` también
   recorta en vertical, y el anillo sobresale 4px de la tarjeta: sin padding vertical en el
   scroller, el borde de arriba se comía. Cuatro píxeles arriba y abajo.

5. **La barra inferior no decía en qué sección estabas.** El único indicio era el color, y
   entre mint y blanco al 62% sobre verde oscuro, de reojo, no se lee. El prototipo marca el
   activo con tres cosas a la vez y solo estaba una: falta la **píldora mint al 17% detrás
   del ítem** —que es la que da el "presionado"— y el **ícono con trazo 2,1 en vez de 1,7**.
   De paso los cuatro íconos eran invención nuestra y ahora son los del prototipo (tarjeta,
   barras, diana, campana), y el globo de alertas es durazno con un anillo del color de la
   barra, no mint pelado.

6. **"Día 10 de cada mes" se partía en dos renglones** en el campo de media pantalla del
   onboarding. El prototipo tiene dos versiones del mismo dato —`obDayLabel` dice "Día 10" y
   `formDayLabel` dice "Día 10 de cada mes"— y acá había una sola. `CalendarField` toma
   `compact` para el campo que comparte fila.

7. **Ajustes e Historial de pagos existían y no se podía entrar.** Ni un solo `href` apuntaba
   a `/dashboard/settings` ni a `/dashboard/payments`: las dos pantallas estaban completas,
   con su "← Volver al dashboard" y todo, y eran inalcanzables. Peor: **Ajustes es la única
   que tiene "Cerrar sesión"**, así que entrar a la app era un camino de ida.

   El prototipo tiene las dos puertas en el encabezado del dashboard y no se habían
   implementado: el avatar a la izquierda del saludo (50px, pine con la inicial en mint) y
   el reloj a la derecha (44px, blanco con borde). Ahora están, medidos. De paso el saludo
   pasó a ser "Hola, ‹Nombre›" cuando la cuenta tiene nombre, como el prototipo; el saludo
   por hora quedó para la cuenta sin nombre.

   **La lección es más general que el bug: una pantalla puede estar terminada, verificada
   contra el prototipo y aun así no existir para quien usa la app.** El banco de pruebas la
   renderiza por su cuenta, así que tampoco la delata. Cuando agregues una pantalla,
   preguntate desde dónde se entra.

## Lo que encontró el primer PDF de verdad

Pasó lo que el patrón anticipaba. Apenas se cargó un resumen real en el alta de una tarjeta
apareció un bug, y al lado había otro peor que nadie estaba mirando.

**La tasa entraba mal, y en la edición entraba mal en silencio.** El importador escribía la
tasa con `String(n)` —"68.63"— y el campo se lee con `parseArgNumber`, donde el punto separa
miles: 68.63 se volvía 6863 y saltaba "esa tasa parece un error de tipeo". Molesto, pero
visible.

El de al lado no se veía. El formulario de edición prellena la tasa igual, con
`String(initial.annualRate)`. Una deuda con 83,8 de TNA se prellenaba "83.8" y al guardar
entraba **838** — que no supera el tope de 1000, así que no daba ningún error. Cada edición
de una deuda con tasa decimal la corrompía un poco más, sin un solo mensaje.

Se arregló en los dos extremos: todo número que la app escriba en un campo sale por
`formatArgNumber`, que es el inverso de `parseArgNumber`; y `parseArgNumber` toma un punto
suelto con una o dos cifras detrás como decimal, porque un grupo de miles tiene siempre tres
("1.500" sigue siendo mil quinientos). Queda como regresión en `scripts/forms-check.ts`.

**La regla que deja: un valor que la app escribe en un campo de texto y después vuelve a
leer tiene que hacer el viaje redondo.** El onboarding ya lo hacía bien con `toLocaleString`
y por eso nunca falló; los otros dos usaban `String()` y ninguna pantalla lo delataba.

## Lo que encontró buscar un pago hecho

Usando la app con datos reales, la pregunta fue "¿dónde pongo el pago que hice?". Detrás
había un bug de datos y, al lado, uno peor.

**El pago del resumen no dejaba recibo.** El campo "cuánto pagaste" se guardaba restado
adentro del saldo de cierre y no creaba ninguna fila en `debt_payments`, que es la única
tabla que lee el Historial de pagos. El pago movía el saldo y no existía en ningún lado.

**Y como el saldo se deriva restando los pagos, quien no lo veía lo registraba de nuevo a
mano y se lo descontaban dos veces, sin un solo mensaje.** Nada cruzaba las dos tablas.
`createPayment` solo tenía el único parcial contra dos mínimos en el mismo mes.

Ahora el pago del resumen es un pago como cualquier otro y `base_balance` guarda el cierre
antes de restarlo, así que el saldo derivado da idéntico. Para que eso funcione a partir
del segundo resumen hizo falta **absorber**: sin eso, el pago de un resumen seguía restando
contra el saldo del siguiente. Migración 008, ya aplicada.

`is_absorbed` es **obligatorio** en `PaymentLike` a propósito. TypeScript marcó los cinco
lugares que derivan saldo y va a marcar el sexto que alguien agregue: una consulta que se
olvide de traerlo no compila, en vez de reabrir el agujero en silencio.

De regalo salieron dos bugs que estaban al lado: **volver a guardar el mismo resumen ahora
lo corrige** en vez de cobrar el interés del mes otra vez (el saldo anterior sale de lo que
el resumen ya guardó, no de `base_balance`), y **un pago manual hecho antes de cargar el
resumen ya no descuenta para siempre**.

## El PDF se pide una sola vez

Cargar el resumen de una tarjeta nueva pedía dos pantallas: el alta leía el PDF, guardabas,
y la pantalla del resumen pedía los montos del mismo archivo.

**El prototipo tiene el bloque del PDF una sola vez, en "Agregar resumen del mes".** El
importador del alta lo habíamos agregado nosotros, y era el que partía el flujo. Así que
juntarlo no se aparta del prototipo: vuelve a él.

La lista de tarjetas del resumen tiene ahora "Es una tarjeta nueva", y con eso aparecen los
cuatro campos que pedía el alta. Los cuatro salen del PDF.

**Y eso cerró un bug de cálculo que la división escondía.** El alta pedía "saldo actual" y
lo prellenaba con `statementBalance`, que es el total con el que **cierra** el resumen;
después la pantalla del resumen lo tomaba como saldo anterior y le sumaba el interés y los
consumos encima. Es exactamente lo que el comentario de `closeStatement` viene advirtiendo
desde que se portó. El campo nuevo pide el saldo **anterior** y se prellena con
`parsed.previousBalance`, que ya venía en el parser y no lo usaba nadie.

Como el PDF se lee en un solo lugar, el traspaso por `sessionStorage` entre pantallas dejó
de tener sentido y se fue con él.

**Ojo con `statementBalance` vs `previousBalance` si alguna vez volvés a prellenar un saldo
desde un PDF.** Son dos números distintos y el error no da ningún mensaje: infla el saldo
un mes entero de interés.

## Los dólares del resumen

El resumen declara un total en dólares y la app lo dejaba afuera del saldo, con un aviso que
decía "cargalos a mano si querés que cuenten" y no decía dónde. Era plata real escondida: la
tarjeta debía más de lo que la app mostraba.

Se dejaba afuera **por una razón buena**: los dólares se pagan a la cotización del cierre y
esa cotización no está en el PDF. Convertirlos con un número puesto por nosotros sería peor
que no sumarlos, en una app cuya regla es que ninguna cifra visible se escribe a mano.

La salida fue pedirla. El bloque "Consumos en dólares" tiene el total (del PDF, prellenado) y
la cotización, con un botón que trae **la oficial (venta) de hoy** desde `dolarapi.com` y la
deja editable. Con las dos, el equivalente entra al cierre como un consumo más y el preview
lo nombra aparte. Con una sola, no entra nada.

**Es la oficial y no la "dólar tarjeta" a propósito.** La de tarjeta trae adentro las
percepciones e impuestos, y el resumen ya te los cobra aparte como líneas en pesos:
convertir con ella los contaría dos veces.

### El doble conteo del mes siguiente

Los dólares que no pagás los convierte el banco y **los unifica con los pesos en el resumen
siguiente**. Como acá ya entraron al saldo en pesos, cargarlos otra vez en "consumos nuevos"
los sumaría dos veces.

La app no lo puede detectar sola: no lee el saldo anterior del PDF, usa el nuestro. Pero sí
sabe que el resumen anterior de esa tarjeta convirtió dólares, y avisa. **El aviso va arriba
de "consumos nuevos", no al guardar** —a diferencia del de gastos— porque es un consejo
sobre *qué* escribir: uno que aparece al apretar guardar llega cuando el número ya está
puesto.

## Los `<select>` que el prototipo no tiene

El prototipo **no tiene un solo `<select>` en ninguna pantalla**: cada elección es un grupo
de opciones a la vista. No es gusto — el control nativo abre la rueda del sistema operativo,
con su tipografía y su idioma, igual que el `<input type="file">` que se sacó antes.

`ChoiceGroup` es el reemplazo, con las tres formas del prototipo. La que decide no es el
campo sino **el largo de la etiqueta**: `row` para tres opciones de una o dos palabras,
`grid` para cuatro medianas en dos columnas, `stack` para etiquetas largas a todo el ancho.
Adentro son `<input type="radio">` de verdad, así que las flechas, el foco y el envío los
maneja el navegador.

Convertidos: tipo de deuda (`stack`, seis opciones), cada cuánto entra un ingreso (`row`, con
la ayuda que cambia según lo elegido, como el prototipo) y qué tipo de pago (`stack`, porque
nuestras etiquetas son frases y las del prototipo son de dos palabras).

**Ya no queda ninguno: la app tiene cero `<select>`.** Los últimos cuatro eran los que
eligen de una lista que crece —a qué deuda va un pago, con qué tarjeta se paga un gasto, a
qué tarjeta corresponde un resumen y de qué escenario copiar— y la duda era qué hacer con
alguien que tenga veinte deudas. La contestó el prototipo, que tiene las dos formas y las
usa según el largo del nombre: **lista apilada de píldoras a todo el ancho** para las
tarjetas (nombres largos) y **dos columnas con recorte** para los escenarios (nombres
cortos, y encima escritos por la persona). Con veinte deudas la lista se hace larga y la
pantalla scrollea, que sigue siendo mejor que la rueda del sistema operativo.

`ChoiceGroup` tiene entonces cuatro formas, y la que decide no es el campo sino el largo de
la etiqueta: `row`, `grid`, `stack` (taxonomía cerrada, radio 12, elegido en mint) y `list`
(datos, píldora a todo el ancho, elegido en pine).

## El barrido de las dieciséis pantallas

Con el banco de pruebas completo se comparó pantalla por pantalla contra el prototipo
renderizado. **El texto ya coincidía en las dieciséis** —eso se había comparado en la sesión
del 7— así que lo que apareció fue estructura y copia de detalle:

Arreglado: la 04 rotulaba "Tipo" donde el prototipo dice "Tipo de deuda" y "Día de
vencimiento" donde dice "Día de vencimiento (1–31)", y su ayuda del nombre era otra; la 05
tenía dos ayudas reescritas; la 15 no tenía el subtítulo "Todo lo que registraste, de todas
tus deudas, ordenado por mes."; y las tasas se mostraban con un decimal donde el prototipo
usa dos.

Coinciden sin tocar: 01, 02, 03, 06, 07, 08, 09, 10 y 11.

### Lo que el barrido dejó sin resolver — ya resuelto

Las seis se hicieron. Quedan acá con su razón, porque tres tocaron el modelo:

1. **MONTO ORIGINAL y ESTADO** son columnas nuevas (migración 007, aplicada). Ninguna se
   deriva, que es lo que las hace legítimas en una app donde ninguna cifra visible se
   escribe a mano: `original_amount` es lo que se debía al empezar, y el modelo solo conoce
   los pagos hechos desde que la app existe; `status` es la mora, que es un hecho del banco.
   Las dos hacen algo: el monto original corrige el porcentaje saldado de una deuda anterior
   a la app, y la mora declarada pinta la tarjeta de brick y encabeza el globo del detalle.
   `copy_scenario` las arrastra — la migración se generó desde `schema.sql` en vez de
   escribirla a mano, porque copiar una función de ochenta líneas de memoria es cómo se
   pierde una tabla.
2. **El rótulo de la tasa se copió del prototipo: "Tasa de interés punitorio anual (%)".**
   *(Matiz del 11 de septiembre: el resumen de la Patagonia dice que "la tasa de interés
   punitorio en pesos es igual a la tasa de interés de financiación", TNA 80,50% las dos.
   Así que acá cargar una no corrompe la otra. Lo de abajo sigue valiendo como principio.)*
   Queda dicho para quien venga: **el campo NO es punitorio**. Es `annual_interest_rate`, la
   nominal anual, y con eso la usa todo el motor; el propio detalle del prototipo (pantalla
   03) muestra esa misma cifra como "Tasa (TNA)". Se copió porque el prototipo manda, pero
   si alguien carga ahí una tasa punitoria de verdad, el cálculo entero se va al demonio.
   Si el rótulo se corrige alguna vez, es acá.
3. **PLAZO, CUOTAS TOTALES y YA PAGADAS salieron del formulario.** Las columnas siguen en
   la base: las únicas que las leían son las de `lib/debt-engine/`, el motor viejo que queda
   como control cruzado, y el motor vivo (`lib/calc/`) nunca las miró. Si hay que volver a
   cargarlas, el formulario es lo único que falta.
4. **La 16 quedó con tres enlaces**, como el prototipo. A los puentes se entra desde el
   flujo de caja, que es donde importan.
5. **El vacío de la 15** ofrece "Ir a mis deudas", como el prototipo.
6. **El kebab "⋯" está**, con las cuatro acciones del prototipo. La tarjeta entera sigue
   siendo un enlace: el enlace es una capa absoluta, el contenido va encima sin recibir
   punteros y el ⋯ se los devuelve solo para él — un `<button>` adentro de un `<a>` no es
   HTML válido y el toque igual navegaría. "Borrar" archiva: los pagos y resúmenes de esa
   deuda son historial real, y la ayuda debajo del botón lo dice.

### Los dos filtros de la pantalla 15

El prototipo filtra por **deuda** y por **tipo**, y el orden importa: el de deuda va primero,
así que los tipos que se ofrecen son los de esa deuda y los totales de arriba la siguen. El
de tipo no mueve los totales — filtrado por tipo, "este mes" se leería como el total del mes.

El de deuda necesita una puerta, y esa puerta es la que faltaba: en el detalle de una deuda
va **"Ver los N pagos en el historial"**, que lleva a `/dashboard/payments?deuda=<id>`. Sin
ella el chip no tenía desde dónde aparecer, y por eso el filtro entero no existía acá.

Quitar el chip resetea también el filtro de tipo, como el prototipo: los tipos que había eran
los de esa deuda y pueden no existir en el resto.

Las dos vistas se miran sin sesión en `/dev-preview/privadas`: la 15 normal y la 15 llegando
desde una deuda, con el chip puesto. La segunda existe solo para eso — el chip no aparece si
no se llega filtrando, y lo que no se puede mirar es lo que nadie compara.

### El toast

`components/Toast.tsx`. Escrito, no instalado: cada píxel de la app está atado al prototipo
y una librería traería su propio DOM, sus animaciones y su theming. Son sesenta líneas.

Medido contra el prototipo y verificado en el banco: fondo `#12211D`, radio 12, padding
`13px 16px`, sombra `0 18px 34px -12px rgba(0,0,0,.5)`, círculo de 18px en `#25835D` con el
✓, texto 13px/500, **88px del piso** en reposo y curva `cubic-bezier(.23,1,.32,1)`. Dura
2400ms y se limpia a los 2600. **Uno a la vez**: el nuevo pisa al anterior, sin cola.

Tres decisiones que conviene no deshacer:

- **Va por un portal al `body`.** Por lo mismo que el calendario: `Screen` anima su opacidad,
  eso crea un contexto de apilado, y adentro el z-index del toast perdería contra la barra.
- **Entra y sale con keyframes (`animate-toast-in` / `-out`), no con una transición.** El
  prototipo usa una transición, pero él no monta el elemento en ese momento. Una transición
  necesita un estado anterior del que salir, así que hay que pintar el toast escondido y
  moverlo en el frame siguiente — y ese baile depende de `requestAnimationFrame`. **Cuando
  rAF no corre, el toast se queda en opacidad 0 y no aparece nunca.** Se midió: invisible los
  2,6 segundos y desmontado sin haberse visto. Un keyframe corre solo al montar.
- **Lleva `data-motion`**, que es como `prefers-reduced-motion` apaga el movimiento en esta
  app. Con la transición correspondía `data-motion-move`; con keyframes, `data-motion`.

El estado vive en un store de `zustand`, que estaba en `package.json` **sin que lo usara
nadie**. Cualquier componente cliente dispara un toast con `useToast().show(...)`, sin
prop-drilling ni un provider que re-renderice el árbol.

Se usa en los dos lugares donde el prototipo lo usa: al posponer una alerta —con sus dos
mensajes, que salen del `until` que ahora devuelve `snoozeAlert`— y al archivar gastos
duplicados desde un resumen. Ese segundo cruza un redirect, así que el número viaja en la
query (`?archivados=N`) y `ArchivedExpensesToast` lo consume y limpia la URL.

**Se puede mirar sin sesión** en `/dev-preview/pantallas`, con tres botones que disparan los
mensajes reales. Sin eso, la única forma de verlo sería iniciar sesión, posponer una alerta
de verdad y llegar antes de los 2,4 segundos.

### La diferencia que se dejó a propósito

**En las subpantallas la barra marca la sección de la que cuelgan; el prototipo no marca
ninguna.** Él calcula el activo como `s.screen === screen`, así que en "editar deuda" o en
"préstamos puente" las cuatro pestañas quedan apagadas. Ahí se puede: son vistas apiladas
adentro de un marco de teléfono y no se aterriza en ellas. En la app son URLs y sí se
aterriza —el botón `+` lleva derecho a cinco de ellas—, y dejar la barra entera apagada es
contestar "en ninguna" a la pregunta de dónde estoy parado. "Deudas" se queda con todo lo
que cuelga de `/dashboard` y no es Flujo, Plan ni Alertas.

## Pendientes concretos

1. ~~**Supabase → Authentication → URL Configuration.**~~ **Hecho** (9 de septiembre):
   `https://llegas.vercel.app` está en el Site URL y `/auth/callback` en los Redirect URLs.
   Los callbacks se derivan del request, no de `NEXT_PUBLIC_APP_URL`, así que sin esto
   apuntaban al dominio nuevo y Supabase los rechazaba.
2. **El proyecto no tiene SMTP propio, y eso es más grande que la plantilla.** Son dos
   consecuencias, y la segunda es la que importa:

   - **La plantilla "Reset password" no se puede editar.** El dashboard ahora la bloquea
     detrás de SMTP propio ("Set up custom SMTP to edit templates"), así que no hay forma de
     meterle `{{ .Token }}`. El `curl` de la Management API que está más abajo quedó de una
     época en que se podía; contra el servidor de mail incorporado no cambia nada, porque
     ese servidor manda las plantillas por defecto y punto.
   - **El servidor de mail incorporado solo entrega a los miembros de la organización.**
     Está en la documentación con todas las letras: cualquier otra dirección falla con
     *Email address not authorized*. O sea que **hoy, en producción, nadie que no sea
     `okmanb@gmail.com` puede crear cuenta ni recuperar la clave** — y no por los Redirect
     URLs, que ya están, sino por esto. Es un servidor de cortesía para probar, no para
     producción, y encima con un tope de mails por hora.

   Las dos se arreglan con lo mismo: configurar SMTP propio en *Authentication → SMTP
   Settings*. Con eso el mail llega a cualquiera **y** las plantillas se desbloquean, así que
   el código de 6 dígitos que la pantalla 14 ya espera empieza a funcionar sin tocar una
   línea de la app.

   **El trabajo de elegir proveedor ya está hecho y medido; falta un dominio.** Se corrió el
   descubrimiento del Marketplace y en la categoría `messaging` hay **un solo** producto:
   Resend, con plan gratuito de $0 (los otros son $20 y $90 por mes). Y ahí aparece el
   bloqueo real: **Resend exige un dominio del que controles el DNS**, para verificar que
   podés enviar desde él. `llegas.vercel.app` no sirve, y la cuenta no tiene ningún dominio
   (`vercel domains ls` → 0).

   Cuando haya dominio, esto es todo lo que falta:

   ```bash
   # 1. Provisionar Resend. sa-east-1 es São Paulo, el más cerca de acá.
   vercel integration add resend/resend-email --plan free      -m domain=TUDOMINIO.com -m region=sa-east-1
   ```

   2. Verificar el dominio en el panel de Resend cargando los registros DNS que te da
      (SPF y DKIM) en tu registrador. Hasta que verifique no manda nada.
   3. En *Supabase → Authentication → SMTP Settings*: servidor `smtp.resend.com`, puerto
      `587`, usuario `resend`, contraseña **la API key de Resend**, y como remitente una
      dirección de ese dominio. La API key hace de contraseña SMTP: no hay una aparte.
   4. Recién ahí se desbloquean las plantillas y corre el `curl` del código de recuperación
      que está más abajo.

   El CLI de Vercel quedó instalado (59.15.0) y con sesión iniciada como `okmanb`. El
   proyecto **no** está linkeado (no hay `.vercel/`): si querés que la API key entre además
   como variable de entorno del proyecto, hay que correr `vercel link` antes.

   **Ojo con cómo falla cada uno, porque no fallan igual.** Crear cuenta muestra el error
   (`signup` redirige con `?error=`), pero recuperar la clave **falla en silencio**:
   `requestPasswordReset` devuelve `{ ok: true }` pase lo que pase, a propósito, para no
   confirmarle a nadie si un mail está registrado. Así que la pantalla dice "te mandamos un
   código" y no se mandó nada. Al depurar esto, no confíes en lo que muestra la pantalla.

   Y antes de dar por roto el alta: verificá si *Confirm email* está prendido en
   *Authentication → Sign In / Providers → Email*. Apagado, `signUp` abre sesión sin mandar
   mail y crear cuenta anda para cualquiera; el bloqueo queda solo en recuperar la clave.
3. **Usar la app con datos reales.** Esto **no** está bloqueado por lo de arriba: la cuenta
   propia sí puede crearse, porque es la dirección de la organización. Es lo que más bugs está encontrando: cada vuelta de
   "abrirla y mirar" destapó uno (el `<select>` de días, el `+` sin respuesta, la falta de
   login en la raíz, el botón de importar que rebotaba al login). Nada de lo construido se
   ejercitó todavía con un PDF de verdad ni con una sesión.
4. ~~**Activar la protección de contraseñas filtradas** en Supabase Auth.~~ **No se puede
   en este plan** (probado el 11 de septiembre): el toggle está en *Authentication → Sign In
   / Providers → Email*, pero al guardarlo el dashboard contesta *"Configuring leaked
   password protection via HaveIBeenPwned.org is available on Pro Plans and up"*. El
   proyecto está en Free. **El warning del linter de seguridad no se va a poder cerrar
   mientras el plan sea Free**, y no es por falta de configurar nada: no lo persigas.
5. ~~**Borrar los dos esquemas de backup.**~~ **Hecho** (11 de septiembre, a pedido).
   `backup_pre_reset` —33 deudas, 28 líneas de consumo, dos escenarios del esquema viejo— y
   `backup_limpieza_20260910` —6 deudas archivadas con sus 5 pagos y 4 resúmenes— se
   borraron con `drop schema ... cascade`. **No hay copia.** Se decidió cuando el modelo
   nuevo ya estaba verificado contra dos resúmenes reales del banco, que es lo que los hacía
   dejar de ser una red. Los datos vivos quedaron intactos, verificado después del borrado.
6. ~~**El motor viejo (`lib/debt-engine/`, `lib/card-statements/`)**: decidir si se borra.~~
   **Decidido el 11 de septiembre: se queda.** Es el control cruzado del `cross-check` —la
   segunda opinión sobre el motor vivo— y borrarlo nos deja sin forma de notar que el motor
   cambió. No es codigo muerto: lo corre un script en cada verificación.

**Al 11 de septiembre quedan abiertos solo dos, y ninguno se resuelve escribiendo código:**

- **El 2 (SMTP)** está bloqueado por no tener dominio propio. Hasta entonces solo
  `okmanb@gmail.com` puede crear cuenta o recuperar la clave.
- **El 3 (usarla con datos reales)** es donde sigue estando todo el valor. Lleva tres
  sesiones seguidas encontrando un bug por vuelta.

Los otros cuatro están cerrados: el 1 y el 5 hechos, el 4 imposible en el plan Free, el 6
decidido.

**Y dos decisiones de producto esperan tu criterio, no trabajo:** si vale la pena modelar el
interés sobre el saldo diario promedio —medido y descartado, ver la sección 4 de
`NOTAS-PARA-REVISAR.md`— y qué hacer con el aviso de "hasta cuándo" al posponer una alerta,
que el prototipo da con un toast y ahora existe el mecanismo para copiarlo.
El linter de seguridad de Supabase quedó con **un solo warning**, el 4: los dos de
`rls_auto_enable` se cerraron en la migración 006.

### Deudas de producto conocidas

- **Las preferencias de aviso se guardan y no mandan nada.** La pantalla lo dice, pero no hay
  backend de notificaciones. La anticipación sí cambia cómo se agrupan los vencimientos.
- ~~Editar deuda no tiene ESTADO ni MONTO ORIGINAL.~~ **Esto quedó viejo**: los dos campos
  existen desde la migración 007 y funcionan en el alta y en la edición, porque `DebtForm` es
  el mismo formulario para las dos. Verificado el 11 de septiembre: la página de edición los
  lee, los pasa y `validateDebt` los guarda. La nota sobrevivió a su propio arreglo.

---

## La alerta de la deuda mas cara: la segunda diferencia deliberada con el prototipo

Reportado el 12 de septiembre: la alerta mostraba el minimo de una tarjeta a la que ya se le
habia pagado mas que el minimo. **No era un bug** —el prototipo hace exactamente eso, su
alerta 5 es `label: 'Minimo', value: hi.min` sin mirar si se pago, aunque tiene
`minPaidThisMonth` y lo usa en la lista de deudas— asi que se propuso en vez de aplicarse, y
**se cambio a pedido**.

Ahora, cuando el minimo del mes ya esta pagado, ese renglon dice **el interes del mes** en
lugar del minimo. El razonamiento: esta alerta no reclama un pago, dice cual deuda conviene
atacar si sobra plata, asi que el numero que corresponde es lo que esa deuda cuesta por mes.
Un prestamo no cambia: su cuota fija no se paga a medias.

Lo fija la **seccion 11 del `cross-check`**, que ademas deja escrito que es una diferencia a
proposito y no un descuido.

De paso se corrigio algo que estaba al lado: las alertas derivaban la tasa mensual de la
anual dividida por doce, ignorando la TEM declarada y la efectiva. Ahora usan la misma
prioridad que el resto de la app —medida, declarada, deducida— y el interes que muestran es
el que el banco cobra.

### Los vencimientos apilados: la otra mitad, tambien arreglada

Misma sesion, mismo motivo. La alerta de vencimientos apilados contaba TODOS los
vencimientos de la ventana y sumaba todos los minimos, pagados o no, bajo el rotulo "Total a
cubrir" — o sea que podia pedir que cubrieras plata que ya habias puesto.

Ahora una deuda con el minimo del mes ya pagado **queda afuera de la pila entera**, no solo
del total: si de tres vencimientos ya pagaste uno, el titulo dice dos. Y si queda uno solo,
la alerta no sale — un vencimiento suelto no es una pila, y esa es la respuesta correcta, no
un agujero.

Lo fija la **seccion 12 del `cross-check`**, con los tres casos: ninguna pagada, una pagada,
y dos pagadas.

---

## El diseño de la puerta de entrada

`app/page.tsx` (la landing donde se prueba o se entra) **no sale del prototipo**: el
prototipo solo tiene `login`, `signup` y `recover`, asi que esa pantalla es invencion de la
app y hay margen para moverla sin romper la regla del prototipo.

El 12 de septiembre se dibujaron tres direcciones en un lienzo de Claude Design, todas
dentro del sistema (pine, teal, mint, Work Sans + Plex Mono, radios 8/12/14/pill):

- **A · El mes que no llega** — hero pine a sangre completa con la curva cruzando el cero.
- **B · La pregunta** — el nombre a 62px y la respuesta ("No. Hasta diciembre.").
- **C · El resumen** — la primera pantalla ES un resumen de cuenta.

Mas la pantalla **Ingresar** en la direccion A, que agrega algo que hoy falta: "Probar sin
cuenta". Quien cae en `/login` sin tener cuenta hoy tiene que volver atras con el navegador.

**Se eligio la B** el 12 de septiembre y **ya esta implementada**: `app/page.tsx`,
`components/AuthShell.tsx` (que lo comparten login, signup y recuperar) y `app/login/page.tsx`.

El marco de las pantallas de cuenta pasa a ser el de la landing —el nombre a tamaño de
display y la barra mint sosteniendo el titulo— para que entrar se vea como el mismo producto.
Se probo una cabecera oscura y se descarto: la app entera es clara, y una pantalla oscura
justo despues de una landing clara rompe lo unico que hace que el rojo signifique algo cuando
aparece. **Los campos no se tocaron**: son los de `AuthShell` y ya estaban bien.

`AuthProbar` es nuevo y cierra un callejon real: quien llegaba a `/login` sin cuenta —desde un
link, desde el historial— no tenia como llegar a probar que no fuera el boton de atras del
navegador.

**El mes del ejemplo se cuenta desde hoy, no esta escrito.** Decia "hasta diciembre" fijo, y
eso envejece mal en las dos direcciones: en enero, diciembre queda a once meses y la promesa
deja de ser "el mes que viene antes de que llegue"; pasado diciembre es directamente una
fecha que ya ocurrio. El quiebre cae siempre **tres meses adelante del mes corriente**, que
es la distancia a la que la pregunta todavia se puede contestar y ya preocupa. La pagina es
`force-dynamic`, asi que se recalcula en cada visita.

`MONTHS_SHORT` se mudo de adentro de `CashflowBoard` a `lib/calc/dates.ts` como
`formatPeriodShort`: lo necesitan dos graficos distintos, y dos tablas de abreviaturas
separadas terminan divergiendo — una en mayuscula y otra en minuscula, que es justo lo que
habia pasado.

### Todo boton de accion mide 52, y antes ninguno media lo mismo

Pedido el 12 de septiembre mirando la landing: el boton se veia fino y no parecia de la misma
altura que el de al lado. **No lo era.** El secundario tiene borde de 1px y el primario no,
asi que con `box-sizing: border-box` y una altura minima el secundario terminaba en 46 y el
primario en 44 — **en todo par de la app**, no solo ahi. Dos pixeles no se notan mirando un
boton; se notan mirando dos, uno encima del otro. Arreglado en `BUTTON_BASE`: el ancho del
borde va en la base y el color en cada variante.

Y la altura pasa de 44 a **52**. Los 44 de `min-h-touch` son el minimo accesible, no una
medida comoda: en el telefono un boton de 44 se toca con cuidado. `BUTTON_HEIGHT` en
`components/ui.tsx` es ahora el unico lugar donde vive ese numero.

**El de contorno va un pixel mas bajo, y no es un descuido.** Con la misma altura exacta —52
los dos, medido en el navegador— el claro se ve mas alto que el relleno. Es irradiacion: una
figura clara sobre fondo claro se agranda a la vista y una oscura se contrae, el mismo motivo
por el que un circulo hay que dibujarlo mas grande que un cuadrado para que se vean iguales.
Asi que la regla sigue siendo 52 y el contorno lleva **−1 de correccion optica** para LEERSE
igual. `BUTTON_HEIGHT` y `BUTTON_HEIGHT_OUTLINED` en `components/ui.tsx`. **Si alguien
"arregla" esto igualando los numeros, los botones vuelven a verse disparejos.**

Se subieron **38 botones** escritos a mano en 24 archivos. **Lo que se dejo en 44 a
proposito**: la barra inferior, las celdas del calendario, la tira de meses del flujo, las
pildoras de filtro del historial, los selectores segmentados (tipo de pago, estrategia,
anticipacion) y los toasts. No son botones: van en fila, no son la accion de la pantalla, y
44 ya es suficiente para el dedo.

Tres cosas se arreglaron **mirandolas en el navegador**, no leyendo el codigo: el separador
`o` de `AuthProbar` se leia como un cero (la O mayuscula en una mono de cifras tabulares), el
rotulo "ejemplo" de la tarjeta de la respuesta estaba en un gris de borde y no se leia —y un
aviso de honestidad que no se lee no avisa—, y los numeros 01/02/03 eran practicamente
invisibles sobre el fondo de la app.

### El icono ya existe, y sale de la fuente de la app

`app/icon.svg` y `app/apple-icon.tsx` (PNG de 180 generado con `next/og`, porque
`apple-touch-icon` no acepta SVG). Next emite los dos `<link>` solo, verificado en el
navegador.

**La forma NO esta dibujada a mano.** El primer intento fue un `<path>` hecho a ojo y se leia
como un gancho de pescar; corregirlo a ojo era empujar numeros sin saber contra que. La forma
correcta ya estaba en el proyecto: es el glifo `questiondown` de **Work Sans**, la fuente de
la app, que `next/font` deja como .woff2 en `.next/`. `scripts/generar-icono.py` lo saca de
ahi y lo aplana a una caja de 100, asi el icono es literalmente la misma letra que el titulo
de la landing.

Es el mismo criterio que el resto del proyecto: **donde hay una fuente real, no se dibuja de
memoria.** Para regenerarlo hace falta `pip install fonttools brotli` y que `.next/` tenga
las fuentes.

**El path esta duplicado** en el `.svg` y en el `.tsx` a proposito: no se puede importar un
SVG dentro de un `ImageResponse`, y dos copias de una forma que no cambia son mejores que un
paso de build que nadie recuerda. El script escribe las dos.

---

## Migraciones aplicadas en la base

Las de estas sesiones ya corrieron sobre el proyecto `udhqdbpjhifeotgoqaoa` y están en el
repo como `supabase/migration_003_*.sql` a `_015_*.sql`. `supabase/schema.sql` quedó al día.

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
- `debt_payments`: se sumaron `statement_id`, `is_absorbed` y `absorbed_by_statement_id`
  (migración 008), con un único parcial por `statement_id` —un pago por resumen— y un
  índice de los vivos. `copy_scenario` copia `is_absorbed` y **no** las dos referencias a
  resúmenes, por lo mismo que ya hacía con `expenses.is_archived`: el flag es lo que decide
  si el pago resta, y los ids apuntan a resúmenes del escenario viejo.
- `card_statements`: se sumaron `usd_balance` y `usd_rate` (migración 009). Se guardan las
  dos y no solo el resultado: el peso equivalente ya quedó adentro del cierre, así que sin
  la cotización no habría forma de explicar de dónde salió.
- `card_installment_plans`: el índice único de `(debt_id, cupon)` dejó de ser parcial
  (migración 012). Era `where cupon is not null` y por eso el upsert de cuotas fallaba
  siempre, en silencio. Un índice parcial no sirve de árbitro para el `on conflict` que
  emite PostgREST. **No volver a ponerle el WHERE**: lo que protegía —que dos cuotas sin
  cupón no sean la misma— lo hace igual el índice completo, porque en un índice único dos
  NULL son distintos.
- `pg_cron` y `public.borrar_cuentas_de_prueba()` (migración 013): borra las cuentas
  anónimas de más de 24 horas, una vez por hora. El `cron.schedule` **no** está en
  `schema.sql` —inserta una fila, no define un objeto, y correrlo de nuevo lo duplica—; el
  que manda es el de la migración.
- `public.borrar_mi_cuenta()` (migración 015): la usa Ajustes para darse de baja. Security
  definer, sin argumentos, borra solo `auth.uid()`.
- `debts.archived_at`, el trigger `debts_marcar_archivada` y
  `public.borrar_tarjetas_archivadas()` (migración 014): la papelera de tarjetas, que se
  vacía sola a los 7 días. El `cron.schedule` tampoco está en `schema.sql`, por lo mismo.
- Se le revocó el `EXECUTE` público a `rls_auto_enable()` (migración 006). Es un objeto de
  la plataforma, no nuestro, así que no está en `schema.sql`. Verificado que el guardarraíl
  sigue funcionando: una tabla creada después del revoke sigue quedando con RLS activa.

### La plantilla del código de recuperación

**Esto no corre hasta que el proyecto tenga SMTP propio** (pendiente 2). Sin él la plantilla
está bloqueada en el dashboard y el servidor incorporado manda la de fábrica igual, así que
el `curl` no cambia lo que llega al buzón. Guardado para cuando el SMTP esté.

Va en *Authentication → Email Templates → Reset password*, o por la Management API con un
token de https://supabase.com/dashboard/account/tokens:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/udhqdbpjhifeotgoqaoa/config/auth"   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"   -H "Content-Type: application/json"   -d '{"mailer_subjects_recovery":"Tu código para volver a entrar",
       "mailer_templates_recovery_content":"<h2>Tu código</h2><p>Escribí este código en ¿Llegás? para poner una clave nueva:</p><p style=\"font-size:28px;letter-spacing:6px\"><b>{{ .Token }}</b></p><p>Vence en unos minutos. Si no lo pediste, ignorá este mail.</p>"}'
```

## Los seis resumenes reales, reconstruidos, y el modelo que los reproduce

Se reconstruyó la Visa BBVA de septiembre línea por línea y **cierra exacto en
$ 8.089.852,43**. La cuenta completa:

| | |
|---|---|
| Saldo anterior | 5.710.670,92 |
| Dos pagos | −1.798.839,63 |
| Transferencia de la deuda en dólares (US$ 158,14 × 1525) | +241.163,50 |
| Consumos, los tres totales por titular, **cuotas incluidas** | +3.350.089,59 |
| IVA de los Plan V | +224.781,13 |
| Intereses de financiación | +242.071,81 |
| IVA 21%, IIBB CABA, IVA RG 4240, DB RG 5617 | +120.915,11 |
| **Saldo actual** | **8.089.852,43** |

**Los tres se arreglaron** (12 de septiembre). Los seis PDF que hay, de dos bancos, cierran
**exacto** con una sola estructura:

```
cierre = anterior - pagos - creditos + transferencia de dolares
         + consumos + intereses + impuestos y otros cargos
```

1. ~~Las cuotas del mes no entraban al saldo.~~ El campo de consumos se llena con el total
   que declara el resumen, que ya las incluye.
2. ~~El interes se calculaba sobre el saldo entero.~~ **Manda el que declara el PDF.** El
   banco cobra sobre la parte financiada, que ningun resumen publica: deducirlo con la TEM
   daba $ 322.139 contra los $ 242.072 que cobro. La proyeccion usa la **tasa efectiva
   medida** —intereses cobrados sobre saldo anterior— en vez de la TEM nominal.
3. ~~Los impuestos no se modelaban.~~ Entran como "impuestos y otros cargos", **por
   diferencia contra el propio saldo de cierre del resumen**, no sumando renglones: la
   extraccion por coordenadas parte esas lineas y sumarlas mal mete un error que nada
   detecta. Por diferencia, el total cierra siempre contra el numero que el banco publica.

Y aparecieron dos cosas que nadie habia visto:

- **La cuotificacion.** La Mastercard de septiembre trae `CR.$ CUOTIFICACION -2.952.659,25`:
  el banco saca el saldo de la tarjeta y lo pasa a cuotas fijas. Sin leerla el cierre daba
  tres millones de mas. Ese resumen ademas **no cobra un peso de interes**, asi que un
  interes declarado en cero es un dato, no la ausencia de uno: dejarlo vacio hacia que la
  app estimara $ 234.210 que nadie cobro.
- **El punitorio del prototipo se sumaba encima de lo que el banco ya habia cobrado.** Es una
  estimacion —3% sobre lo que falto para el minimo— y con un resumen delante sobra: eran
  $ 84.478 de mas en la Visa y $ 10.965 en la Patagonia. Ahora solo se estima cuando no hay
  intereses declarados.

**La seccion 10 del `cross-check` reproduce los tres resumenes de septiembre** con las cifras
de esos PDF, asi que no hace falta el PDF para notar que el motor se movio.

### Lo que sigue sin ser exacto, y esta a la vista

El desglose puede quedar desdibujado aunque el total cierre: si el PDF trae una linea de
intereses que no pudimos leer, esos pesos caen en "otros cargos". Paso de verdad —en la
Mastercard de agosto el importe quedo un renglon antes que su texto— y se arreglo mirando la
linea anterior. **El total siempre cierra; lo que puede moverse es el reparto.**

La pantalla muestra el cierre del banco al lado del nuestro y nombra la diferencia.

---

## Diferencias de cálculo que hay que conocer

El motor portado del prototipo y el viejo **coinciden en la amortización** pero **difieren
en el cierre de resumen**, por dos razones independientes: el prototipo cobra interés
sobre el saldo antes de restar el pago, y aplica un punitorio del 3% que el viejo no
modela. Sobre la Visa son **$106.199 por mes**.

Gana el prototipo, por instrucción del brief. Está todo medido en `NOTAS-PARA-REVISAR.md`,
que es el documento que hay que leer antes de tocar cualquier cosa del cálculo.

**Y hay una tercera diferencia, medida el 11 de septiembre contra dos resúmenes reales: el
interés del motor no coincide con el del banco, y falla para los dos lados** —$37.913 de
menos en agosto, $23.124 de más en septiembre—. Que el signo cambie descarta que sea la tasa:
el banco cobra sobre el saldo diario promedio y nosotros sobre el de apertura. Es la primera
vez que el motor se mide contra la aritmética de un banco y no contra el prototipo. Sección 4
de `NOTAS-PARA-REVISAR.md`.

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
