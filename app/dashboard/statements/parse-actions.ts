"use server";

import { extractLayoutText } from "@/lib/statement-parser/pdf-layout";
import { parseStatement } from "@/lib/statement-parser";

/**
 * Leer un PDF de resumen y devolver lo que se pudo extraer.
 *
 * Esto NO guarda nada. Solo prellena el formulario para que la persona
 * revise antes de confirmar: el parser está atado a la maquetación del PDF de
 * cada banco y se rompe cuando el banco la cambia. Guardar directo lo que
 * salga de acá sería confiarle a una regex el saldo de una tarjeta.
 *
 * Cuando un campo no se puede leer se devuelve null y se suma un aviso. Nunca
 * se inventa un valor: un cero puesto por nosotros es indistinguible de un
 * cero real del resumen.
 */

export interface ParsedInstallment {
  cupon: string;
  description: string | null;
  firstPeriod: string;
  currentInstallment: number;
  totalInstallments: number;
  installmentAmount: number;
  tna: number;
}

export interface ParseResult {
  ok: boolean;
  message: string | null;
  /** Nombre del archivo, para que se vea cuál se leyó. */
  fileName?: string;
  cardName?: string | null;
  accountLast4?: string | null;
  annualRate?: number | null;
  period?: string | null;
  dueDate?: string | null;
  newCharges?: number | null;
  minimumPayment?: number | null;
  previousBalance?: number | null;
  statementBalance?: number | null;
  usdExcluded?: number;
  installments?: ParsedInstallment[];
  warnings?: string[];
}

/** 8 MB: un resumen de tarjeta rara vez pasa de dos. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function parseStatementPdf(formData: FormData): Promise<ParseResult> {
  const file = formData.get("pdf");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Elegí el PDF del resumen." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "El archivo pesa más de 8 MB. ¿Seguro que es el resumen?" };
  }
  // El tipo que manda el browser no es de fiar, pero descarta lo obvio.
  if (file.type && file.type !== "application/pdf") {
    return { ok: false, message: "Tiene que ser un PDF, no una foto ni una captura." };
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractLayoutText(buffer);
  } catch {
    return {
      ok: false,
      message:
        "No pudimos abrir ese PDF. Si está protegido con contraseña, guardalo sin contraseña y probá de nuevo.",
    };
  }

  if (text.trim().length < 50) {
    return {
      ok: false,
      message:
        "El PDF no tiene texto adentro — parece un escaneo. Cargá los números a mano abajo.",
    };
  }

  const parsed = parseStatement(text);

  return {
    ok: true,
    message: null,
    fileName: file.name,
    cardName: parsed.cardName,
    accountLast4: parsed.accountLast4,
    annualRate: parsed.tnaPunitorio,
    // El período del resumen es el del cierre, no el de hoy.
    period: parsed.cierreActual ? parsed.cierreActual.slice(0, 7) : null,
    dueDate: parsed.vencimientoActual,
    newCharges: parsed.newChargesArs,
    minimumPayment: parsed.pagoMinimo,
    previousBalance: parsed.saldoAnterior,
    statementBalance: parsed.saldoActual,
    usdExcluded: parsed.usdChargesExcluded,
    installments: parsed.planVEntries.map((entry) => ({
      cupon: entry.cupon,
      description: entry.description ?? null,
      firstPeriod: entry.firstPeriod,
      currentInstallment: entry.currentInstallment,
      totalInstallments: entry.totalInstallments,
      installmentAmount: entry.installmentAmount,
      tna: entry.tna,
    })),
    warnings: parsed.warnings,
  };
}
