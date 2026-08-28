# Brief para Claude Code — Mini App Factory: migración del modelo de deudas

Pegá esto como primer mensaje en Claude Code, dentro de la carpeta del proyecto.

---

## Contexto

Tengo una app (Next.js, corriendo local en `localhost:3000`) con un dashboard de deudas,
una vista de flujo de caja ("Con qué te enfrentás") y un importador de PDF de resúmenes
bancarios. Es un prototipo funcional pero quedó a mitad de camino. Quiero que lo revisemos
juntos y lo migremos, **sin reescribir todo de cero** — el shell, la navegación y el diseño
visual (fondo crema, headers serif, el gráfico waterfall verde/rojo) están bien y se
mantienen.

## Los 3 problemas concretos a resolver, en este orden

### 1. El modelo de datos trata todo pago como cuota fija

Hoy cada deuda tiene un solo número de cuota que se repite igual todos los meses. Eso está
mal para casos reales: una tarjeta en mora que se paga "lo que sobre" cada mes, o una tarjeta
donde se paga el mínimo (que crece con la fórmula real del banco) más un margen. Necesito que
una deuda pueda tener, mes a mes, uno de estos tipos de pago:
- `cuota_fija`: conocida de antemano, baja sola (sistema francés)
- `pago_variable`: el usuario carga el monto real cada mes
- `minimo_estimado`: la app calcula un mínimo con una fórmula configurable por deuda y el
  usuario define cuánto margen paga por encima

Te adjunto **`02-schema.sql`** con el modelo de datos completo ya pensado para esto
(tablas `debts`, `debt_schedule_entries`, `scenarios`, `bridge_loans`, `cash_flow_months`,
`alerts`, con RLS). Usalo como base — revisá qué de lo que ya existe en el proyecto se puede
adaptar en vez de tirar.

También quiero soporte para **escenarios** (plan base vs. plan de contingencia) corriendo en
paralelo sin pisarse, y **préstamos puente** encadenados (tomo uno para devolver el anterior).

Te adjunto también **`01-SPEC.md`** con el detalle completo de por qué cada pieza del modelo
es así — viene de una sesión real reconstruyendo mi situación financiera a mano en Excel, no
es una spec genérica. Especial atención a la sección 4 ("Reglas de integridad") — son bugs
reales que cometí a mano hoy y no quiero que la app los repita (sobre todo el de no duplicar
el mes actual entre saldo real y saldo proyectado).

### 2. El importador de PDF da números mal

Cargué el resumen de mi tarjeta Visa y la app me quedó mostrando un saldo de $33.474.578,
cuando el resumen real dice otra cosa bastante menor. Necesito que revisemos juntos el parser
del PDF — sospecho que está sumando algo que no debería (capaz movimientos en vez de tomar el
saldo actual del resumen), pero hay que confirmarlo mirando el código.

### 3. Faltan gastos fijos y el desglose de ingresos

Hoy la app solo tiene 2 gastos fijos cargados ($260K + $380K) y el sueldo como una sola línea.
En la realidad tengo más gastos fijos (colegio, súper, una cuota a mi hija mayor) y el sueldo
se cobra en dos partes (sueldo + adelanto, con montos que pueden cambiar de un mes a otro).
Esto es más carga de datos que cambio de modelo, pero confirmemos que el modelo de arriba lo
soporta bien antes de cargar todo de nuevo.

## Cómo quiero trabajar esto

1. Primero mostrame qué tan lejos está el modelo de datos actual del propuesto en
   `02-schema.sql` — cuáles tablas/columnas se pueden migrar y cuáles hay que crear de cero.
2. Después el importador de PDF, como bug aislado.
3. Recién ahí recargamos los datos reales.

No arranques a escribir migraciones todavía — primero quiero ver el plan.

---

**Archivos adjuntos a este brief:** `01-SPEC.md`, `02-schema.sql` (ya los tenés descargados
de la conversación anterior).
