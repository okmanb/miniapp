import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Antes se llamaba `middleware`; en Next 16 la convención es `proxy`. Es el
 * mismo archivo con otro nombre, y el propio Next avisaba de la deprecación.
 *
 * Corre en cada request: refresca el token de Supabase si está por vencer,
 * para que nadie se desloguee solo en medio de cargar un resumen.
 *
 * Las cookies se leen del request y se escriben en el response Y en el
 * request: si solo se escribieran en el response, el resto de este mismo
 * request seguiría viendo el token viejo.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas privadas: todo lo que cuelga de /dashboard.
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard");
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
