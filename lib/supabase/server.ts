import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Cuántas veces se intenta una lectura, contando la primera. */
const INTENTOS_DE_LECTURA = 3;

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * El `fetch` que usa Supabase acá: reintenta las LECTURAS que fallan con 5xx.
 *
 * Este proyecto viene comiéndose timeouts del gateway de Supabase cada tanto
 * —cuatro 504 en veinticuatro horas, en cuatro tablas distintas, todos a los
 * 5 segundos clavados— y no son culpa de la consulta: el pedido ni siquiera
 * llega a Postgres. Uno de esos 504 fue el que hizo decir a la pantalla de
 * resúmenes **"No hay un escenario activo donde guardar la tarjeta"** con el
 * escenario activo y sano en la base.
 *
 * Un reintento arregla eso donde de verdad pasa: en el borde, para cada
 * consulta de la app, sin que cada llamador tenga que acordarse.
 *
 * ## Solo GET y HEAD, y esto no es una formalidad
 *
 * Un 504 no significa "no pasó nada": significa que el gateway se cansó de
 * esperar. La escritura puede haberse aplicado igual. Reintentar un POST sería
 * arriesgarse a cobrar dos veces el mismo resumen o a crear la tarjeta dos
 * veces, que es peor que el error. Las lecturas, en cambio, se pueden repetir
 * todas las veces que haga falta.
 *
 * El costo del peor caso está medido: esos 504 vuelven a los 5 s, así que tres
 * intentos son unos 16 s antes de rendirse. Es mucho, y sigue siendo mejor que
 * una pantalla de error o —peor— un mensaje que echa la culpa a los datos.
 */
const fetchConReintento: typeof fetch = async (input, init) => {
  const metodo = (init?.method ?? "GET").toUpperCase();
  const puedeRepetirse = metodo === "GET" || metodo === "HEAD";
  const intentos = puedeRepetirse ? INTENTOS_DE_LECTURA : 1;

  let ultima: Response | undefined;

  for (let intento = 0; intento < intentos; intento++) {
    if (intento > 0) await esperar(250 * intento);

    try {
      const respuesta = await fetch(input, init);
      // 5xx es del gateway o del servidor; 4xx es nuestro y repetirlo da igual.
      if (respuesta.status < 500 || intento === intentos - 1) return respuesta;
      console.warn(`supabase: ${respuesta.status} en ${metodo}, reintentando`);
      ultima = respuesta;
    } catch (fallo) {
      // La conexión ni se abrió. Con intentos de sobra, se vuelve a probar.
      if (intento === intentos - 1) throw fallo;
      console.warn(`supabase: ${metodo} no llegó a salir, reintentando`, fallo);
    }
  }

  return ultima!;
};

/**
 * Cliente para Server Components, Route Handlers y Server Actions.
 *
 * Es async porque desde Next 15 `cookies()` devuelve una promesa: la petición
 * puede no haber llegado todavía cuando el componente empieza a renderizarse.
 * Por eso todos los llamadores hacen `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchConReintento },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component, donde las cookies son de solo
            // lectura. Se puede ignorar: el middleware ya refresca la sesión.
          }
        },
      },
    }
  );
}

/**
 * Cliente con service role — SOLO para tareas de servidor (jobs,
 * importaciones). Nunca en el browser: se saltea RLS.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchConReintento },
    }
  );
}
