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
  /**
   * La tasa mensual que declara el resumen, en porcentaje (6.616, no 0.06616).
   *
   * Va aparte de la anual porque el banco no la saca dividiendo por doce: usa
   * 30/365. Con 80,5% anual declara 6,616% mensual y nosotros calculábamos
   * 6,7083% — 1,4% de más, todos los meses, sobre todo el saldo. Medido contra
   * dos resúmenes reales, de dos bancos distintos.
   */
  monthlyRate?: number | null;
  period?: string | null;
  dueDate?: string | null;
  newCharges?: number | null;
  minimumPayment?: number | null;
  previousBalance?: number | null;
  statementBalance?: number | null;
  /** Total en dólares que declara el resumen. Dato del banco. */
  usdBalance?: number | null;
  /** Lo que se pudo sumar línea por línea. Sirve para comparar, no para mostrar. */
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
  } catch (error) {
    // Los resúmenes de varios bancos vienen cifrados con el DNI. Se distingue
    // ese caso del resto porque la solución es concreta y distinta: no es que
    // el archivo esté roto, es que hay que guardarlo sin la protección.
    //
    // No pedimos la contraseña ni la guardamos: abrir el PDF con ella
    // significaría que la app maneja una clave personal, y no hay ninguna
    // razón para que lo haga.
    const isProtected = /password/i.test(
      error instanceof Error ? `${error.name} ${error.message}` : String(error)
    );

    /*
     * El error de verdad, al log del servidor.
     *
     * Sin esto, todo lo que no sea una contraseña se colapsa en un solo
     * mensaje —"puede estar dañado o no ser un resumen"— y no queda rastro de
     * la causa en ningún lado: ni en la pantalla, que no debe mostrarla, ni en
     * el servidor. Depurar por qué un PDF real no entra se vuelve adivinar.
     *
     * Va el nombre y el mensaje del error, no el archivo ni su contenido.
     */
    if (!isProtected) {
      console.error(
        "[parse-statement] no se pudo leer el PDF:",
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      );
    }

    return {
      ok: false,
      message: isProtected
        ? "Ese PDF está protegido con contraseña. Abrilo con la clave del banco (suele ser tu DNI), guardá una copia sin protección y subí esa."
        : "No pudimos abrir ese PDF. Puede estar dañado o no ser un resumen. Cargá los números a mano abajo.",
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
    monthlyRate: parsed.temDeclarada,
    // El período del resumen es el del cierre, no el de hoy.
    period: parsed.cierreActual ? parsed.cierreActual.slice(0, 7) : null,
    dueDate: parsed.vencimientoActual,
    /*
     * El total que declara el resumen, con las cuotas del mes adentro, y solo
     * si no lo trae la suma de lo que pudimos leer. La linea por linea deja
     * afuera las que la extraccion por coordenadas no alcanza a armar, y el
     * saldo cerraba por debajo del real sin que nada lo dijera.
     */
    newCharges: parsed.declaredCharges ?? parsed.newChargesArs,
    minimumPayment: parsed.pagoMinimo,
    previousBalance: parsed.saldoAnterior,
    statementBalance: parsed.saldoActual,
    usdBalance: parsed.saldoActualUsd,
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
