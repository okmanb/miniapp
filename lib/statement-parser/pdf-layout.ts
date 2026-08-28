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

export async function extractLayoutText(buffer: Buffer): Promise<string> {
  // Import dinámico: la build "legacy" de pdfjs-dist no depende de
  // APIs de browser (DOM/Worker), así que corre en Node sin drama.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items
      .filter((item: any): item is { str: string; transform: number[] } => "str" in item && item.str.trim().length > 0)
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
