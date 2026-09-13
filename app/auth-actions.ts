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

/**
 * Entrar a probar: una cuenta temporal, de verdad, sin pedir nada.
 *
 * La sesión anónima de Supabase da un `auth.uid()` propio, así que el tablero
 * de la prueba es el tablero de verdad —las mismas consultas, las mismas
 * políticas de RLS, las mismas cuentas— y no una maqueta que después hay que
 * mantener en paralelo. Lo que se carga probando queda guardado y sobrevive a
 * recargar la página.
 *
 * Dura `HORAS_DE_PRUEBA` horas y lo dice el cartel de todas las pantallas. La
 * borra un cron (migración 013), no esta app.
 *
 * Si el proyecto tiene las sesiones anónimas apagadas, esto no puede funcionar
 * y no tiene sentido disimularlo: manda a crear la cuenta, que es el otro
 * camino al mismo lugar, con un aviso que lo explica.
 */
export async function probarConCuentaTemporal() {
  const supabase = await createClient();

  // Con sesión abierta el botón ya no significa nada: el tablero es este.
  const { data: sesion } = await supabase.auth.getUser();
  if (sesion.user) redirect("/dashboard");

  const { error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error("probarConCuentaTemporal: no se pudo abrir la cuenta de prueba", error);
    redirect("/signup?desde=onboarding&sin_prueba=1");
  }

  redirect("/dashboard");
}

/**
 * Entrar con Google o con Apple.
 *
 * Sirve para las tres cosas a la vez —crear cuenta, entrar, y guardar una
 * cuenta de prueba— porque del otro lado es el mismo gesto. Y resuelve el
 * problema más grande que tiene hoy el alta: el servidor de mail incorporado
 * de Supabase solo entrega a los miembros de la organización, así que **nadie
 * más que el dueño puede crear cuenta con mail**. Por acá no hay mail que
 * mandar.
 *
 * ## Con una cuenta de prueba abierta se ENLAZA, no se crea otra
 *
 * `linkIdentity` le cuelga la identidad de Google a la cuenta anónima que ya
 * existe: mismo id, misma deuda cargada, misma proyección. `signInWithOAuth`
 * en cambio abriría una cuenta nueva y dejaría la de prueba ahí, esperando que
 * el cron la borre con todo lo que tenga adentro.
 *
 * Las dos devuelven una URL en vez de redirigir solas: el redirect lo hace
 * Next, y por eso va fuera del try.
 */
async function entrarConProveedor(provider: "google" | "apple") {
  const supabase = await createClient();
  const origen = await appOrigin();

  const { data: sesion } = await supabase.auth.getUser();
  const esDePrueba = sesion.user?.is_anonymous === true;

  const opciones = { redirectTo: `${origen}/auth/callback` };

  const { data, error } = esDePrueba
    ? await supabase.auth.linkIdentity({ provider, options: opciones })
    : await supabase.auth.signInWithOAuth({ provider, options: opciones });

  if (error || !data?.url) {
    console.error(`entrarConProveedor(${provider})`, error);
    const destino = esDePrueba ? "/signup" : "/login";
    redirect(
      `${destino}?error=${encodeURIComponent(
        error?.message ?? "No pudimos abrir la pantalla de ese proveedor."
      )}`
    );
  }

  redirect(data.url);
}

/** Uno por proveedor, para colgarlos de un `<form action>` sin envolver nada. */
export async function entrarConGoogle() {
  await entrarConProveedor("google");
}

export async function entrarConApple() {
  await entrarConProveedor("apple");
}

/**
 * Guardar una cuenta de prueba: se le cuelga un mail y deja de ser anónima.
 *
 * Es un `updateUser`, NO un alta. El usuario es el mismo —el mismo id— así que
 * no hay que mover una sola fila: las deudas, los pagos y los resúmenes ya
 * apuntan ahí. Mover datos de un usuario a otro sería la otra opción, y es la
 * peligrosa: para hacerla habría que creerle al navegador de quién era la
 * cuenta vieja.
 *
 * La clave no se puede poner todavía. Supabase la rechaza con todas las
 * letras —"Updating password of an anonymous user without an email or phone is
 * not allowed"— hasta que el mail esté confirmado. Por eso queda marcada como
 * pendiente en el metadata y se pide en `/clave`, ni bien vuelve del link.
 */
async function guardarCuentaDePrueba(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  const { error } = await supabase.auth.updateUser(
    {
      email,
      data: { ...(name ? { full_name: name } : {}), clave_pendiente: true },
    },
    { emailRedirectTo: `${await appOrigin()}/auth/callback` }
  );

  if (error) {
    console.error("guardarCuentaDePrueba: no se pudo colgar el mail", error);
    redirect(`/signup?desde=prueba&error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?check_email=1&desde=prueba");
}

/**
 * La clave, ya con el mail confirmado (pantalla `/clave`).
 *
 * Cierra la conversión: hasta acá la cuenta tiene mail pero no tiene con qué
 * volver a entrar. `clave_pendiente` se apaga para que el callback deje de
 * mandar a esta pantalla.
 */
export async function guardarClaveDeCuentaNueva(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirect("/clave?error=" + encodeURIComponent("La clave tiene que tener al menos 8 caracteres."));
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { clave_pendiente: false },
  });

  if (error) {
    console.error("guardarClaveDeCuentaNueva: no se pudo guardar la clave", error);
    redirect(`/clave?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard?cuenta_guardada=1");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Viene de probar: no se crea una cuenta nueva, se guarda la que ya tiene.
  const { data: sesion } = await supabase.auth.getUser();
  if (sesion.user?.is_anonymous) return guardarCuentaDePrueba(formData);

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
