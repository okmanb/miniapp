"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { appOrigin } from "@/lib/app-url";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = String(formData.get("name") ?? "").trim();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El nombre no es un dato del negocio: no entra en ninguna cuenta. Se
      // guarda en el metadata del usuario y lo usa Ajustes para encabezar la
      // pantalla con una persona en vez de con una dirección de mail.
      data: name ? { full_name: name } : undefined,
      // A donde vuelve el usuario después de clickear el link de
      // confirmación que le llega por email.
      emailRedirectTo: `${await appOrigin()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?check_email=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type RecoveryResult = { ok: true } | { ok: false; message: string };

/**
 * Recuperar la clave, paso 1 de 3 (pantalla 14).
 *
 * Manda un codigo de seis digitos, no un link. Un link de recuperacion no
 * sobrevive a leer el mail en el telefono y estar sentado frente a la
 * computadora; un codigo se copia a mano y funciona en cualquiera de los dos.
 *
 * Requiere que la plantilla "Reset password" del proyecto de Supabase incluya
 * {{ .Token }}. Si solo tiene {{ .ConfirmationURL }}, el mail llega con el link
 * de siempre y esta pantalla se queda esperando un codigo que nunca aparece.
 *
 * La respuesta es la misma exista o no la cuenta. Decir "ese mail no está
 * registrado" le confirma a cualquiera que pruebe una dirección si esa persona
 * usa la app, que en una app de deudas no es un detalle menor.
 *
 * Los tres pasos devuelven un resultado en vez de redirigir con el mail en la
 * URL: una direccion de mail en un query string termina en los logs del
 * servidor y en el historial del navegador, y no hace falta que este ahi.
 */
export async function requestPasswordReset(email: string): Promise<RecoveryResult> {
  const supabase = await createClient();
  const clean = email.trim();

  if (!clean) return { ok: false, message: "Escribí el mail de tu cuenta." };

  await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${await appOrigin()}/auth/callback`,
  });

  return { ok: true };
}

/**
 * Paso 2 de 3: canjear el codigo por una sesion.
 *
 * Un codigo mal escrito si dice que esta mal, a diferencia del mail: aca ya no
 * se filtra nada, porque para llegar hasta este paso hay que haber recibido el
 * mail de esa casilla.
 */
export async function verifyRecoveryCode(email: string, token: string): Promise<RecoveryResult> {
  const supabase = await createClient();
  const digits = token.replace(/[^0-9]/g, "");

  if (digits.length !== 6) return { ok: false, message: "El código tiene seis dígitos." };

  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: digits,
    type: "recovery",
  });

  if (error) return { ok: false, message: "Ese código no sirve o ya venció. Pedí otro." };

  return { ok: true };
}

/**
 * Paso 3 de 3: la clave nueva, ya con la sesion abierta por el codigo.
 */
export async function setNewPassword(password: string): Promise<RecoveryResult> {
  const supabase = await createClient();

  if (password.length < 8) {
    return { ok: false, message: "La clave nueva tiene que tener al menos 8 caracteres." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  return { ok: true };
}
