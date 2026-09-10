"use server";

/**
 * La cotización del dólar de hoy, para prellenar el campo del resumen.
 *
 * El PDF no la trae —los consumos en dólares se pagan a la cotización del
 * cierre, y el resumen la aplica sin declararla— así que sin esto el único
 * camino era que la persona la buscara afuera y la copiara a mano.
 *
 * Prellena, no decide: lo que vuelve de acá va a un campo editable, igual que
 * lo que sale del parser de PDF. Es una cotización de referencia, no la que
 * usó el banco, y esa distinción la dice la pantalla.
 *
 * Se pide la OFICIAL (venta) y no la "tarjeta". La de tarjeta trae adentro las
 * percepciones e impuestos, y el resumen ya te los cobra aparte como líneas en
 * pesos: convertir con ella los contaría dos veces. Es el mismo error que este
 * campo existe para evitar, un escalón más arriba.
 */

const SOURCE = "https://dolarapi.com/v1/dolares/oficial";

export type UsdRateResult =
  | { ok: true; rate: number; updatedAt: string | null }
  | { ok: false; message: string };

export async function fetchUsdRate(): Promise<UsdRateResult> {
  try {
    const response = await fetch(SOURCE, {
      // Una cotización de hace una hora sirve; una de la semana pasada no.
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return { ok: false, message: "No pudimos traer la cotización. Cargala a mano." };
    }

    const data = (await response.json()) as { venta?: unknown; fechaActualizacion?: unknown };
    const rate = Number(data.venta);

    // Un cero o un NaN llegando como cotización dejaría los dólares en cero sin
    // decir nada, que es peor que no traer nada.
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, message: "La cotización que vino no se entiende. Cargala a mano." };
    }

    return {
      ok: true,
      rate,
      updatedAt: typeof data.fechaActualizacion === "string" ? data.fechaActualizacion : null,
    };
  } catch {
    // Sin internet, con el servicio caído o si tarda demasiado: el campo sigue
    // estando y se puede escribir. Que esto falle no bloquea cargar el resumen.
    return { ok: false, message: "No pudimos traer la cotización. Cargala a mano." };
  }
}
