# DESIGN.md — Simuladeudas

Este documento reemplaza la dirección visual anterior del repo (Horizon: blanco, vidrio,
Plus Jakarta Sans, primario coral, Material Symbols). Los valores de acá son los que usa
`handoff/prototipo.html`; ante cualquier duda, gana el prototipo.

## La idea

Una app de deudas es un objeto de ansiedad. El sistema trabaja en contra de eso: fondo gris
cálido en vez de blanco clínico, superficies blancas mates sin vidrio ni degradados, y el
verde reservado para lo que efectivamente es progreso. El rojo y el ámbar no se suavizan
nunca, porque significan algo concreto.

## Tipografía

| Uso | Familia | Detalle |
|---|---|---|
| Interfaz | Work Sans | 400 / 500 / 600 / 700 / 800 |
| Cifras, códigos, etiquetas de dato | IBM Plex Mono | 400 / 500 / 600 |

Toda cifra va en IBM Plex Mono, alineada a la derecha en pares etiqueta/valor. Los títulos
de pantalla son 20px/600 con `letter-spacing:-.01em`; los de tarjeta 13.5–15px/600. Las
etiquetas de campo son 10.5px/600, mayúsculas, `letter-spacing:.06em`, color `#5C6B65`.
El texto de ayuda es 11–12px con `line-height:1.45–1.55` y `text-wrap:pretty`.

## Color

Cada verde tiene un rol y uno solo. No son intercambiables.

| Token | Hex | Rol |
|---|---|---|
| `pine` | `#0E3A31` | Estructura, texto de acento, superficies oscuras, foco |
| `pine-hover` | `#0A2C25` | Hover de superficies pine |
| `teal` | `#0D6B5C` | Relleno del botón primario sobre fondo claro |
| `teal-hover` | `#0A5A4D` | Hover del botón primario |
| `mint` | `#97DCBA` | CTA sobre fondo oscuro, cifras positivas, foco en oscuro |
| `leaf` | `#25835D` | Hover de vínculos y botones de texto |
| `leaf-deep` | `#175F42` | Cifra positiva sobre fondo claro |
| `brick` | `#B14D3B` | Peligro: vencimiento, quitar, saldo que crece |
| `brick-ink` | `#823123` | Texto sobre fondos brick claros |
| `brick-head` | `#8E3B2C` | Título de banner destructivo |
| `gold` | `#A77530` | Costo de interés, préstamos puente |
| `gold-ink` | `#7A5116` | Texto sobre fondos gold claros |
| `ink` | `#12211D` | Texto principal |
| `muted` | `#5C6B65` | Texto secundario y etiquetas |
| `app-bg` | `#F1F3EF` | Fondo de la app |
| `surface` | `#FFFFFF` | Tarjetas |
| `surface-sunken` | `#F7FAF7` | Filas dentro de una tarjeta |
| `surface-arch` | `#F2F5F1` | Filas archivadas o inactivas |
| `surface-alt` | `#EFF2EE` | Zonas de carga de archivo |
| `mint-wash` | `#E0F4E9` | Fondo de selector segmentado y estado logrado |
| `border` | `#DEE3DD` | Borde de tarjeta |
| `border-input` | `#D3DAD2` | Borde de campo |
| `border-row` | `#E2E7E1` | Borde de fila interna |
| `border-dash` | `#CBD2C9` | Borde punteado de nota informativa |
| `track` | `#E7EBE6` | Riel de barra de progreso |
| `skeleton` | `#DFE5DF` | Bloque de carga |
| `selection` | `#BEE1CE` | `::selection` |

Fondos de severidad: brick claro `#FFE9E4` y `#FFF6F3` con borde `#F2C7BE`; gold claro con
borde `#E6CFA4`. **Máximo dos severidades por pantalla.** El verde nunca se usa para carga
de datos neutra: verde significa progreso.

## Forma

Tres niveles de radio, sin excepciones:

- `8px` — filas dentro de una tarjeta o menú
- `10–14px` — superficies, tarjetas, campos, botones chicos de barra
- `999px` — todo lo que se toca: botones, píldoras, chips, selectores

Los controles son píldoras; las superficies, rectángulos suaves. Bordes de 1px, nunca 2.
Una sola sombra en el sistema, para la tarjeta principal de una pantalla:
`0 14px 26px -18px rgba(14,58,49,.28)`.

## Botones

Un solo primario por vista: relleno `teal`, texto blanco, `999px`, 13.5px/600, `padding:11px 14px`.
Los secundarios son borde `border` sobre blanco con texto `pine`. Los de texto no tienen
caja y pasan a `leaf` en hover. La etiqueta va alineada a la izquierda, con flecha al final
solo si navega.

## Movimiento

Una sola curva: `cubic-bezier(.23,1,.32,1)`. Entrada de pantalla `sdScreenIn` 130ms (solo
opacidad); entrada de tarjeta `sdCardIn` 200–220ms (opacidad + 8px de subida); banner
`sdBannerIn` 180–200ms (opacidad + escala desde .96); spinner `sdSpin` 700ms lineal;
barra indeterminada `sdSlide` 620ms. Los cambios de estado interpolan en 140–200ms.
El selector segmentado anima `clip-path` en 200ms con `cubic-bezier(.77,0,.175,1)`.

`@media (prefers-reduced-motion: reduce)` desactiva las animaciones de entrada y deja solo
opacidad en las transiciones. Está resuelto en el prototipo con `[data-motion]` y
`[data-motion-move]`; conviene portar el mismo mecanismo.

## Accesibilidad

Toda zona tocable mide 44×44 como mínimo, incluida la × de quitar un gasto. El foco es
`outline:2px solid #0E3A31` con `offset:2px`, y `#97DCBA` sobre fondos oscuros. Los
selectores nativos están reemplazados por píldoras: el resaltado azul del sistema operativo
rompía la paleta.

## Escritura

Español de Argentina, voseo. Montos en pesos sin decimales. La interfaz explica la causa,
no la regaña: "el mínimo no cubre el interés — el saldo va a seguir creciendo", no "estás
mal". Los títulos son enunciados, no sustantivos sueltos. Sin emoji.
