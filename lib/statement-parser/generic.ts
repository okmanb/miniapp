/**
 * Parser genérico de "mejor esfuerzo" para bancos que todavía no
 * tienen un parser a medida. Busca patrones comunes a la mayoría de
 * los resúmenes argentinos (SALDO, VENCIMIENTO, MÍNIMO) en vez de
 * depender del layout exacto de un banco.
 *
 * Es deliberadamente conservador: solo completa lo que encuentra
 * con confianza razonable, y avisa con claridad qué no pudo sacar
 * en vez de arriesgar un valor inventado. Los consumos nuevos NO
 * se intentan sumar acá — sin conocer la estructura de la tabla de
 * transacciones de este banco en particular, es más probable
 * mezclar cosas mal que ayudar.
 */

import type { ParsedStatement } from "./bbva";

function parseArgNumber(numStr: string): number {
  const cleaned = numStr.trim().replace(/-$/, "").replace(/\./g, "").replace(",", ".");
  const isNegative = numStr.trim().endsWith("-") || numStr.trim().startsWith("-");
  const value = parseFloat(cleaned.replace(/^-/, ""));
  if (Number.isNaN(value)) return 0;
  return isNegative ? -value : value;
}

// Intenta varios formatos de fecha comunes: "30-Jul-26", "30 Jul 26",
// "30.07.26", "30/07/2026".
function parseAnyDate(dateStr: string): string | null {
  const MONTHS: Record<string, string> = {
    ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
    jul: "07", ago: "08", set: "09", sep: "09", oct: "10", nov: "11", dic: "12",
  };

  let match = dateStr.match(/(\d{1,2})[-\s](\w{3})[-\s](\d{2,4})/i);
  if (match) {
    const [, day, monthAbbr, year] = match;
    const month = MONTHS[monthAbbr.toLowerCase()];
    if (month) {
      const yearFull = year.length === 2 ? `20${year}` : year;
      return `${yearFull}-${month}-${day.padStart(2, "0")}`;
    }
  }

  match = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (match) {
    const [, day, month, year] = match;
    const yearFull = year.length === 2 ? `20${year}` : year;
    return `${yearFull}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

export function parseGenericStatement(layoutText: string): ParsedStatement {
  const lines = layoutText.split("\n").map((l) => l.trim());
  const warnings: string[] = [
    "No reconocemos este banco todavía — completamos lo que pudimos detectar con patrones genéricos, revisá todo con cuidado antes de guardar.",
  ];

  let saldoActual: number | null = null;
  let pagoMinimo: number | null = null;
  let vencimientoActual: string | null = null;
  let tnaPunitorio: number | null = null;

  const saldoLine = lines.find((l) => /SALDO\s+ACTUAL/i.test(l) && /[\d.,]+/.test(l));
  if (saldoLine) {
    const match = saldoLine.match(/([\d.,]+)/g);
    if (match && match.length > 0) saldoActual = parseArgNumber(match[match.length - 1]);
  } else {
    warnings.push('No encontramos "SALDO ACTUAL" — completalo a mano.');
  }

  const minimoLine = lines.find((l) => /PAGO\s+M[IÍ]N/i.test(l) && /[\d.,]+/.test(l));
  if (minimoLine) {
    const match = minimoLine.match(/([\d.,]+)/g);
    if (match && match.length > 0) pagoMinimo = parseArgNumber(match[match.length - 1]);
  } else {
    warnings.push('No encontramos "PAGO MÍNIMO" — completalo a mano.');
  }

  const vencimientoLine = lines.find(
    (l) => /VENCIMIENTO/i.test(l) && (/\d{1,2}[-\s.\/]\w{0,3}[-\s.\/]?\d{2,4}/.test(l))
  );
  if (vencimientoLine) {
    const dateMatch = vencimientoLine.match(/(\d{1,2}[-\s.\/]\w{2,3}[-\s.\/]?\d{2,4})/);
    if (dateMatch) vencimientoActual = parseAnyDate(dateMatch[1]);
  }
  if (!vencimientoActual) {
    warnings.push('No encontramos la fecha de "VENCIMIENTO" — completala a mano.');
  }

  const tnaLine = lines.find((l) => /TNA/i.test(l) && /[\d,]+\s*%/.test(l));
  if (tnaLine) {
    const match = tnaLine.match(/([\d,]+)\s*%/);
    if (match) tnaPunitorio = parseArgNumber(match[1]);
  }

  warnings.push(
    "No intentamos sumar los consumos nuevos automáticamente para este banco — cargalos a mano mirando el resumen."
  );

  return {
    cardName: null,
    accountLast4: null,
    tnaPunitorio,
    cierreActual: null,
    vencimientoActual,
    saldoActual,
    pagoMinimo,
    saldoAnterior: null,
    planVEntries: [],
    newChargesArs: 0,
    usdChargesExcluded: 0,
    chargeLines: [],
    warnings,
  };
}
