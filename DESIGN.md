---
name: Mini App Factory — Simulador de Deudas
description: Lumina Balanced Impact — teal institucional profundo + índigo-pizarra sobre superficies blancas sólidas, Geist para texto y JetBrains Mono reservado para todo dato numérico, adoptado completo (sin su capa de gamificación) desde una referencia Stitch construida específicamente para una app de deudas.
colors:
  background: "#f7f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f4f6"
  surface-container: "#eceef0"
  surface-container-high: "#e6e8ea"
  surface-container-highest: "#e0e3e5"
  outline: "#6c7a75"
  outline-variant: "#bbcac3"
  border-soft: "#e2e8f0"
  on-surface: "#191c1e"
  on-surface-variant: "#3c4a45"
  primary: "#006b58"
  on-primary: "#ffffff"
  primary-container: "#00bd9d"
  on-primary-container: "#004538"
  primary-container-pale: "#d3f5ec"
  secondary: "#565e74"
  on-secondary: "#ffffff"
  secondary-container: "#dae2fd"
  on-secondary-container: "#5c647a"
  tertiary: "#006b5f"
  on-tertiary: "#ffffff"
  tertiary-container: "#00bca8"
  on-tertiary-container: "#00453d"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.04em"
  numeral:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13.5-40px"
    fontWeight: 400-700
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "10px 18px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
  action-pill:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "5px 12px"
  paper-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Lumina Balanced Impact

## Overview

**Creative North Star: "Lumina Balanced Impact" — un asistente financiero institucional, no un juego.**

Tercera dirección visual de este producto en la misma sesión (sucede a "La Cartelera",
pizarrón oscuro, y a "Horizon", vidrio esmerilado claro genérico de SaaS). Adoptada completa
desde una de cinco variantes nombradas de una referencia Stitch construida específicamente
para una app de pago de deudas (`stitch_debt_freedom_flow/lumina_balanced_impact/`), elegida
por ser la más sobria de las cinco frente a sus hermanas "High-Impact" y "Vivid Velocity"
(gradientes más saturados, tipografía más agresiva) y a "Lumina Finance"/"Lumina Light"
(mismo sistema en modo oscuro/claro sin la resolución institucional del Balanced).

Las cinco variantes de la referencia comparten una capa de gamificación — rachas de pago con
ícono de fuego y badge "HOT", un árbol holográfico que crece como recompensa, insignias
desbloqueables ("Consistency King", "Debt Destroyer"), un chat coach casual ("Lumi") — que se
descartó explícitamente: para un usuario en angustia financiera real, una racha que se "rompe"
cuando no podés pagar no es un mecanismo motivador, es la vida real tratada como un juego que
se pierde. Ver PRODUCT.md, sección "Design Direction (superseding again, this session)".

**Key Characteristics:**
- Fondo institucional claro (`#f7f9fb`), nunca blanco puro — tarjetas blancas sólidas con
  borde fino (`#e2e8f0`), no vidrio translúcido (el blur queda reservado para overlays
  puntuales como el selector de tabs).
- Teal profundo (`#006b58`) como color de acción y positivo; índigo-pizarra (`#565e74`) como
  estructura/navegación; rojo (`#ba1a1a`) heredado sin cambios para mora/negativo — nunca se
  atenúa.
- **JetBrains Mono reservado exclusivamente para datos numéricos** — todo monto, tasa y fecha.
  Es una excepción deliberada y documentada a "nunca una tipografía monoespaciada dedicada"
  (la regla que tenía el mundo Horizon anterior), no una deriva accidental.
- Tarjeta hero de saldo total con gradiente oscuro propio (`.hero-gradient`, `#004538` →
  `#006b5f`) — el único lugar de la app con fondo oscuro; todo lo demás es superficie clara.
- Cada tarjeta de deuda lleva un ícono real por tipo (tarjeta, banco, auto — "prendario" es
  literalmente el vehículo en garantía en Argentina, no una elección decorativa), un chip de
  categoría, y una barra de "% pagado" calculada de datos reales (`original_amount` vs
  `current_balance`), nunca una racha inventada.

## Colors

Sistema Material-3-flavored de cinco roles (primario/secundario/terciario/error/neutral), cada
uno con su par `on-*` y su tono `*-container`.

### Primary
- **Teal institucional** (`#006b58`): acción primaria, foco, positivo. `on-primary` blanco.

### Secondary
- **Índigo-pizarra** (`#565e74`): estructura, navegación, texto secundario con peso.

### Tertiary
- **Teal claro** (`#006b5f`): reservado exclusivamente para datos estimados/proyectados —
  mismo principio que el "cian único" del mundo anterior, solo que recoloreado.

### Neutral
- **Fondo** (`#f7f9fb`) / **superficie de tarjeta** (`#ffffff`, borde `#e2e8f0`).
- **Tinta** (`#191c1e`) / **tinta atenuada** (`#3c4a45`).

### Named Rules
**La Regla del Mono de Datos.** JetBrains Mono es la única fuente para montos, tasas y fechas
— nunca la fuente de UI (Geist). Es la señal más barata de que la cifra es un dato real, no
un adorno de texto.

**La Regla del Azul... Teal Único.** El terciario (`--tertiary` / `--estimate`) significa una
sola cosa en toda la app: "esto es estimado, no confirmado". No se reutiliza para nada más.

**La Regla del Número Real.** Ningún color, gradiente ni animación puede hacer que un saldo
negativo o una deuda en mora se vea menos grave. Rojo es rojo, siempre con su glifo al lado.

**La Regla del Container Pálido.** Un `*-container` que sirve de fondo para un chip con texto
encima debe ser pálido (~90%+ de luminosidad) para sostener contraste AA — `--primary-container`
(`#00bd9d`) heredado de la referencia es un acento vívido (~55%), no una superficie tonal, así
que NO se usa como fondo de texto: para eso existe `--primary-container-pale` (`#d3f5ec`).
`--primary-container` sigue disponible para acentos decorativos sin texto encima.

## Typography

**Display/UI Font:** Geist (con system-ui de respaldo) — todo texto que no es un monto.
**Numeral Font:** JetBrains Mono — todo monto, tasa, fecha, sin excepción.

### Hierarchy
- **Display** (700, 28px): título de página (`h1`).
- **Headline** (600, 20px): título de sección (`h2`).
- **Body** (400, 15px): texto de UI.
- **Label** (600, 12px, uppercase, tracking 0.04em): etiquetas de campo de formulario —
  **nunca** para una frase larga de opción (checkbox description); esas usan `.option-label`
  (texto normal, sin mayúscula) para no leerse como un grito.
- **Numeral** (400-700, 13.5-40px, tabular-nums, JetBrains Mono): todo monto de dinero.

## Layout

Contenedores centrados, `max-width` 420-880px según densidad de la pantalla, sin grilla de
columnas — ritmo vertical. Tablas anchas con muchas columnas (proyección de cash flow,
desglose de deuda mes a mes) se resolvieron con **tabs de mes en píldora** (`MonthTabs.tsx`,
client component) en vez de scroll horizontal — un mes por tab, contenido de ese mes como
lista vertical debajo. El listado de deudas del dashboard usa el mismo patrón de fila que un
exchange de cripto: avatar circular + nombre/categoría a la izquierda, monto grande + dato
secundario a la derecha.

## Elevation & Depth

Tarjetas blancas sólidas con hairline (`.paper-card`, `.table-card`) — no glassmorphism; el
blur (`.glass-panel`) queda para casos puntuales. Sombra ambiental sutil bajo cada tarjeta
(`0 10px 24px -5px rgba(0,107,88,0.05)`), nunca una sombra plana sin blur.

## Shapes

Radios: 4px (chico), 8px (medio), 12px (`rounded-xl`, tarjetas/hero), pill completo para
botones/chips/tabs. Menos redondeado que el Horizon anterior (que usaba 14-20px).

## Components

### Buttons
- **Primary:** pill, fondo `--primary` sólido, texto blanco.
- **Secondary:** pill, borde `--primary` 1.5px, texto `--primary`, fondo transparente — se
  activa vía el inline style `background: white` heredado (hook de compatibilidad).
- **Destructive:** texto plano `--error`, sin fondo ni borde — activado vía `background: none`.
- **Action pill** (`.action-pill`): píldora chica outline para acciones de navegación dentro
  de una tarjeta (Cronograma/Pagos/Editar) — "Borrar" queda como texto plano a propósito,
  una acción destructiva se beneficia de ser MENOS prominente, no más.

### Cards
- Fondo `--surface-container-lowest` (blanco), borde `--border-soft`, radio 12px, padding 20px.
- La tarjeta de deuda lleva: avatar circular con ícono por tipo (color fijo, no rotado por
  fila — rotar el color sin significado generaba confusión, "¿es por banco?"), chip de
  categoría, monto en mono, badge de vencimiento si es imminente, barra de "% pagado", y una
  fila de action-pills al pie.

### Inputs / Fields
- Fondo blanco, borde `--border-soft` 1px, radio 4px. Focus: borde `--primary` + halo.
- `input[type="checkbox"]` usa `accent-color: var(--primary)` (antes caía al azul/rosa por
  default del navegador).
- Un checkbox con una frase larga de descripción usa la clase `.option-label` para que la
  frase no herede el mayúscula-y-tracking del label de campo.

### Health Ribbon (componente de firma, cash flow)
Tira de tiles, uno por mes, mostrando saldo acumulado proyectado — icono + color + fondo
tonal (siempre pálido, ver Regla del Container Pálido) por severidad (rojo=negativo,
gris=justo, teal-pálido=positivo). Anima al montar (`board-power-on` → `surface-rise-in`),
respeta `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** usar JetBrains Mono para absolutamente todo monto de dinero, con `tabular-nums`.
- **Do** reservar el terciario (teal claro) exclusivamente para datos estimados/proyectados.
- **Do** usar un `*-container-pale` (no el `*-container` base) como fondo de chip con texto.
- **Do** un ícono real por tipo de dato (tipo de deuda, severidad) — nunca emoji.
- **Do** mostrar el número real, aunque sea negativo.

### Don't:
- **Don't** usar gamificación (rachas, insignias, mascotas, "streaks") — decisión de producto
  explícita, no solo estética, para este tipo de usuario.
- **Don't** rotar el color de un avatar/badge sin que el color signifique algo — el ícono ya
  distingue lo que hay que distinguir.
- **Don't** dejar una frase larga de checkbox con el estilo de label de campo (mayúscula).
- **Don't** usar `--primary-container` como fondo de un chip con texto encima — falla
  contraste AA. Usar `--primary-container-pale`.
- **Don't** usar `border-left`/`border-right` de color en tarjetas o alertas.

## Estado de implementación (para continuar en otra sesión)

**Con la pasada bespoke completa:** `app/dashboard/page.tsx`, `app/dashboard/cashflow/page.tsx`
y sus componentes (`HealthRibbon.tsx`, `CashFlowChart.tsx`, `MonthTabs.tsx`), `app/dashboard/
payoff-plan/page.tsx`, `app/dashboard/expenses/new/page.tsx` + `ExpenseTypeToggle.tsx`. El
`.action-pill` se aplicó también en `payoff-plan` y en el dashboard.

**Recién empezada (solo la cabecera, no la pantalla entera):**
`app/dashboard/debts/[id]/schedule/page.tsx` — se le agregó arriba del todo una sección nueva
de "salud de deuda" (ícono+nombre+saldo combinado, panel oscuro `.hero-gradient` con TNA/
vencimiento/mínimo/mensaje de estado real, comparación de estimación de pago, gráfico de
evolución de saldo, acciones rápidas, actividad reciente) inspirada en un mockup Stitch que el
usuario bajó a `stitch_debt_freedom_flow/debts_screen/` (ojo: el DESIGN.md de esa carpeta
específica tiene prosa vieja/inconsistente — "Deep Indigo", "Electric Teal" — que NO coincide
con sus propios tokens de `code.html`; los tokens de `code.html` sí coinciden exacto con este
sistema, usar esos, ignorar la prosa). **Esta cabecera se verificó visualmente en el navegador
el 2026-08-28** contra una tarjeta real (Mastercard Banco Patagonia ...4139) y coincide con el
sistema: panel oscuro `.hero-gradient`, TNA/vencimiento/mínimo/mensaje de estado, comparación
de estimación de pago, actividad reciente, todo con JetBrains Mono y la paleta teal correctas.
El "gráfico de evolución de saldo" está condicionado a `balanceHistory.length > 1` (un punto por
resumen cargado) — para esta tarjeta, que solo tiene un resumen guardado, correctamente no se
muestra; falta verificar con una tarjeta que tenga 2+ resúmenes cargados para ver el gráfico en
sí. El resto de esa misma pantalla (formulario "Agregar resumen", tabla "Cuotas y
refinanciación", "Cronograma de pagos") sigue con estilos inline viejos sin tocar,
deliberadamente, para no agrandar el cambio.

**Heredan los tokens vía el puente de compatibilidad en `globals.css` (alias `--led-*`,
`--board-*`, `--ink-*`) pero NO recibieron la pasada bespoke de este mundo:** escenarios,
alertas, préstamos puente, formularios de deuda (nuevo/editar), pagos, subida/revisión de PDF,
ingresos/gastos de cash flow (el form original en `cashflow/expenses/new` sigue así; el nuevo
punto de entrada unificado en `app/dashboard/expenses/new` si tiene la pasada bespoke).
`app/dashboard/debts/[id]/charges/page.tsx` tampoco la tiene (se le agregó el form de "agregar
gasto suelto" con estilos inline viejos, a propósito, para no mezclar un rediseño con una
feature nueva en el mismo cambio).

**Tokens nuevos agregados a `globals.css` este pase:** `--tertiary-container-pale` (mint pálido
para texto/fondo de chip "estimado", análogo a `--primary-container-pale` — `--tertiary-
container` es un acento vívido, no sirve de fondo de texto por la Regla del Container Pálido).
