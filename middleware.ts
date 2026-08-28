import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gate simple de acceso al deploy (no reemplaza el login de Supabase,
// es una capa previa para que la URL pública no quede abierta a
// cualquiera — Vercel Authentication/Password Protection para el
// dominio de producción es feature paga en plan Hobby). Se activa
// solo si SITE_ACCESS_PASSWORD está seteada; sin esa env var, no
// gatea nada (así el dev local sigue abierto).
function hasValidBasicAuth(request: NextRequest): boolean {
  const sitePassword = process.env.SITE_ACCESS_PASSWORD;
  if (!sitePassword) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;
  const [, password] = atob(authHeader.slice(6)).split(":");
  return password === sitePassword;
}

// Corre en cada request. Refresca el token de sesión de Supabase
// si está por vencer, para que el usuario no se desloguee solo.
export async function middleware(request: NextRequest) {
  if (!hasValidBasicAuth(request)) {
    return new NextResponse("Autenticación requerida", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Simulador de deudas"' },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protegé rutas privadas acá: si no hay usuario y está entrando
  // a /dashboard (o lo que agregues), lo mandamos a /login.
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
