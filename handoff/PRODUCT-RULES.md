# PRODUCT-RULES.md — reglas que la interfaz asume

Regla de oro: **ninguna cifra visible está escrita a mano.** Todo se recalcula desde la
lista de deudas y el escenario activo — amortización, alertas, proyección, el delta del
encabezado. Si una pantalla necesita un número que el modelo no puede derivar, el problema
es el modelo.

## Escenarios

Todo dato de simulación cuelga de un escenario. Deudas, gastos, ingresos, pagos y resúmenes
se filtran por el escenario activo. Un gasto creado en el plan base no existe en el plan de
contingencia. Al copiar un escenario se copian sus datos; no se comparten.

## Deudas

Una deuda puede tener, mes a mes, uno de tres tipos de pago: cuota fija (sistema francés,
baja sola), pago variable (el usuario carga el monto real) o mínimo estimado (la app lo
calcula y el usuario define cuánto paga por encima). El saldo de una tarjeta **se deriva**:
saldo base más los gastos abiertos cargados a esa tarjeta, menos los pagos registrados.
Nunca se parchea el saldo al agregar o quitar un gasto — si hace falta revertir un parche,
el modelo está mal.

## Gastos

Hay dos clases, y la diferencia es de comportamiento, no de etiqueta:

- **Gasto fijo:** repite todos los meses. Suma a la proyección de cada mes, no una sola vez.
  Puede pagarse en efectivo o cargarse a una tarjeta.
- **Consumo único:** entra una vez, en el mes en que se cargó.

Reglas que la interfaz ya expone y que hay que respetar:

1. Todo gasto guarda el **mes** en que se cargó y el **escenario** al que pertenece.
2. Los gastos cargados a una tarjeta se listan en el detalle de esa tarjeta, agrupados por
   mes con subtotal por grupo, editables al toque.
3. Al cargar el resumen del mes, los gastos abiertos de esa tarjeta se **archivan, no se
   borran**: el resumen ya los trae adentro, así que dejan de sumar al saldo, pero siguen
   consultables y se pueden **recuperar** si el resumen no los incluía. Los fijos archivados
   siguen repitiéndose en la proyección.
4. Editar el monto de un gasto fijo de un mes anterior ofrece dos alcances: corregir el
   monto de siempre, o cambiarlo desde este mes. El segundo cierra el registro viejo con el
   mes en que dejó de valer y abre uno nuevo — el historial no se reescribe.
5. Un gasto fijo terminado deja de contar en la repetición mensual.
6. Si ya hay gastos cargados a mano a una tarjeta y el resumen trae consumos nuevos, hay que
   avisar del doble conteo antes de guardar y ofrecer quitar los cargados a mano.
7. Un gasto fijo pagado con tarjeta aparece en la lista de gastos del mes marcado como que
   no sale del efectivo, y el total de gastos del mes cuenta solo lo que sale del efectivo.
8. Cambiar un gasto de tarjeta se hace editándolo, sin borrar y volver a cargar.

## Salud de la deuda

Cuando un saldo crece, la app dice por qué, distinguiendo entre interés, gastos fijos
cargados a la tarjeta y mínimo insuficiente. Si el mínimo no cubre el interés, se nombra el
monto del interés. Si lo cubre pero no alcanza para los gastos fijos que se le cargan cada
mes, se nombra ese monto.

## Integridad

- El mes actual no se cuenta dos veces entre saldo real y saldo proyectado.
- Un mínimo por deuda por mes: el atajo de registrar el mínimo no puede aplicarse dos veces
  sin que se note.
- Un saldo ya cancelado cierra en cero meses, no en "nunca".
- Si el pago no cubre el interés del mes, la amortización no devuelve un plazo: devuelve que
  no se salda a ese ritmo.
