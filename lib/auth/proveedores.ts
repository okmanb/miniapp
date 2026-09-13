import { cache } from "react";

/**
 * Qué proveedores de identidad se pueden usar DE VERDAD en este proyecto.
 *
 * Se pregunta en dos pasos, y el segundo no es paranoia:
 *
 * 1. `/auth/v1/settings` dice cuáles están prendidos. Es público y no necesita
 *    sesión. La alternativa era una variable de entorno con la lista, y
 *    envejece mal: el interruptor de verdad está en el panel de Supabase, así
 *    que el día que alguien lo apaga la app seguiría mostrando el botón.
 *
 * 2. `/auth/v1/authorize?provider=…` dice si además está CONFIGURADO. Pasó
 *    acá: Apple quedó prendido sin credenciales, `settings` lo daba por activo,
 *    y arrancar el flujo devolvía
 *
 *        400 · "Unsupported provider: missing OAuth secret"
 *
 *    o sea un botón que llevaba derecho a un error. Prendido y configurado son
 *    dos cosas distintas, y la única que le importa a quien va a hacer clic es
 *    la segunda.
 *
 * Las dos respuestas se cachean cinco minutos: cambian una vez por año y no
 * tiene sentido pagarlas en cada visita a la pantalla de entrar.
 */
export interface Proveedores {
  google: boolean;
  apple: boolean;
}

const CACHE = 300;

async function estaConfigurado(provider: "google" | "apple"): Promise<boolean> {
  try {
    const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize`);
    url.searchParams.set("provider", provider);

    const respuesta = await fetch(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      // Sin seguir el redirect: lo único que se mira es si HAY redirect. Un
      // 302 es "arrancó el flujo"; un 400 es "falta el secret".
      redirect: "manual",
      next: { revalidate: CACHE },
    });

    return respuesta.status >= 300 && respuesta.status < 400;
  } catch {
    return false;
  }
}

export const proveedoresHabilitados = cache(async function proveedoresHabilitados(): Promise<Proveedores> {
  try {
    const respuesta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: CACHE },
    });

    if (!respuesta.ok) return { google: false, apple: false };

    const config = (await respuesta.json()) as { external?: Record<string, boolean> };

    // Solo se prueba lo que dice estar prendido: probar lo apagado es un
    // pedido al pedo que siempre da 400.
    const [google, apple] = await Promise.all([
      config.external?.google === true ? estaConfigurado("google") : Promise.resolve(false),
      config.external?.apple === true ? estaConfigurado("apple") : Promise.resolve(false),
    ]);

    return { google, apple };
  } catch {
    // Sin respuesta no se muestran botones. Es el lado seguro: de más se ve un
    // camino de menos, y de menos se ve un botón que lleva a un error.
    return { google: false, apple: false };
  }
});
