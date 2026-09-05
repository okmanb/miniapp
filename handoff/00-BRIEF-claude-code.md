# Brief para Claude Code — construir Simuladeudas desde cero

Pegá este archivo como primer mensaje en Claude Code, en la raíz del repo clonado
`okmanb/miniapp`, y dejalo trabajar. Está escrito para que ejecute sin volver a
preguntar cada paso.

---

## El encargo

Construí la app entera de nuevo, desde cero, sobre este repo. Hay un prototipo navegable
aprobado — `handoff/prototipo.html`, 19 pantallas con sus estados de carga, vacío y error —
y **es la fuente de verdad del diseño y del comportamiento de la interfaz**. No es una
referencia libre. Quiero que la app terminada sea indistinguible del prototipo: mismos
colores, tamaños de fuente, radios, espaciados, curvas de animación, textos y transiciones
entre pantallas.

Tenés autonomía completa sobre el código. No tenés autonomía sobre el diseño: si algo del
prototipo te parece mejorable, hacelo igual como está y anotalo al final en
`NOTAS-PARA-REVISAR.md`.

## Los documentos, en orden de autoridad

1. `handoff/prototipo.html` — abrilo en el navegador y tenelo al lado todo el tiempo. Ante
   cualquier contradicción con los documentos, gana el prototipo.
2. `handoff/DESIGN.md` — el sistema visual con los valores exactos.
3. `handoff/PRODUCT-RULES.md` — las reglas de cálculo y de datos que la interfaz asume.
4. `handoff/SCREENS.md` — las 19 pantallas y el orden de construcción.
5. `handoff/RESET.md` — qué se conserva del repo viejo y cómo limpiar.

## Paso 0 — limpiar, sin romper la infraestructura

Seguí `RESET.md`. Resumido: etiquetá el estado actual (`git tag v0-preliminar && git push --tags`),
abrí la rama `reset`, y borrá todo salvo la config del proyecto, `lib/supabase/`,
`middleware.ts` y las dos piezas que **no se rehacen**:

- `lib/statement-parser/` — ingeniería inversa sobre PDFs reales de BBVA y Patagonia. Tiene
  un bug conocido: devuelve un saldo muy por encima del real, probablemente sumando
  movimientos en lugar de leer el saldo del resumen. Arreglá el bug, conservá el trabajo de
  layout.
- `lib/debt-engine/` — conservalo como **control cruzado**, no como implementación. La
  lógica que va a producción es la del prototipo, porque es la que generó las cifras que ya
  se revisaron y aprobaron. Portala a `lib/calc/` como módulos puros y compará resultados
  contra el motor viejo en un caso real; donde difieran, gana el prototipo, pero decime cuál
  era la diferencia.

No borres el repo ni el proyecto de Vercel: ahí viven el dominio, las variables de entorno y
el enlace de despliegue.

## Paso 1 — datos

Esquema nuevo en Supabase, limpio: no hay nada que migrar. Login con Supabase Auth desde el
arranque, con las políticas de acceso por fila escritas junto al esquema y no encima.

La regla que estructura todo: **todo dato de simulación cuelga de un escenario.** Deudas,
gastos, ingresos, pagos y resúmenes se filtran por el escenario activo. Un gasto creado en
el plan base no existe en el plan de contingencia. Copiar un escenario copia sus datos, no
los comparte. Si esto queda mal en el esquema, se arrastra a todas las pantallas.

Los gastos, además, guardan el mes en que se cargaron, si repiten todos los meses, si están
archivados y el mes en que dejaron de valer. `PRODUCT-RULES.md` tiene las ocho reglas
completas; son la parte más trabajada del prototipo y la que más fácil se pierde al portar.

## Paso 2 — el sistema visual, antes de las pantallas

Tailwind con los tokens de `DESIGN.md`, con esos hex exactos y nada aproximado. Work Sans
para interfaz, IBM Plex Mono para toda cifra. Los tres niveles de radio. La única curva de
animación. El mecanismo de `prefers-reduced-motion` que el prototipo resuelve con
`[data-motion]`, portado igual.

Cada verde tiene un rol y uno solo, y no son intercambiables: pine estructura, teal el botón
primario sobre claro, mint la acción sobre oscuro y las cifras positivas. Brick y gold son
severidades con significado — vencimiento y costo de interés — y no se suavizan nunca.
Máximo dos severidades por pantalla, un solo botón primario por vista.

## Paso 3 — las pantallas

En el orden de `SCREENS.md`: dashboard, flujo de caja, detalle de deuda y agregar gasto
primero, porque concentran el sistema y las reglas de gastos. El resto hereda de esas cuatro.

Cada pantalla incluye sus cuatro estados — listo, cargando, vacío, error — porque son parte
del diseño y están en el prototipo. Comparala contra el prototipo abierto al lado antes de
darla por hecha.

## La condición que no se negocia

**Ninguna cifra visible está escrita a mano.** Todo se recalcula desde la lista de deudas y
el escenario activo: amortización, alertas, proyección, el delta del encabezado, los
subtotales por mes. Si una pantalla necesita un número que el modelo no puede derivar, el
problema es el modelo y hay que decirlo, no rellenarlo.

## Al terminar

Andá haciendo commits por pantalla, no uno solo al final. Cuando la rama `reset` corra
completa, mergeala a main; Vercel despliega en cada push. Dejame en
`NOTAS-PARA-REVISAR.md` tres cosas: las diferencias que encontraste entre el motor viejo y
el del prototipo, lo que el prototipo no definía y tuviste que decidir, y lo que quedó
pendiente.
