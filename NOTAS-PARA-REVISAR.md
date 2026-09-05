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

## 3. Pendiente

- **Las 19 pantallas.** El sistema visual, el esquema y el motor están; las pantallas se
  construyen en el orden de `SCREENS.md` (01, 02, 03 y 05 primero). Nada de esto se mergea
  a `main` hasta que la rama `reset` corra completa.
- **Aplicar el esquema a Supabase.** `supabase/schema.sql` está escrito pero **no se
  aplicó** a ningún proyecto: es una escritura sobre infraestructura viva y no estaba
  claro contra qué proyecto correrlo.
- **`next@14.2.15` tiene una vulnerabilidad de seguridad conocida** (npm lo avisa en cada
  install; ver el aviso de Next del 2025-12-11). `RESET.md` dice que Next 14 sigue igual,
  así que no se tocó la mayor, pero conviene subir al parche de la línea 14.x antes de
  volver a desplegar.
- **Contrastar el cierre de resumen contra un PDF real** de la Visa, por la diferencia de
  seis cifras de arriba.
- El `lib/debt-engine/` viejo queda en el repo como control cruzado, no como
  implementación. Cuando las pantallas estén, conviene decidir si se borra o se deja.
