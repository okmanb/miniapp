"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { extractLayoutText } from "@/lib/statement-parser/pdf-layout";
import { parseStatement } from "@/lib/statement-parser";

export async function uploadAndParseStatement(debtId: string, formData: FormData) {
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent("Subí un archivo PDF.")}`);
  }

  if (file.type !== "application/pdf") {
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent("El archivo tiene que ser un PDF.")}`);
  }

  let parsed;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractLayoutText(buffer);
    parsed = parseStatement(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error leyendo el PDF.";
    redirect(`/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent(message)}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pasar el JSON parseado entero por la URL (?data=...) sumado a
  // las cookies de sesión supera el límite de tamaño de headers en
  // un resumen con varias líneas de consumo/cuotas — el navegador
  // corta la petición con 431 sin avisar nada. Se guarda acá y solo
  // el id (corto) viaja por la URL; la pantalla de revisión lo lee
  // de vuelta, y se borra apenas se confirma o se descarta.
  const { data: pending, error } = await supabase
    .from("pending_statement_imports")
    .insert({ user_id: user.id, data: parsed })
    .select("id")
    .single();

  if (error || !pending) {
    redirect(
      `/dashboard/debts/${debtId}/schedule?error=${encodeURIComponent(error?.message ?? "Error guardando el resumen leído.")}`
    );
  }

  redirect(`/dashboard/debts/${debtId}/schedule/review?importId=${pending.id}`);
}
