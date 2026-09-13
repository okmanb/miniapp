import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// A donde Supabase redirige después de que el usuario clickea el
// link de confirmación de email (ver emailRedirectTo en signup()).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  /*
   * Una cuenta de prueba recién guardada vuelve por acá con mail confirmado y
   * sin clave: Supabase no dejaba ponerla antes de este momento. El metadata
   * lo marca al colgar el mail y `/clave` lo apaga cuando termina.
   *
   * Va antes del dashboard a propósito. Si esto mandara al tablero, la persona
   * se quedaría con una cuenta a la que no puede volver a entrar, y no habría
   * nada en la pantalla que se lo dijera.
   */
  const { data } = await supabase.auth.getUser();
  if (data.user?.user_metadata?.clave_pendiente) {
    return NextResponse.redirect(`${origin}/clave`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
