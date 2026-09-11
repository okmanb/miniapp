/**
 * Extrae texto de un PDF preservando el layout visual (columnas),
 * igual que hace `pdftotext -layout` — pero en JS puro con
 * pdfjs-dist, para no depender de ningún programa del sistema
 * (importante: funciona igual en Windows, Mac o Linux sin instalar
 * nada aparte).
 *
 * Por qué hace falta esto: pdf-parse y similares devuelven el texto
 * en el orden interno del PDF, que casi nunca coincide con el
 * orden visual — mezcla columnas y arruina cualquier parser basado
 * en posición. Reconstruimos el layout agrupando por coordenada Y
 * (misma fila visual) y ordenando por X dentro de cada fila.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Dónde quedaron los .pfb de pdfjs, preguntándoselo a Node.
 *
 * NO se arma con `new URL("../../node_modules/...", import.meta.url)`: eso
 * resuelve contra la ubicación del archivo, y en el build de produccion este
 * archivo vive adentro de `.next/`, desde donde esa ruta relativa no lleva a
 * ningún lado. Andaría en desarrollo y fallaría desplegado, que es la peor
 * forma de fallar.
 *
 * `createRequire().resolve` le pregunta a Node dónde está el paquete de
 * verdad, y funciona igual empaquetado o no. `pdfjs-dist` está en
 * `serverExternalPackages`, así que en produccion sigue siendo un paquete real
 * adentro de node_modules.
 *
 * Si aun así no se puede resolver, se devuelve undefined y pdfjs vuelve a
 * quedar como estaba: esto tiene que poder mejorar la situación, nunca
 * empeorarla.
 */
function resolveStandardFonts(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const packageJson = require.resolve("pdfjs-dist/package.json");
    // pdfjs pide una URL o una ruta terminada en separador.
    return join(dirname(packageJson), "standard_fonts") + "/";
  } catch {
    return undefined;
  }
}

export async function extractLayoutText(buffer: Buffer): Promise<string> {
  // Import dinámico: la build "legacy" de pdfjs-dist no depende de
  // APIs de browser (DOM/Worker), así que corre en Node sin drama.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  /*
   * Los datos de las fuentes estándar, y nada de fuentes del sistema.
   *
   * Sin `standardFontDataUrl`, pdfjs avisa "Ensure that the
   * standardFontDataUrl API parameter is provided" y en un PDF simple sigue de
   * largo — pero un documento que de verdad necesita esos datos falla al
   * abrirse, y el error sale como "no pudimos abrir ese PDF". Un resumen de
   * banco usa fuentes estándar por todos lados.
   *
   * `useSystemFonts: false` va con esto: en Node, pdfjs intenta por defecto
   * resolver fuentes contra las del sistema operativo, que en Windows es
   * justamente donde se rompe — y para extraer texto no hace falta ninguna
   * fuente de verdad.
   */
  const standardFontDataUrl = resolveStandardFonts();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    standardFontDataUrl,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = (content.items as any[])
      .filter((item) => "str" in item && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        // Redondeamos Y con tolerancia — texto en la misma fila
        // visual puede tener coordenadas Y levemente distintas por
        // cómo el PDF posiciona cada glyph.
        y: Math.round(item.transform[5] / 3) * 3,
      }));

    const lineMap = new Map<number, { x: number; text: string }[]>();
    for (const item of items) {
      if (!lineMap.has(item.y)) lineMap.set(item.y, []);
      lineMap.get(item.y)!.push({ x: item.x, text: item.text });
    }

    // La coordenada Y de un PDF crece hacia ARRIBA, así que
    // ordenamos descendente para leer de arriba hacia abajo, como
    // se lee visualmente.
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines = sortedYs.map((y) =>
      lineMap
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(" ")
    );

    pageTexts.push(lines.join("\n"));
  }

  await pdf.destroy();
  return pageTexts.join("\n\n");
}
