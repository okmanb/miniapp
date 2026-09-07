# Simuladeudas

Mirá el mes que viene antes de que llegue. No promete salir de deuda rápido: muestra en
qué mes te quedás sin plata, por qué crece cada saldo, y qué cambia si pagás distinto.

## Arrancar

```bash
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev
```

Node 20 o superior. En esta máquina Node vive en `C:\Program Files\nodejs` y no está en el
PATH: hay que anteponerlo.

El puerto **3000 no es intercambiable** mientras se pruebe el registro por mail. Los links
de confirmación de Supabase vuelven al origen desde el que se pidieron, y la lista de
Redirect URLs del proyecto de Supabase tiene que incluirlo.

## Cómo está armado

| | |
|---|---|
| `app/` | Pantallas. La raíz es el onboarding; todo lo privado cuelga de `/dashboard`. |
| `lib/calc/` | El motor. Módulos puros, sin base de datos ni React. |
| `lib/data/` | Lecturas para las pantallas. Derivan; no guardan. |
| `lib/statement-parser/` | Lectura de resúmenes en PDF, un parser por banco. |
| `supabase/schema.sql` | El esquema, con las políticas por fila junto a cada tabla. |
| `handoff/` | El prototipo aprobado y sus documentos. Fuente de verdad del diseño. |

## Las dos reglas que sostienen todo

**Ninguna cifra visible está escrita a mano.** Todo se recalcula desde las deudas y el
escenario activo. Si una pantalla necesita un número que el modelo no puede derivar, el
problema es el modelo.

**El saldo se deriva, no se guarda.** Saldo base, menos los pagos, más los gastos abiertos.
No hay columna de saldo que parchear al agregar o quitar un gasto — si hiciera falta
revertir un parche, el modelo estaría mal. El único lugar donde se escribe un saldo es al
cargar un resumen, y lo que se escribe es el total que dice el banco.

El resto de las reglas está en `handoff/PRODUCT-RULES.md`.

## Verificar que el motor sigue dando bien

```bash
npx tsx scripts/cross-check.ts    # el motor contra el prototipo y contra el motor viejo
npx tsx scripts/parser-check.ts   # las regex de los resúmenes, con sus regresiones
```

El cross-check compara contra las cifras que muestra el prototipo para las mismas deudas.
Si alguna deja de coincidir, cambió el motor y hay que entender por qué antes de seguir.

## Lo que hay que saber antes de tocar algo

`NOTAS-PARA-REVISAR.md` tiene las diferencias entre los dos motores de cálculo, lo que el
prototipo no definía y hubo que decidir, y lo que quedó pendiente. Se lee antes de cambiar
cualquier cosa del cálculo.
