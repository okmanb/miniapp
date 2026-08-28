# Simulador de Deudas y Flujo de Caja — Spec de producto

> Este spec no sale de una lista genérica de features. Sale de una sesión real de 4+ horas
> reconstruyendo a mano, en Excel, la situación financiera de un usuario con 8 deudas activas
> en 4 entidades distintas. Cada sección de acá abajo corresponde a algo que tuvimos que
> resolver manualmente y que la app debería resolver sola.

## 0. La tesis del producto

La mayoría de la gente que está en aprietos financieros no tiene un problema de "no sé sumar" —
tiene un problema de **mantener el estado actualizado**. Cada vez que aparece un dato nuevo
(un resumen, un mensaje del banco, una decisión que tomás vos), TODO lo demás — el flujo de
caja, las alertas, las proyecciones — tiene que recalcularse en cascada, y a mano eso se
pierde o se hace mal. El producto no es "una calculadora de deudas". Es **un estado que se
mantiene consistente automáticamente a medida que la vida real cambia**, con trazabilidad de
qué es dato real y qué es estimado.

## 1. Entidades centrales (lo que hoy vive en las hojas del excel)

### Deuda (`Debt`)
Cualquier cosa que se deba: tarjeta de crédito, préstamo personal, plan de cuotas, deuda
informal con un familiar.
- Nombre, entidad (BBVA, Patagonia, MercadoPago, "mi esposa"...), tipo (tarjeta/préstamo/plan/informal)
- Saldo actual, tasa (TNA/TEA/CFT — guardar las que se tengan, no forzar todas)
- **Estado**: al_dia | mora | refinanciado | cancelado | regularizado
- Próximo vencimiento
- Fuente del dato: qué captura/mensaje generó este número, y cuándo se cargó (todo dato viejo
  debería poder marcarse "puede estar desactualizado" automáticamente si pasó mucho tiempo)

### Ítem de cronograma (`DebtScheduleEntry`)
Lo que se paga *ese mes* por una deuda puntual — no siempre es un número fijo:
- **Cuota fija** (préstamo personal, sistema francés): baja mes a mes, conocida de antemano
- **Pago variable** ("lo que sobre", "según pueda"): el usuario decide mes a mes
- **Mínimo estimado + margen**: la app calcula el mínimo con una fórmula (ver §3) y el usuario
  define cuánto margen quiere pagar por encima
- Cada entry tiene `is_estimate: boolean` — esto es CRÍTICO. Hoy en el excel usamos color
  amarillo para "estimado, confirmar" vs. azul para "dato duro de la fuente". La UI necesita
  el mismo distingo visual siempre.

### Ingreso (`Income`)
Sueldo, adelanto, bono, aguinaldo, changas. Con soporte explícito para que el *split* entre
sueldo y adelanto cambie de un mes a otro (nos pasó hoy: adelanto subió de $2M a $2,5M y el
sueldo mostrado bajó de $3,4M a $3M, sin que cambiara el total real). No asumir que "sueldo"
es un monto fijo para siempre.

### Gasto fijo (`FixedExpense`)
Recurrente, no asociado a una deuda: colegio, súper, doctores, cuota a un hijo. Con soporte
para:
- Atrasos que se parten en varios meses (nos pasó con la cuota de un hijo: $404K atrasados
  se partieron en $202K + $202K)
- Gastos que "se mudan" de una tarjeta deshabilitada a otra (colegio pasó de la Visa a
  pagarse directo con sueldo)

### Préstamo puente (`BridgeLoan`)
Un préstamo corto tomado para tapar un mes específico, con devolución programada — a veces
encadenado (tomás uno para devolver el anterior). Necesita: monto, mes de recepción, mes de
devolución, tasa estimada, y si ya se devolvió.

### Escenario (`Scenario`)
El mismo set de deudas e ingresos, pero con decisiones distintas aplicadas (ej.: "plan base"
vs. "plan de contingencia con Visa en $0 y dos préstamos puente"). El usuario necesita poder
comparar 2-3 escenarios lado a lado sin perder ninguno.

### Snapshot mensual (`CashFlowMonth`)
El resultado calculado, no cargado a mano: ingresos totales, egresos totales, resultado neto,
saldo acumulado. **Regla de oro que rompimos y tuvimos que arreglar hoy**: el mes actual/más
reciente NO se le suma el resultado proyectado si el saldo inicial ya lo incluye (evitar
doble conteo real vs. proyectado — ver §4).

### Alerta (`Alert`)
Ver §5.

## 2. Pantallas

### 2.1 Dashboard (home)
- **Ribbon de salud financiera**: una fila horizontal, un punto por mes, verde/ámbar/rojo
  según el saldo acumulado proyectado ese mes. Es lo primero que se mira — responde "¿en qué
  mes me quedo sin plata?" de un vistazo. (Este fue, en la práctica, el gráfico que más
  volvimos a mirar en toda la sesión.)
- Tarjetas de deuda, agrupadas por estado (al día / en mora / creciendo sin control), no por
  entidad — lo que importa es la urgencia, no el banco.
- Resumen de "lo que hay que confirmar" — cualquier `is_estimate: true` sin resolver, listado
  arriba de todo, no escondido en un detalle.

### 2.2 Deudas (lista + detalle)
- Lista con estado, saldo, tasa, próximo vencimiento.
- Detalle de una deuda: cronograma mes a mes (tabla), y si la tasa es alta y el pago no cubre
  el 100% del interés, un aviso explícito tipo "a este ritmo el saldo NO baja" con la
  proyección (ver §3 — este cálculo se repitió 4 veces hoy a mano).

### 2.3 Flujo de caja
- Tabla mes a mes (igual estructura que la hoja Flujo_Caja_Mensual): ingresos, cada deuda
  como fila de egreso, gastos fijos, total, resultado neto, saldo acumulado.
- Selector de escenario arriba — cambiar de "plan base" a "plan de contingencia" sin perder
  ninguno de los dos.
- Botón "simular ajuste": pausar una deuda flexible X meses, tomar un préstamo puente, correr
  el pago de algo un mes — y ver el impacto en la tabla completa al toque, no recalculando a mano.

### 2.4 Gastos por tarjeta (breakdown)
- Cuando una tarjeta es la única que queda operativa (nos pasó con Patagonia), la app debería
  poder tomar el detalle de consumos de un período y categorizarlo (fijo/necesario vs.
  discrecional), mostrando cuánto se puede recortar realmente — no asumir que "recortar
  gastos" siempre alcanza (en nuestro caso, no alcanzaba ni recortando el 100%).

### 2.5 Alertas
Lista simple, ordenada por severidad. Ver §5 para los tipos.

## 3. Cálculos que la app tiene que poder hacer sola

Estas son las cuentas que hicimos a mano, repetidamente, durante la sesión. Automatizarlas es
el valor central del producto.

**a) Proyección de saldo con interés compuesto + consumo nuevo:**
```
saldo_mes_siguiente = saldo + (saldo × TEM) + consumo_nuevo_estimado − pago_del_mes
```
Con el pago pudiendo ser fijo, variable, o "mínimo + margen" (ver b).

**b) Estimación de pago mínimo (fórmula real de tarjetas argentinas, cuando el usuario la
carga desde la letra chica de su resumen):**
```
mínimo = (100% × intereses_y_cargos_del_período)
       + (10% × consumos_en_1_pago)
       + (10% × saldo_financiado)
       + (25% × compras_en_2_a_6_cuotas)
       + (50% × compras_en_7+_cuotas)
       + (100% × adelantos_en_efectivo)
       + (100% × mínimo_anterior_impago)
       + (100% × exceso_sobre_límite)
```
No todas las tarjetas van a dar la fórmula exacta — soportar carga manual de la fórmula por
tarjeta, con la de arriba como default razonable.

**c) Punto de equilibrio (breakeven):** cuánto hay que pagar por mes para que el saldo de una
deuda deje de crecer = interés del período + consumo nuevo estimado. Mostrarlo siempre al
lado de la proyección — es lo que más ayuda a entender "por qué pagar el mínimo no alcanza".

**d) Comparación de escenarios de pago:** dado un saldo y una tasa, tabla de "si pagás $X/mes,
te lleva Y meses cancelarla" para 3-4 montos distintos. Esto lo recalculamos a mano 3 veces
hoy con montos distintos.

## 4. Reglas de integridad (los bugs que cometimos hoy, para no repetirlos)

1. **No duplicar el mes actual.** Si el saldo inicial de un período ya refleja el resultado
   real de ese período (porque ya pasó), no sumarle además el resultado *proyectado* del
   mismo período. Regla operativa: cualquier mes con fecha ≤ hoy usa el saldo real cargado
   manualmente; cualquier mes > hoy usa la proyección encadenada desde el último real.
2. **No pagar dos veces la misma deuda en dos filas distintas.** Cuando se consolida un pago
   variable con un "consumo nuevo a financiar" de la misma deuda, verificar que no sean el
   mismo monto contado dos veces (nos pasó con la Visa).
3. **Todo ajuste a un ingreso/gasto que "sube de acá en más" tiene que aplicarse desde el mes
   correspondiente en adelante, no reescribir el histórico** (el aumento de sueldo entró desde
   Sep-26, no retroactivo a Ago-26).
4. **Cuando el usuario dice "esto es tal", no "por ahí es tal"**: los valores confirmados por
   el usuario se marcan como dato duro (no estimado) inmediatamente, aunque antes hayan sido
   una estimación de la app.

## 5. Alertas — tipos concretos (no genéricos)

| Tipo | Dispara cuando | Ejemplo real de hoy |
|---|---|---|
| `saldo_creciente` | Una deuda con pago fijo no cubre 100% del interés | Patagonia con pago fijo $310K |
| `doble_conteo` | Dos filas del flujo de caja podrían representar el mismo pago | Fila "consumos nuevos Visa" duplicando la fila "pago variable Visa" |
| `mes_no_reflejado` | El saldo inicial cargado no coincide con lo que el flujo proyectaba para ese mes | Diferencia entre $2,7M proyectado y $51K real en la caja de ahorro |
| `gasto_no_capturado` | El usuario menciona un pago recurrente que no está en ninguna fila | Cuota de $500K a la hija mayor, "perdida" en una consolidación |
| `vencimiento_hoy` | Una cuota o mínimo vence en las próximas 48hs | Los dos préstamos BBVA + Patagonia el mismo día |
| `tasa_mas_cara` | Aparece una deuda con CFT/TEA mayor a todas las demás activas | Mastercard Black 125,35% CFTEA |

## 6. Fuera de alcance (v1)

- Integración bancaria automática (scraping/Open Banking) — por ahora carga manual o desde
  captura/PDF, como hicimos hoy.
- Multi-moneda más allá de ARS/USD básico.
- Negociación automática con bancos (esto lo hace el usuario, la app solo prepara el mail/guión).
