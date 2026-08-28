import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// A donde Supabase redirige después de que el usuario clickea el
// link de confirmación de email (ver emailRedirectTo en signup()).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
