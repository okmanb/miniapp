/** Suelta un PDF acá para ver por qué no entra: npx tsx scripts/probar-pdf.ts ruta.pdf */
import { readFileSync } from "node:fs";
import { extractLayoutText } from "../lib/statement-parser/pdf-layout";
import { parseStatement } from "../lib/statement-parser";

const file = process.argv[2];
if (!file) {
  console.log("Uso: npx tsx scripts/probar-pdf.ts <ruta al pdf>");
  process.exit(1);
}

extractLayoutText(readFileSync(file))
  .then((text) => {
    console.log("Texto extraido:", text.length, "caracteres");
    console.log("Primeras lineas:");
    console.log(text.split("\n").slice(0, 12).join("\n"));
    console.log("\n--- lo que entiende el parser ---");
    console.log(JSON.stringify(parseStatement(text), null, 2).slice(0, 1200));
  })
  .catch((e) => {
    console.log("FALLO al abrir el PDF");
    console.log("  name:   ", e?.name);
    console.log("  message:", e?.message);
    if (e?.stack) console.log("  stack:  ", String(e.stack).split("\n").slice(1, 4).join("\n"));
  });
