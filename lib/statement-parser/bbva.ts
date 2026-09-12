/**
 * Parser específico para el formato de resumen de tarjeta de BBVA
 * Argentina (Visa Signature, probablemente sirve para otras
 * tarjetas del mismo banco). Regex ajustadas a la salida de
 * extractLayoutText() sobre un resumen real.
 *
 * FRÁGIL A PROPÓSITO: si BBVA cambia el diseño del PDF, esto se
 * rompe y hay que ajustar las regex. Es la contrapartida de no usar
 * IA para interpretarlo (ver charla sobre Fase 2). Si algo no
 * matchea, se devuelve null/vacío en ese campo — nunca se inventa
 * un valor.
 */

const MONTHS: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", set: "09", sep: "09", oct: "10", nov: "11", dic: "12",
};

function parseArgDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})-(\w{3})-(\d{2})/i);
  if (!match) return null;
  const [, day, monthAbbr, yearShort] = match;
  const month = MONTHS[monthAbbr.toLowerCase()];
  if (!month) return null;
  return `20${yearShort}-${month}-${day}`;
}

function parseArgNumber(numStr: string): number {
  // Formato argentino: "5.710.670,92" -> 5710670.92
  const cleaned = numStr.trim().replace(/\./g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isNaN(value) ? 0 : value;
}

export interface ParsedPlanVEntry {
  cupon: string;
  firstPeriod: string; // "YYYY-MM"
  currentInstallment: number;
  totalInstallments: number;
  tna: number;
  installmentAmount: number;
  // Nombre del comercio, solo para cuotas fijas ("C.NN/MM") — una
  // refinanciación (PLAN V / CUOTIFICACION) no tiene un comercio
  // propio, es sobre el saldo, así que queda undefined.
  description?: string;
}

export interface ParsedChargeLine {
  description: string;
  amount: number;
}

export interface ParsedStatement {
  cardName: string | null;
  accountLast4: string | null;
  tnaPunitorio: number | null; // tasa nominal anual punitoria (%)
  /**
   * La tasa MENSUAL que declara el resumen, en porcentaje.
   *
   * Vale más que la anual y por eso se lee aparte: el banco no saca la mensual
   * dividiendo la anual por doce. Usa treinta días sobre trescientos sesenta y
   * cinco — 80,5% anual le da 6,616% mensual, no 6,7083%. Está declarada en el
   * resumen al lado de la TNA, así que no hay que deducirla.
   */
  temDeclarada: number | null;
  cierreActual: string | null;
  vencimientoActual: string | null;
  saldoActual: number | null;
  /**
   * Saldo en dólares del encabezado, en USD. Es el dato del banco, no una
   * suma nuestra: mismo criterio que saldoActual. Ver el comentario de
   * usdChargesExcluded para por qué la distinción importa acá.
   */
  saldoActualUsd: number | null;
  pagoMinimo: number | null;
  saldoAnterior: number | null;
  planVEntries: ParsedPlanVEntry[];
  newChargesArs: number; // suma de consumos nuevos en pesos, sin contar Plan V
  /**
   * Lo que el resumen dice que consumiste este mes, sumado por el banco.
   *
   * Es su propia linea de "Total Consumos", e incluye las cuotas del mes. Vale
   * mas que `newChargesArs`, que es la suma de las lineas que pudimos leer:
   * la extraccion por coordenadas deja algunas afuera y ahi el saldo cierra
   * por debajo del real. Paso: en un resumen de Visa se perdieron dos lineas
   * --una cuota y un consumo-- por $ 17.666,66.
   *
   * Mismo criterio que `saldoActualUsd` frente a `usdChargesExcluded`: cuando
   * el banco declara un total, el total del banco manda.
   */
  declaredCharges: number | null;
  /**
   * Suma de las líneas de consumo en dólares que el parser pudo leer, en USD.
   *
   * NO es el total en dólares del resumen: es lo que se pudo reconocer línea
   * por línea, y casi siempre da de menos porque la extracción por
   * coordenadas deja algunas líneas sin su importe. Para mostrarle un total
   * a alguien va saldoActualUsd, que lo dice el banco.
   *
   * Se conserva justamente para poder compararlos: si difieren, es que
   * quedaron líneas sin leer, y eso se avisa en vez de disimularlo.
   */
  usdChargesExcluded: number;
  // Detalle línea por línea de esos mismos consumos nuevos — para
  // poder categorizarlos en fijo/necesario vs. discrecional (spec
  // §2.4). Vacío si el parser no distingue líneas individuales.
  chargeLines: ParsedChargeLine[];
  warnings: string[];
}

/**
 * El total de consumos que declara el resumen en su bloque de resumen de
 * cuenta, entre "SALDO ANTERIOR" y "SALDO ACTUAL".
 *
 * Se acota a esa ventana a proposito: los mismos totales se repiten mas abajo,
 * uno por titular, al pie de cada detalle. Sumar todas las apariciones los
 * contaria dos veces.
 */
export function sumarConsumosDeclarados(lines: string[]): number | null {
  const desde = lines.findIndex((l) => /^SALDO ANTERIOR/i.test(l.trim()));
  if (desde < 0) return null;
  const hasta = lines.findIndex((l, i) => i > desde && /^SALDO ACTUAL/i.test(l.trim()));
  const fin = hasta < 0 ? lines.length : hasta;

  let total: number | null = null;
  for (let i = desde + 1; i < fin; i++) {
    if (!/total consumos/i.test(lines[i])) continue;
    // El primero de la linea es el de pesos; el segundo, si esta, los dolares.
    const m = lines[i].match(/-?[\d.]+,\d{2}/);
    if (!m) continue;
    total = (total ?? 0) + parseArgNumber(m[0]);
  }
  return total == null ? null : Math.round(total * 100) / 100;
}

export function parseBbvaStatement(layoutText: string): ParsedStatement {
  const lines = layoutText.split("\n").map((l) => l.trim());
  const warnings: string[] = [];

  // --- Nombre de la tarjeta y cuenta ---
  // Formato: "Visa Signature cuenta 0805192166   CONSOLIDADO"
  let cardName: string | null = null;
  let accountLast4: string | null = null;
  const cardLine = lines.find((l) => /\bcuenta\s+\d+/i.test(l));
  if (cardLine) {
    const match = cardLine.match(/^(.+?)\s+cuenta\s+(\d+)/i);
    if (match) {
      cardName = match[1].trim();
      accountLast4 = match[2].slice(-4);
    }
  } else {
    warnings.push("No se pudo detectar el nombre de la tarjeta.");
  }

  // --- Tasa punitoria (TNA $) ---
  // Formato observado con más frecuencia: "Tasas" solo en su propia
  // línea (la extracción por coordenadas Y de pdfjs no siempre
  // agrupa el label con los valores en la misma fila aunque se vean
  // alineados en el PDF renderizado), con los valores en la línea
  // siguiente: "69,440 %   -   5,707 %   -" (TNA $, TNA U$S, TEM $,
  // TEM U$S, en ese orden). También se acepta el caso en que sí
  // vengan juntos en una sola línea, por si algún resumen los trae así.
  //
  // Las cuatro ranuras son TNA $, TNA U$S, TEM $, TEM U$S, y las que no
  // aplican vienen como "-". Se leen la primera y la TERCERA: la mensual vale
  // más que la anual porque el banco no la saca dividiendo por doce, usa
  // 30/365 — 69,44% anual le da 5,707% mensual, no 5,787%.
  let tnaPunitorio: number | null = null;
  let temDeclarada: number | null = null;

  const tasasSameLineIdx = lines.findIndex((l) => /^Tasas\s+[\d,]+\s*%/.test(l));
  const tasasLabelIdx = lines.findIndex((l) => l.trim() === "Tasas");
  const tasasLine =
    tasasSameLineIdx >= 0
      ? lines[tasasSameLineIdx].replace(/^Tasas\s+/, "")
      : tasasLabelIdx >= 0
        ? lines[tasasLabelIdx + 1]
        : undefined;

  if (tasasLine) {
    // Cada ranura es un número o un guion; el orden es lo que las identifica.
    const slots = tasasLine.match(/[\d,]+\s*%|-/g) ?? [];
    const valor = (i: number) => {
      const raw = slots[i];
      if (!raw || raw === "-") return null;
      return parseArgNumber(raw.replace(/\s*%/, ""));
    };
    tnaPunitorio = valor(0);
    temDeclarada = valor(2);
  }

  // --- Bloque de cabecera: CIERRE ACTUAL / VENCIMIENTO ACTUAL / SALDO ACTUAL $ / SALDO ACTUAL U$S / PAGO MÍNIMO $ ---
  let cierreActual: string | null = null;
  let vencimientoActual: string | null = null;
  let saldoActual: number | null = null;
  let saldoActualUsd: number | null = null;
  let pagoMinimo: number | null = null;

  const headerLabelIdx = lines.findIndex((l) => l.includes("CIERRE ACTUAL") && l.includes("VENCIMIENTO ACTUAL"));
  if (headerLabelIdx >= 0 && lines[headerLabelIdx + 1]) {
    const valueLine = lines[headerLabelIdx + 1];
    const match = valueLine.match(
      /(\d{2}-\w{3}-\d{2})\s+(\d{2}-\w{3}-\d{2})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i
    );
    if (match) {
      cierreActual = parseArgDate(match[1]);
      vencimientoActual = parseArgDate(match[2]);
      saldoActual = parseArgNumber(match[3]);
      // La columna de dólares venía capturada y se descartaba: por eso el
      // total en USD se mostraba sumando líneas sueltas, que es justo lo que
      // este parser tiene prohibido hacer con el saldo en pesos.
      saldoActualUsd = parseArgNumber(match[4]);
      pagoMinimo = parseArgNumber(match[5]);
    } else {
      warnings.push("No se pudo leer la línea de cierre/vencimiento/saldo/mínimo.");
    }
  } else {
    warnings.push("No se encontró el bloque de cabecera (CIERRE ACTUAL).");
  }

  // --- Saldo anterior ---
  let saldoAnterior: number | null = null;
  const saldoAnteriorLine = lines.find((l) => l.startsWith("SALDO ANTERIOR"));
  if (saldoAnteriorLine) {
    const match = saldoAnteriorLine.match(/SALDO ANTERIOR\s+(-?[\d.,]+)/);
    if (match) saldoAnterior = parseArgNumber(match[1]);
  } else {
    warnings.push("No se encontró la línea de SALDO ANTERIOR.");
  }

  // --- Líneas de Plan V ---
  // Formato: "26-Nov-25   VISA PLAN V 9-18 (TNA 98,03)   288032   482.069,57"
  // CUOTIFICACION y FINANC DE SALDO son el mismo producto (compra o
  // saldo refinanciado en cuotas con interés) con otra etiqueta: BBVA
  // usa CUOTIFICACION en Mastercard, y desde 2026 pasó a FINANC DE
  // SALDO en los resúmenes de Visa. Mismo layout de columnas, mismo
  // regex, solo cambia el nombre del producto.
  //
  // Verificado contra un resumen real de septiembre 2026: las cinco
  // refinanciaciones venían como "FINANC DE SALDO n-m (TNA x)" y el
  // parser no solo las perdía, sino que además las contaba como
  // consumos nuevos, inflando el total del mes en $2.538.333.
  const planVEntries: ParsedPlanVEntry[] = [];
  const planVRegex =
    /^(\d{2}-\w{3}-\d{2})\s+(?:VISA PLAN V|CUOTIFICACION|FINANC DE SALDO)\s+(\d+)-(\d+)\s+\(TNA\s+([\d,]+)\)\s+(\d{6})\s+(-?[\d.,]+)\s*$/i;

  for (const line of lines) {
    const match = line.match(planVRegex);
    if (!match) continue;

    const [, dateStr, currentInst, totalInst, tnaStr, cupon, amountStr] = match;
    const firstPeriodFull = parseArgDate(dateStr);
    if (!firstPeriodFull) continue;

    planVEntries.push({
      cupon,
      firstPeriod: firstPeriodFull.slice(0, 7), // "YYYY-MM"
      currentInstallment: Number(currentInst),
      totalInstallments: Number(totalInst),
      tna: parseArgNumber(tnaStr),
      installmentAmount: parseArgNumber(amountStr),
    });
  }

  // --- Compras en cuotas fijas SIN interés ---
  // Formato: "17-Abr-26   MERPAGO*CARONEGM   C.04/09   282179   36.726,66"
  // A diferencia de CUOTIFICACION/PLAN V, esta línea nunca trae
  // "(TNA X)" al lado — esa ausencia es la señal real de que el
  // comercio subsidia el interés (promo "cuotas sin interés"), no un
  // dato que el parser no pudo leer. TNA queda en 0 a propósito;
  // si algún banco alguna vez cobra interés en este formato sin
  // anotarlo en la línea, se corrige a mano en el detalle de la
  // deuda, igual que cualquier otro dato estimado.
  const fixedInstallmentRegex =
    /^(\d{2}-\w{3}-\d{2})\s+(.+?)\s+C\.(\d{2})\/(\d{2})\s+(\d{6})\s+(-?[\d.,]+)(?:\s+-?[\d.,]+)?\s*$/i;

  for (const line of lines) {
    const match = line.match(fixedInstallmentRegex);
    if (!match) continue;

    const [, dateStr, description, currentInst, totalInst, cupon, amountStr] = match;
    const firstPeriodFull = parseArgDate(dateStr);
    if (!firstPeriodFull) continue;

    planVEntries.push({
      cupon,
      firstPeriod: firstPeriodFull.slice(0, 7),
      currentInstallment: Number(currentInst),
      totalInstallments: Number(totalInst),
      tna: 0,
      installmentAmount: parseArgNumber(amountStr),
      description: description.trim(),
    });
  }

  // --- Consumos nuevos (no Plan V) en pesos ---
  // Formato general: "DD-Mon-YY   DESCRIPCIÓN   CUPON(6 dígitos)   MONTO   [MONTO_USD]"
  //
  // IMPORTANTE: solo miramos líneas DENTRO de las secciones que
  // arrancan con "Consumos ..." — la sección "Impuestos, cargos e
  // intereses" también tiene líneas con fecha al principio (ajustes
  // de IVA sobre Plan V, intereses, etc.) que NO son consumos
  // nuevos y arruinarían la suma si las mezclamos.
  const consumptionRegex =
    /^(\d{2}-\w{3}-\d{2})\s+(.+?)\s+(\d{6})\s+(-?[\d.,]+)(?:\s+(-?[\d.,]+))?\s*$/;

  let newChargesArs = 0;
  let usdChargesExcluded = 0;
  let insideConsumptionSection = false;
  const chargeLines: ParsedChargeLine[] = [];

  for (const line of lines) {
    if (/^Consumos\s/i.test(line)) {
      insideConsumptionSection = true;
      continue;
    }
    if (/^Impuestos, cargos e intereses/i.test(line) || /^Legales y avisos/i.test(line)) {
      insideConsumptionSection = false;
      continue;
    }
    if (!insideConsumptionSection) continue;

    if (line.includes("VISA PLAN V")) continue; // ya procesado arriba
    if (line.includes("CUOTIFICACION")) continue; // ya procesado arriba
    if (line.includes("FINANC DE SALDO")) continue; // ya procesado arriba
    // Red de seguridad para cuando el banco vuelva a renombrar el
    // producto: un consumo nuevo nunca trae su propia tasa al lado. Si
    // la línea dice "(TNA ...)", es financiación y no un gasto del mes,
    // se llame como se llame.
    if (/\(TNA\s/i.test(line)) continue;
    if (/\bC\.\d{2}\/\d{2}\b/.test(line)) continue; // ya procesado arriba (cuotas fijas)
    if (line.includes("TOTAL CONSUMOS")) continue;
    if (line.includes("NRO. CUPÓN")) continue; // encabezado de tabla

    const match = line.match(consumptionRegex);
    if (!match) continue;

    const [, , description, , amount1Str, amount2Str] = match;
    const isUsdOnly = /USD/i.test(description) && !amount2Str;

    if (isUsdOnly) {
      usdChargesExcluded += parseArgNumber(amount1Str);
    } else {
      const amount = parseArgNumber(amount1Str);
      newChargesArs += amount;
      chargeLines.push({ description: description.trim(), amount });
    }
  }

  // Si el banco declara un saldo en dólares y las líneas que pudimos leer no
  // llegan a ese total, faltaron líneas. Avisarlo importa: sin el aviso, el
  // faltante se ve como "gastaste menos en dólares", que es una conclusión
  // falsa sacada de una limitación nuestra.
  /*
   * El total que declara el banco, y el aviso cuando no coincide con lo que
   * pudimos leer: si difieren, faltaron lineas, y es mejor decirlo que dejar
   * que el saldo cierre bajo sin explicacion.
   */
  const declaredCharges = sumarConsumosDeclarados(lines);
  const leidoConCuotas =
    Math.round((newChargesArs + planVEntries.reduce((s, e) => s + e.installmentAmount, 0)) * 100) / 100;
  if (declaredCharges != null && Math.abs(declaredCharges - leidoConCuotas) > 0.01) {
    warnings.push(
      `El resumen declara $ ${declaredCharges} de consumos y linea por linea pudimos leer ` +
        `$ ${leidoConCuotas}. Vale el del resumen, y es el que va al campo de consumos.`
    );
  }

  const usdRounded = Math.round(usdChargesExcluded * 100) / 100;
  if (saldoActualUsd != null && saldoActualUsd > 0 && usdRounded < saldoActualUsd - 0.01) {
    warnings.push(
      `El resumen cierra con US$ ${saldoActualUsd} en dólares, pero solo pudimos leer ` +
        `US$ ${usdRounded} línea por línea. El que vale es el del resumen, y es el que va al ` +
        `campo de dólares: revisalo antes de ponerle la cotización.`
    );
  }

  return {
    cardName,
    accountLast4,
    tnaPunitorio,
    temDeclarada,
    cierreActual,
    vencimientoActual,
    saldoActual,
    saldoActualUsd,
    pagoMinimo,
    saldoAnterior,
    planVEntries,
    declaredCharges,
    newChargesArs: Math.round(newChargesArs * 100) / 100,
    usdChargesExcluded: Math.round(usdChargesExcluded * 100) / 100,
    chargeLines,
    warnings,
  };
}
