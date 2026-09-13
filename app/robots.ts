import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-url";

/**
 * El robots.txt.
 *
 * Lo que Google tiene que ver es la puerta de entrada y las dos páginas
 * legales: son las únicas públicas y las únicas que sirve mostrar en una
 * búsqueda. Todo lo demás vive detrás de la sesión — un robot que pida
 * `/dashboard` recibe el login y nada más, porque lo corta `proxy.ts` antes de
 * llegar a la página.
 *
 * Entonces esto no protege nada: la protección es la sesión. Lo que hace es
 * evitar que el índice de Google se llene de redirecciones al login y que
 * alguna de esas URLs aparezca en un resultado, que para una app de deudas es
 * ruido con mala prensa.
 *
 * `/auth/callback` y `/clave` quedan afuera por otro motivo: son pasos de un
 * flujo con un código de un solo uso en la URL. No hay nada que indexar y sí
 * algo que ensuciar.
 *
 * El origen sale de `appOrigin()`, el mismo que usan los mails de
 * confirmación, así que en una preview de Vercel apunta a la preview y no a
 * producción.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origen = await appOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/auth", "/clave", "/dev-preview"],
    },
    sitemap: `${origen}/sitemap.xml`,
  };
}
