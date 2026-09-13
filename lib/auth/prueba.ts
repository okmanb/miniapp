/**
 * Las cuentas de prueba.
 *
 * Probar sin cuenta ya no es una pantalla suelta: el tablero de la prueba es
 * el tablero de verdad, con una sesión anónima de Supabase detrás. Esa cuenta
 * es igual a cualquier otra —su propio `auth.uid()`, sus propias filas, las
 * mismas políticas de RLS— con una sola diferencia: no tiene mail, así que
 * nadie puede volver a abrirla, ni siquiera quien la creó.
 *
 * Por eso vive poco y se avisa todo el tiempo. A las HORAS_DE_PRUEBA horas de
 * creada la borra un cron (migración 013), y con ella se van en cascada las
 * deudas, los pagos y los resúmenes que haya cargado. Guardarla es ponerle un
 * mail: ahí deja de ser anónima y el cron no la mira más.
 *
 * ## El número vive en dos lados y tiene que coincidir
 *
 * Acá y en el `cron.schedule` de la migración 013. No hay forma de que uno lea
 * al otro —el cron es SQL en la base, esto es TypeScript en el servidor— así
 * que si cambia, cambian los dos. Un cartel que promete 24 horas sobre un cron
 * que borra a las 12 es peor que no tener cartel.
 */
export const HORAS_DE_PRUEBA = 24;

export interface EstadoDePrueba {
  /** Horas enteras que faltan. Nunca negativo: 0 es "en cualquier momento". */
  horasRestantes: number;
  /** Para el cartel: "en 3 horas", "en menos de una hora". */
  etiqueta: string;
}

/**
 * Cuánto le queda a una cuenta de prueba, desde su fecha de creación.
 *
 * Redondea al entero más cercano, no para abajo. Truncar hacía que una cuenta
 * recién abierta dijera "se borra en 23 horas" en el mismo segundo en que
 * arrancaban sus 24, que se lee como un error aunque sea conservador.
 *
 * Redondear no promete de más en la práctica: el cron corre una vez por hora,
 * así que la cuenta siempre vive entre 24 y 25 horas, y el redondeo se come
 * como mucho media hora de ese colchón.
 */
export function estadoDePrueba(createdAt: string): EstadoDePrueba {
  const vence = new Date(createdAt).getTime() + HORAS_DE_PRUEBA * 3600_000;
  const faltan = Math.max(0, vence - Date.now());
  const horas = Math.round(faltan / 3600_000);

  return {
    horasRestantes: horas,
    etiqueta:
      horas >= 2 ? `en ${horas} horas` : horas === 1 ? "en una hora" : "en menos de una hora",
  };
}
