/**
 * Parseo y formato de plata y tasas, portado de handoff/prototipo.html.
 *
 * El prototipo guarda tasas y montos como texto tal como los muestra
 * ("98,03%", "$ 1.300.000") y los parsea al usarlos. Acá entran como número
 * desde la base, pero las funciones de parseo se conservan porque la carga
 * desde un resumen y la edición a mano siguen llegando como texto.
 */

/** "98,03%" -> 0.081691... (tasa mensual). Nominal anual dividida por 12. */
export function monthlyRateFromAnnual(annual: number | string | null | undefined): number {
  if (annual == null) return 0;
  const n =
    typeof annual === "number"
      ? annual
      : parseFloat(String(annual).replace("%", "").replace(",", ".")) || 0;
  return n / 100 / 12;
}

/** "$ 1.300.000" -> 1300000. Se queda solo con los dígitos, como el prototipo. */
export function parseMoney(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  return Number(String(v).replace(/[^0-9]/g, "")) || 0;
}

/**
 * Pesos sin decimales, separador de miles con punto.
 *
 * El menos es U+2212 y no un guion, como en el prototipo: en una tipografia
 * de cifras tabulares el menos matematico tiene el ancho de un digito y el
 * guion no, asi que una columna de montos con signo se desalinea sola.
 */
export function formatMoney(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}$ ${Math.abs(rounded).toLocaleString("es-AR")}`;
}

/**
 * Dólares. Va aparte de formatMoney porque el parser devuelve los consumos en
 * USD en su moneda original, y mostrarlos con signo de peso los haría ver
 * ridículamente baratos: "$ 102" cuando son 102 dólares.
 */
export function formatUsd(n: number): string {
  return `US$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
