import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-url";

/**
 * El sitemap: tres URLs, que son todas las públicas que tiene la app.
 *
 * Existe porque el `robots.txt` lo nombra, y un robots que apunta a un sitemap
 * que no está es una pista falsa. Tres líneas de verdad valen más que un
 * archivo generado que promete páginas que no existen.
 *
 * El resto de la app vive detrás de la sesión y no entra acá por lo mismo que
 * no entra en el robots: no hay nada que un buscador pueda ver.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origen = await appOrigin();
  const hoy = new Date();

  return [
    { url: origen, lastModified: hoy, changeFrequency: "monthly", priority: 1 },
    { url: `${origen}/privacidad`, lastModified: hoy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origen}/terminos`, lastModified: hoy, changeFrequency: "yearly", priority: 0.3 },
  ];
}
