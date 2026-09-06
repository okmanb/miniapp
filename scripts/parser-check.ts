/**
 * Control del parser de resúmenes.
 *
 * Ejercita las regex de lib/statement-parser contra el layout que produce
 * extractLayoutText sobre un resumen de BBVA, con los valores reales que
 * tenía la Visa Signature en el respaldo del proyecto.
 *
 * Verifica lo que el parser tiene que hacer y —más importante— lo que NO:
 * el saldo se LEE del encabezado, no se calcula sumando movimientos. Ese fue
 * el bug que llegó a mostrar $2-3M como $33M.
 *
 * Correr con:  npx tsx scripts/parser-check.ts
 */

import { parseStatement } from "../lib/statement-parser";

/** Layout de un resumen de BBVA tal como lo deja la extracción por coordenadas. */
const RESUMEN_BBVA = `
BBVA Banco Frances
Visa Signature cuenta 0805192166   CONSOLIDADO

Tasas
69,440 %   -   5,707 %   -

CIERRE ACTUAL   VENCIMIENTO ACTUAL   SALDO ACTUAL $   SALDO ACTUAL U$S   PAGO MINIMO $
26-Jul-26   07-Ago-26   5.739.870,04   0,00   3.086.770,00

SALDO ANTERIOR   4.838.268,01

Consumos del periodo
FECHA   DETALLE   NRO. CUPON   IMPORTE
12-Jul-26   MERPAGO*JUMBO   445120   630.396,59
14-Jul-26   COLEGIO SAN PABLO   445121   391.200,00
15-Jul-26   DLO*PRIMEVIDEO   445122   10.283,79
16-Jul-26   NETFLIX USD   445123   12.500,00
26-Nov-25   VISA PLAN V 9-18 (TNA 98,03)   288032   482.069,57
17-Abr-26   MERPAGO*CARONEGM   C.04/09   282179   36.726,66
TOTAL CONSUMOS   1.563.176,61

Impuestos, cargos e intereses
20-Jul-26   IVA SOBRE INTERESES   999001   58.000,00

Legales y avisos
`.trim();

const parsed = parseStatement(RESUMEN_BBVA);

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "=" : "FALLA"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (esperado ${JSON.stringify(expected)})`}`);
}

console.log("=== Cabecera ===\n");
check("tarjeta", parsed.cardName, "Visa Signature");
check("últimos 4", parsed.accountLast4, "2166");
check("TNA punitoria", parsed.tnaPunitorio, 69.44);
check("cierre", parsed.cierreActual, "2026-07-26");
check("vencimiento", parsed.vencimientoActual, "2026-08-07");
check("pago mínimo", parsed.pagoMinimo, 3086770);

console.log("\n=== El saldo se LEE, no se calcula ===\n");
check("saldo actual", parsed.saldoActual, 5739870.04);
check("saldo anterior", parsed.saldoAnterior, 4838268.01);

// Esta es la prueba que importa: el saldo del encabezado NO puede ser la suma
// de los consumos. Si algún día alguien "arregla" el parser sumando
// movimientos, esto lo agarra.
const sumaConsumos = parsed.chargeLines.reduce((a, l) => a + l.amount, 0);
const leDaIgual = Math.abs((parsed.saldoActual ?? 0) - sumaConsumos) < 1;
if (leDaIgual) {
  failures++;
  console.log("  FALLA  el saldo coincide con la suma de consumos — se está calculando, no leyendo");
} else {
  console.log(
    `  =  el saldo (${parsed.saldoActual}) es independiente de la suma de consumos (${Math.round(sumaConsumos)})`
  );
}

console.log("\n=== Consumos ===\n");
check("consumos en pesos", parsed.newChargesArs, 1031880.38);
check("líneas de consumo", parsed.chargeLines.length, 3);
// El IVA sobre intereses está en otra sección: no es un consumo nuevo y
// sumarlo inflaría el total del mes.
const tieneIva = parsed.chargeLines.some((l) => /IVA/i.test(l.description));
check("el IVA quedó afuera", tieneIva, false);

console.log("\n=== Cuotas ===\n");
check("planes detectados", parsed.planVEntries.length, 2);

const planV = parsed.planVEntries.find((p) => p.cupon === "288032");
check("Plan V — cuotas totales", planV?.totalInstallments, 18);
check("Plan V — cuota", planV?.installmentAmount, 482069.57);
check("Plan V — TNA", planV?.tna, 98.03);

const fija = parsed.planVEntries.find((p) => p.cupon === "282179");
check("cuota fija — comercio", fija?.description, "MERPAGO*CARONEGM");
check("cuota fija — total", fija?.totalInstallments, 9);
// TNA 0 acá significa "sin interés, lo subsidia el comercio", no "no se pudo leer".
check("cuota fija — sin interés", fija?.tna, 0);

console.log("\n=== Avisos ===\n");
console.log(parsed.warnings.length === 0 ? "  ninguno" : parsed.warnings.map((w) => "  - " + w).join("\n"));

console.log(`\n${failures === 0 ? "Todo bien." : `${failures} comprobaciones fallaron.`}`);
process.exit(failures === 0 ? 0 : 1);
