import { headers } from "next/headers";

/**
 * De dónde salen los links que Supabase nos va a devolver (confirmación de
 * mail, recuperar clave).
 *
 * Se deriva del request y no de una variable de entorno. Con
 * NEXT_PUBLIC_APP_URL fija pasaba esto: en local apuntaba a localhost:3000,
 * y en Vercel había que acordarse de configurarla — si no, el link del mail
 * te devolvía a un servidor que no existe, o peor, a "undefined/auth/callback".
 * Cada despliegue de preview tiene además su propio dominio, que ninguna
 * variable puede saber de antemano.
 *
 * Derivándolo del request funciona en los tres casos sin configurar nada:
 * local, preview y producción.
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();

  // Detrás del proxy de Vercel el host real viene en x-forwarded-host; el
  // header `host` en ese caso es el interno.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  // Sin headers no hay request: solo pasa fuera de un request real.
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
