"""
Genera el icono de la app desde la fuente de la app.

    python scripts/generar-icono.py

Escribe `app/icon.svg` y el `<path>` de `app/apple-icon.tsx`.

## Por que existe este script

El icono es el signo de pregunta invertido, que es el nombre de la app. La
primera version se dibujo a ojo con un `<path>` a mano y se leia como un
gancho de pescar: el asta muy corta, el cuenco demasiado abierto. Corregirlo a
ojo es empujar numeros sin saber contra que.

La forma correcta ya estaba en el proyecto. `next/font/google` descarga Work
Sans --la fuente de la app-- y deja los .woff2 en `.next/`, y adentro esta el
glifo `questiondown`. Este script lo saca de ahi y lo aplana a una caja de 100,
asi el icono es literalmente la misma letra que el titulo de la landing.

Es el mismo criterio que el resto del proyecto: **donde hay una fuente real, no
se dibuja de memoria.**

## Lo que hace falta para correrlo

    pip install fonttools brotli

Y que `.next/` tenga las fuentes, o sea haber levantado `npm run dev` o
`next build` al menos una vez. Si el peso 400 de Work Sans no esta en cache,
el script lo dice y no escribe nada.

## Por que 400 y no un peso mas grueso

Es el unico que next/font deja en cache con este glifo, porque es el peso que
la app efectivamente renderiza en texto corrido. A 16 px el trazo queda fino
pero legible: mint sobre pine es el contraste mas alto del sistema. Si alguna
vez hace falta mas cuerpo, la forma de conseguirlo NO es engrosar el path a
mano --vuelve el problema del gancho-- sino pedirle a `layout.tsx` que
renderice un peso mas alto en alguna pantalla y volver a correr esto.
"""

import glob
import io
import re
import sys

try:
    from fontTools.misc.transform import Transform
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("Falta fonttools. Corré: pip install fonttools brotli")

SIGNO = 0xBF  # ¿
ALTO = 74.0  # alto del glifo dentro de la caja de 100
PINE = "#0E3A31"
MINT = "#97DCBA"


def buscar_work_sans() -> str | None:
    """El .woff2 de Work Sans que tenga el signo. next/font los deja en .next/."""
    for ruta in sorted(glob.glob(".next/**/*.woff2", recursive=True)):
        try:
            font = TTFont(ruta)
        except Exception:
            continue
        familia = next((r.toUnicode() for r in font["name"].names if r.nameID == 4), "")
        if familia.startswith("Work Sans") and SIGNO in font.getBestCmap():
            return ruta
    return None


def path_del_signo(ruta: str) -> str:
    """El glifo, centrado y escalado a una caja de 100 con la Y ya invertida."""
    font = TTFont(ruta)
    glifos = font.getGlyphSet()
    nombre = font.getBestCmap()[SIGNO]

    caja = BoundsPen(glifos)
    glifos[nombre].draw(caja)
    x0, y0, x1, y1 = caja.bounds

    k = ALTO / (y1 - y0)
    tx = 50 - ((x0 + x1) / 2) * k
    ty = (100 - ALTO) / 2 + y1 * k

    pen = SVGPathPen(glifos)
    glifos[nombre].draw(TransformPen(pen, Transform(k, 0, 0, -k, tx, ty)))

    # Las coordenadas salen con ruido de punto flotante (29.900000000000002).
    return re.sub(r"\d+\.\d+", lambda m: "%g" % round(float(m.group()), 2), pen.getCommands())


def escribir_svg(d: str) -> None:
    io.open("app/icon.svg", "w", encoding="utf-8", newline="\n").write(
        f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!--
    GENERADO POR scripts/generar-icono.py — no editar a mano.

    El signo de pregunta invertido, que es el nombre de la app. La forma no
    esta dibujada: es el glifo `questiondown` de Work Sans, la misma fuente
    que usa la app, sacado del .woff2 que next/font deja en .next/ y aplanado
    a esta caja de 100. Asi el icono es la misma letra que el titulo de la
    landing.

    Va como PATH y no como texto: un icono dibujado con una fuente web depende
    de que esa fuente cargue, y en una pestaña del navegador no carga nada.

    Colores del sistema (tailwind.config.ts): pine de fondo, mint de figura.
    El radio es el 22% del lado, el de iOS, para que se vea igual donde sea.
  -->
  <rect width="100" height="100" rx="22" fill="{PINE}"/>
  <path fill="{MINT}" d="{d}"/>
</svg>
"""
    )


def escribir_tsx(d: str) -> None:
    ruta = "app/apple-icon.tsx"
    fuente = io.open(ruta, encoding="utf-8").read()
    nuevo, n = re.subn(r'const SIGNO =\n  "[^"]*";', f'const SIGNO =\n  "{d}";', fuente)
    if n != 1:
        sys.exit(f"No encontre la constante SIGNO en {ruta}: revisalo a mano.")
    io.open(ruta, "w", encoding="utf-8", newline="\n").write(nuevo)


def main() -> None:
    ruta = buscar_work_sans()
    if ruta is None:
        sys.exit(
            "No encontre Work Sans con el signo en .next/.\n"
            "Levantá `npm run dev` o corré `npx next build` una vez y volvé a intentar."
        )

    d = path_del_signo(ruta)
    escribir_svg(d)
    escribir_tsx(d)
    print(f"de {ruta}")
    print(f"app/icon.svg y app/apple-icon.tsx actualizados ({len(d)} caracteres de path)")


if __name__ == "__main__":
    main()
