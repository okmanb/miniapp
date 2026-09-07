/**
 * Estado inicial del formulario de pago.
 *
 * Vive en su propio módulo y no al lado de la server action porque un archivo
 * "use server" solo puede exportar funciones asíncronas. Exportar una
 * constante desde ahí compila, pero en el cliente llega como `undefined` — y
 * `useActionState` arranca sin estado, así que la primera lectura de
 * `state.<campo>` rompe la pantalla entera antes de pintar nada.
 */

export interface PaymentState {
  message: string | null;
}

export const EMPTY_PAYMENT_STATE: PaymentState = { message: null };
