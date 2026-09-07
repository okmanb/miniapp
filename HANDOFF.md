# Dónde quedó esto — para retomar

Fecha: 7 de septiembre de 2026. Escrito al cerrar una sesión larga, para que la siguiente
no tenga que reconstruir el contexto.

---

## Lo primero: nada de esto está desplegado

```
main   →  bd19b15   el boilerplate viejo + handoff/     ← esto es lo que sirve Vercel
reset  →  28 commits por delante                        ← esto es la aplicación
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
Se sirve en `localhost:8099` con un script en el scratchpad de la sesión; si esa sesión no
existe más, hay que levantar cualquier servidor estático sobre `handoff/`.

---

## Cómo verificar que el motor sigue bien

```bash
npx tsx scripts/cross-check.ts    # el motor contra el prototipo y contra el motor viejo
npx tsx scripts/parser-check.ts   # las regex de los resúmenes, con sus regresiones
```

El cross-check compara contra las cifras que el prototipo muestra en pantalla. Hoy
coinciden **al peso**: saldo total $47.133.454, 26 meses al mínimo para la Patagonia,
$3.875.621 de interés total, $2.757.627 de ahorro pagando el doble, y los seis valores del
gráfico de flujo.

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

### NO verificado — acá es donde hay bugs

**Las pantallas 07 a 16** (escenarios, plan, alertas, puentes, resumen, historial, ajustes,
cuenta) están construidas y compilan, pero **nunca se pusieron al lado del prototipo**. Se
escribieron razonando desde `SCREENS.md`.

Eso importa porque, en las que sí se compararon, aparecieron invenciones: el botón `+` era
un círculo plano cuando el prototipo tiene uno de 58px con anillo; la pantalla 00 era una
landing de marketing que no existe en el prototipo; el orden de los botones del paso 3
estaba invertido. **El patrón de toda la sesión fue ese**: donde se comparó contra algo
real apareció un bug; donde se razonó sin dato, se inventó.

Si la próxima sesión hace una sola cosa, que sea esa comparación.

---

## Pendientes concretos

1. **Mergear `reset` a `main`** (o apuntar Vercel a `reset`). Nada se ve hasta que pase.
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
6. **Borrar el esquema `backup_pre_reset`** cuando el modelo nuevo esté verificado. Tiene
   el snapshot de los datos viejos (33 deudas, 28 consumos) y es la única copia.
7. **El motor viejo (`lib/debt-engine/`, `lib/card-statements/`)** sigue en el repo como
   control cruzado. Decidir si se borra.

---

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
