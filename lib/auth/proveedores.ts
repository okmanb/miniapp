import { cache } from "react";

/**
 * Qué proveedores de identidad tiene prendidos el proyecto de Supabase.
 *
 * Se le pregunta a `/auth/v1/settings`, que es público y no necesita sesión.
 * La alternativa era una variable de entorno con la lista, y envejece mal: el
 * interruptor de verdad está en el panel de Supabase, así que el día que
 * alguien lo apaga la app seguiría mostrando el botón y el botón llevaría a un
 * error. Preguntando, el botón aparece y desaparece solo.
 *
 * Se cachea cinco minutos: es una respuesta que cambia una vez por año y no
 * tiene sentido pagarla en cada visita a la pantalla de entrar.
 */
export interface Proveedores {
  google: boolean;
  apple: boolean;
}

export const proveedoresHabilitados = cache(async function proveedoresHabilitados(): Promise<Proveedores> {
  try {
    const respuesta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });

    if (!respuesta.ok) return { google: false, apple: false };

    const config = (await respuesta.json()) as { external?: Record<string, boolean> };
    return {
      google: config.external?.google === true,
      apple: config.external?.apple === true,
    };
  } catch {
    // Sin respuesta no se muestran botones. Es el lado seguro: de más se ve un
    // camino de menos, y de menos se ve un botón que lleva a un error.
    return { google: false, apple: false };
  }
});
