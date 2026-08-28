/**
 * Parser para el formato de resumen de Banco Patagonia (Mastercard).
 * Layout bien distinto a BBVA: fechas DD.MM.YY (con puntos). Las
 * cuotas de comercio van mezcladas con los consumos normales,
 * marcadas con "Cuota NN/MM" en la descripción — a diferencia de
 * BBVA no hay una línea de cabecera separada por cupón, así que se
 * extraen del mismo renglón de consumo. Igual que las compras
 * "C.NN/MM" de BBVA, nunca traen una tasa al lado (son cuotas sin
 * interés del comercio), así que quedan con tna: 0.
 */

import type { ParsedChargeLine, ParsedPlanVEntry, ParsedStatement } from "./bbva";

const MONTHS: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", set: "09", sep: "09", oct: "10", nov: "11", dic: "12",
};

// "30 Jul 26" -> "2026-07-30" (fechas de cabecera, con nombre de mes)
function parseSpacedDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{2})/i);
  if (!match) return null;
  const [, day, monthAbbr, yearShort] = match;
  const month = MONTHS[monthAbbr.toLowerCase()];
  if (!month) return null;
  return `20${yearShort}-${month}-${day.padStart(2, "0")}`;
}

// "22.12.25" -> "2025-12-22" (fechas de transacciones, numéricas)
function parseDotDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, day, month, yearShort] = match;
  return `20${yearShort}-${month}-${day}`;
}

function parseArgNumber(numStr: string): number {
  const cleaned = numStr.trim().replace(/-$/, "").replace(/\./g, "").replace(",", ".");
  const isNegative = numStr.trim().endsWith("-");
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return isNegative ? -value : value;
}

const EXCLUDED_LINE_KEYWORDS = ["SALDO ANTERIOR", "SU PAGO", "TRANSFERENCIA"];

export function parsePatagoniaStatement(layoutText: string): ParsedStatement {
  const lines = layoutText.split("\n").map((l) => l.trim());
  const warnings: string[] = [];

  // --- Nombre de tarjeta / cuenta ---
  let accountLast4: string | null = null;
  const tarjetaLine = lines.find((l) => /^Tarjeta\s+\d{4}\s+Total Consumos/i.test(l));
  if (tarjetaLine) {
    const match = tarjetaLine.match(/^Tarjeta\s+(\d{4})/i);
    if (match) accountLast4 = match[1];
  }
  const cardName = "Mastercard Banco Patagonia";

  // --- Cabecera: CIERRE ACTUAL / VENCIMIENTO+SALDO+MÍNIMO ---
  let cierreActual: string | null = null;
  let vencimientoActual: string | null = null;
  let saldoActual: number | null = null;
  let pagoMinimo: number | null = null;

  const cierreLine = lines.find((l) => l.includes("CIERRE ACTUAL:"));
  if (cierreLine) {
    const match = cierreLine.match(/CIERRE ACTUAL:\s*(\d{1,2}\s+\w{3}\s+\d{2})/i);
    if (match) cierreActual = parseSpacedDate(match[1]);
  } else {
    warnings.push("No se encontró CIERRE ACTUAL.");
  }

  const headerLabelIdx = lines.findIndex((l) => l.includes("VENCIMIENTO") && l.includes("PAGO MIN.$"));
  if (headerLabelIdx >= 0 && lines[headerLabelIdx + 1]) {
    const valueLine = lines[headerLabelIdx + 1];
    const match = valueLine.match(/(\d{1,2}\s+\w{3}\s+\d{2})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
    if (match) {
      vencimientoActual = parseSpacedDate(match[1]);
      saldoActual = parseArgNumber(match[2]);
      pagoMinimo = parseArgNumber(match[4]);
    } else {
      warnings.push("No se pudo leer la línea de vencimiento/saldo/mínimo.");
    }
  } else {
    warnings.push("No se encontró el bloque de cabecera (VENCIMIENTO).");
  }

  // --- Saldo anterior ---
  let saldoAnterior: number | null = null;
  const saldoAnteriorLine = lines.find((l) => l.includes("SALDO ANTERIOR $"));
  if (saldoAnteriorLine) {
    const match = saldoAnteriorLine.match(/SALDO ANTERIOR\s*\$?\s*([\d.,]+)/);
    if (match) saldoAnterior = parseArgNumber(match[1]);
  }

  // --- Tasa punitoria (TNA $) ---
  let tnaPunitorio: number | null = null;
  const tnaLine = lines.find((l) => /TNA\s*\$/.test(l));
  if (tnaLine) {
    const match = tnaLine.match(/TNA\s*\$\s*([\d,]+)\s*%/);
    if (match) tnaPunitorio = parseArgNumber(match[1]);
  }

  // --- Consumos: todo entre el header de la tabla y "Tarjeta XXXX Total Consumos" ---
  const tableStartIdx = lines.findIndex((l) => l.includes("DETALLE DE TRANSACCION"));
  const tableEndIdx = lines.findIndex((l) => /^Tarjeta\s+\d{4}\s+Total Consumos/i.test(l));

  let newChargesArs = 0;
  let usdChargesExcluded = 0;
  const chargeLines: ParsedChargeLine[] = [];
  const planVEntries: ParsedPlanVEntry[] = [];
  // Una compra en cuotas queda en la misma línea de consumo que
  // cualquier otra, con "Cuota NN/MM" pegado al final de la
  // descripción (ej. "MERPAGO*MERCADOLIBRE Cuota 08/09") — nunca
  // trae una tasa al lado, así que queda con tna: 0 igual que las
  // compras "C.NN/MM" de BBVA.
  const cuotaSuffixRegex = /\bCuota\s+(\d{2})\/(\d{2})\s*$/i;

  if (tableStartIdx >= 0 && tableEndIdx > tableStartIdx) {
    const consumptionLineRegex = /^(\d{2}\.\d{2}\.\d{2})\s+(?:(\d+\*?)\s+)?(.+?)\s+(-?[\d.,]+-?)\s*$/;

    for (let i = tableStartIdx + 1; i < tableEndIdx; i++) {
      const line = lines[i];
      if (!line) continue;
      if (EXCLUDED_LINE_KEYWORDS.some((kw) => line.includes(kw))) continue;

      const match = line.match(consumptionLineRegex);
      if (!match) continue;

      const [, dateStr, cuponRaw, description, amountStr] = match;
      const isUsdOnly = /USD/i.test(description);

      if (isUsdOnly) {
        usdChargesExcluded += Math.abs(parseArgNumber(amountStr));
        continue;
      }

      const cuotaMatch = description.match(cuotaSuffixRegex);
      if (cuotaMatch && cuponRaw) {
        const firstPeriodFull = parseDotDate(dateStr);
        planVEntries.push({
          cupon: cuponRaw.replace(/\*$/, ""),
          firstPeriod: firstPeriodFull ? firstPeriodFull.slice(0, 7) : "",
          currentInstallment: Number(cuotaMatch[1]),
          totalInstallments: Number(cuotaMatch[2]),
          tna: 0,
          installmentAmount: parseArgNumber(amountStr),
          description: description.replace(cuotaSuffixRegex, "").trim(),
        });
        continue;
      }

      const amount = parseArgNumber(amountStr);
      newChargesArs += amount;
      chargeLines.push({ description: description.trim(), amount });
    }
  } else {
    warnings.push("No se pudo delimitar la tabla de consumos.");
  }

  return {
    cardName,
    accountLast4,
    tnaPunitorio,
    cierreActual,
    vencimientoActual,
    saldoActual,
    pagoMinimo,
    saldoAnterior,
    planVEntries,
    newChargesArs: Math.round(newChargesArs * 100) / 100,
    usdChargesExcluded: Math.round(usdChargesExcluded * 100) / 100,
    chargeLines,
    warnings,
  };
}
