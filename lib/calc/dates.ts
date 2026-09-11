/**
 * Fechas de vencimiento. Vive en lib/calc porque lo usan tanto el servidor
 * (detalle de deuda) como el cliente (onboarding), y lib/data arrastra el
 * cliente de Supabase a cualquiera que lo importe.
 */

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * El día del resumen es el dato; la fecha del próximo vencimiento se deriva de
 * hoy. Si el día ya pasó este mes, el vencimiento vigente es el del mes que
 * viene. Se topea al último día del mes: un vencimiento el 31 no se cae a
 * marzo en febrero.
 */
export function nextDueDate(dueDay: number, today = new Date()): Date {
  const clamp = (year: number, monthIndex: number) =>
    new Date(year, monthIndex, Math.min(dueDay, new Date(year, monthIndex + 1, 0).getDate()));

  const thisMonth = clamp(today.getFullYear(), today.getMonth());
  if (thisMonth.getDate() >= today.getDate()) return thisMonth;
  return clamp(today.getFullYear(), today.getMonth() + 1);
}

/** "10 de septiembre de 2026" */
export function formatLongDate(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`;
}

/** "10 de septiembre" — sin año, para cuando el año se sobreentiende. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]}`;
}

/**
 * "2026-08-10" -> "10 de agosto de 2026".
 *
 * Parsea a mano en vez de `new Date(iso)`: ese constructor trata una fecha sin
 * hora como UTC, y en Argentina —UTC-3— la medianoche UTC cae el día anterior,
 * así que el 10 se mostraría como 9. Un error de un día que solo aparece de
 * este lado del mundo.
 */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

/** "2026-08" -> "agosto de 2026". Para cuando no se sabe el día. */
export function formatPeriodLong(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return `${MONTHS_ES[month - 1]} de ${year}`;
}

/**
 * Cuántos días faltan, contando por día calendario y no por horas: si vence
 * mañana a la mañana, falta 1 día, no 0 porque no pasaron 24 horas.
 */
export function daysUntil(date: Date, today = new Date()): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** "hoy" / "mañana" / "en 3 días" */
export function dueInLabel(days: number): string {
  if (days <= 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  return `vence en ${days} días`;
}
