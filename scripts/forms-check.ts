/**
 * Los números que viajan entre un campo de texto y el modelo.
 *
 * Existe por un bug que no se veía: la app escribía la tasa con `String(n)`
 * —"83.8"— y la volvía a leer con las reglas de acá, donde el punto separa
 * miles. La tasa entraba como 838 y, por estar debajo del tope de 1000, se
 * guardaba mal sin un solo mensaje de error. El PDF de un banco lo destapó
 * recién cuando la tasa tenía tres cifras ("68.63" -> 6863) y sí saltó el tope.
 *
 *   npx tsx scripts/forms-check.ts
 */

import { parseArgNumber } from "../app/dashboard/debts/validation";
import { formatArgNumber } from "../lib/calc/money";

let failed = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = Object.is(got, want);
  if (!ok) failed++;
  console.log(`  ${ok ? "=" : "≠"}  ${label}: ${JSON.stringify(got)}${ok ? "" : ` · esperado ${JSON.stringify(want)}`}`);
}

console.log("\n=== Leer lo que escribe una persona ===\n");

// Formato argentino de toda la vida.
check("5.710.670,92", parseArgNumber("5.710.670,92"), 5710670.92);
check("1.500 son mil quinientos", parseArgNumber("1.500"), 1500);
check("98,03", parseArgNumber("98,03"), 98.03);
check("vacío es null", parseArgNumber("  "), null);

// La excepción: un punto suelto con una o dos cifras detrás solo puede ser
// decimal, porque un grupo de miles tiene tres.
check("68.63 es la tasa, no 6863", parseArgNumber("68.63"), 68.63);
check("83.8 es la tasa, no 838", parseArgNumber("83.8"), 83.8);
check("0.5", parseArgNumber("0.5"), 0.5);

console.log("\n=== Ida y vuelta: lo que la app escribe, se lee igual ===\n");

for (const n of [83.8, 68.63, 98.03, 0, 1500, 5710670.92]) {
  check(`${n} -> "${formatArgNumber(n)}" -> ${n}`, parseArgNumber(formatArgNumber(n)), n);
}

console.log(failed === 0 ? "\nTodo bien.\n" : `\n${failed} fallaron.\n`);
process.exit(failed === 0 ? 0 : 1);
