# RESCATE — lo que tenía `01-SPEC.md` y no está en `PRODUCT-RULES.md`

`RESET.md` pide rescatar de `01-SPEC.md` la sección de reglas de integridad si tiene algo
que no esté en `PRODUCT-RULES.md`. Lo tenía. Esto es lo que se salva antes de borrar el
handoff viejo; el original queda en el tag `v0-preliminar`.

## Reglas de integridad que faltaban

`PRODUCT-RULES.md` ya cubre "el mes actual no se cuenta dos veces" (regla 1 del spec viejo).
Estas tres no estaban:

2. **No pagar dos veces la misma deuda en dos filas distintas.** Al consolidar un pago
   variable con un "consumo nuevo a financiar" de la misma deuda, verificar que no sean el
   mismo monto contado dos veces. Pasó con la Visa.
3. **Todo ajuste que "sube de acá en más" se aplica desde el mes correspondiente en
   adelante, sin reescribir el histórico.** Es la misma idea que la regla 4 de gastos de
   `PRODUCT-RULES.md`, pero enunciada también para ingresos: el aumento de sueldo entró
   desde septiembre, no retroactivo a agosto.
4. **Dato confirmado por el usuario deja de ser estimación en el acto.** Cuando el usuario
   dice "esto es tal" y no "por ahí es tal", el valor se marca como dato duro inmediatamente,
   aunque la app lo hubiera estimado antes. Esto es el `is_estimate` de
   `debt_schedule_entries`.

## Taxonomía de alertas

La pantalla 10 (Alertas) las muestra, pero ningún documento de `handoff/` define los tipos.
El spec viejo sí, con el caso real que originó cada uno:

| Tipo | Dispara cuando |
|---|---|
| `saldo_creciente` | Una deuda con pago fijo no cubre el 100% del interés |
| `doble_conteo` | Dos filas del flujo de caja podrían representar el mismo pago |
| `mes_no_reflejado` | El saldo inicial cargado no coincide con lo que el flujo proyectaba para ese mes |
| `gasto_no_capturado` | Hay un pago recurrente que no está en ninguna fila |
| `vencimiento_hoy` | Una cuota o mínimo vence en las próximas 48 horas |
| `tasa_mas_cara` | Aparece una deuda con CFT/TEA mayor a todas las demás activas |

`saldo_creciente` es la que `PRODUCT-RULES.md` desarrolla bajo "Salud de la deuda", con la
exigencia extra de nombrar el monto del interés o de los gastos fijos según cuál sea la causa.

## Fuera de alcance en v1

Integración bancaria automática (scraping u Open Banking), multimoneda más allá de ARS/USD
básico, y negociación automática con bancos.
