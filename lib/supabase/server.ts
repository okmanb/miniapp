import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
