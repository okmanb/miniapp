"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELETE_CONFIRMATION } from "@/app/dashboard/settings/confirmation";

export type SettingsResult = { ok: true } | { ok: false; message: string };

/**
 * Borrar todos los datos de la cuenta.
 *
 * Alcanza con borrar los escenarios: deudas, pagos, resúmenes, cuotas,
 * gastos, ingresos, puentes y alertas cuelgan de ellos con ON DELETE CASCADE,
 * así que la base se encarga de que no quede nada suelto ni a medias.
 *
 * La cuenta no se toca. "Borrar mis datos" y "borrar mi cuenta" son dos
 * decisiones distintas y esta pantalla ofrece la primera.
 *
 * Pide escribir una palabra en vez de un solo botón porque esto no tiene
 * vuelta atrás y no hay papelera: la app archiva en vez de borrar en todos
 * lados menos acá.
 */
export async function deleteAllData(formData: FormData): Promise<SettingsResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed !== DELETE_CONFIRMATION) {
    return { ok: false, message: `Escribí ${DELETE_CONFIRMATION} para confirmar.` };
  }

  const { error } = await supabase.from("scenarios").delete().eq("user_id", auth.user.id);
  if (error) return { ok: false, message: "No pudimos borrar tus datos." };

  await supabase.from("alert_settings").delete().eq("user_id", auth.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/**
 * Borrar la cuenta entera.
 *
 * La otra mitad de "borrar mis datos", y la que faltaba. Se notó al escribir
 * la política de privacidad: la página tenía que decir "escribinos un mail y
 * te damos de baja", que es pedirle a alguien que confíe en que otro se
 * acuerde.
 *
 * El borrado lo hace `borrar_mi_cuenta()` adentro de la base (migración 015).
 * Desde acá no se puede tocar `auth.users`: haría falta la service role key,
 * que saltea RLS entera y no está ni en el entorno local. La función corre con
 * los permisos del dueño pero borra una sola fila —la de `auth.uid()`— y no
 * recibe argumentos, así que no hay forma de pedirle que borre a otro.
 *
 * Después se cierra la sesión igual. La cuenta ya no existe, pero la cookie
 * sigue en el navegador y sin esto la app quedaría mostrando pantallas vacías
 * con un token que no apunta a nadie.
 */
export async function deleteAccount(formData: FormData): Promise<SettingsResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed !== DELETE_CONFIRMATION) {
    return { ok: false, message: `Escribí ${DELETE_CONFIRMATION} para confirmar.` };
  }

  const { error } = await supabase.rpc("borrar_mi_cuenta");

  if (error) {
    console.error("deleteAccount: no se pudo borrar la cuenta", error);
    return { ok: false, message: `No pudimos borrar la cuenta: ${error.message}` };
  }

  await supabase.auth.signOut();

  return { ok: true };
}
