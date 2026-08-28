/**
 * Cliente para la API de Estadísticas del BCRA
 * (https://api.bcra.gob.ar/estadisticas/v3.0/) — misma fuente que
 * usaste en calculadora_uva.py.
 *
 * Cachea en bcra_rates_cache para no pegarle en cada request; el
 * caller decide cada cuánto se considera "vencido" el cache.
 */

import { createAdminClient } from "@/lib/supabase/server";

const BCRA_BASE_URL = "https://api.bcra.gob.ar/estadisticas/v3.0";

// IDs de variables del BCRA que nos interesan.
// (Confirmar/ajustar los idVariable exactos contra el catálogo de
// /estadisticas/v3.0/monetarias si difieren.)
const BCRA_VARIABLE_IDS = {
  uva: 5, // UVA (Unidad de Valor Adquisitivo)
  inflacion_mensual: 27, // Inflación mensual (INDEC vía BCRA)
} as const;

export type BcraRateKey = keyof typeof BCRA_VARIABLE_IDS;

interface BcraApiResponse {
  results: Array<{
    idVariable: number;
    fecha: string;
    valor: number;
  }>;
}

async function fetchFromBcra(idVariable: number): Promise<{ valor: number; fecha: string }> {
  let res: Response;
  try {
    res = await fetch(`${BCRA_BASE_URL}/monetarias/${idVariable}?limit=1`, {
      // La API del BCRA a veces usa certificados que Node rechaza por
      // default; si falla por TLS, ver nota en README sobre NODE_TLS_REJECT_UNAUTHORIZED.
      cache: "no-store",
    });
  } catch (err) {
    // Errores de red (sin conexión, DNS, TLS) llegan acá sin
    // response — los envolvemos en un mensaje que tiene sentido
    // para alguien que no sabe qué es un fetch.
    throw new Error(
      "No se pudo conectar con la API del BCRA (revisá tu conexión a internet). " +
        (err instanceof Error ? err.message : "")
    );
  }

  if (!res.ok) {
    throw new Error(
      `El BCRA no respondió como se esperaba (código ${res.status}). Puede ser un problema temporal del servicio — probá de nuevo en un rato.`
    );
  }

  const data: BcraApiResponse = await res.json();
  const latest = data.results[0];
  if (!latest) {
    throw new Error(`BCRA API no devolvió resultados para variable ${idVariable}`);
  }

  return { valor: latest.valor, fecha: latest.fecha };
}

// Devuelve el valor cacheado si tiene menos de `maxAgeHours`, sino
// va a buscar el valor fresco a la API y actualiza el cache.
export async function getBcraRate(
  key: BcraRateKey,
  maxAgeHours = 24
): Promise<{ value: number; asOfDate: string }> {
  const supabase = createAdminClient();

  const { data: cached } = await supabase
    .from("bcra_rates_cache")
    .select("*")
    .eq("id", key)
    .maybeSingle();

  if (cached) {
    const ageHours =
      (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < maxAgeHours) {
      return { value: cached.value, asOfDate: cached.as_of_date };
    }
  }

  const fresh = await fetchFromBcra(BCRA_VARIABLE_IDS[key]);

  await supabase.from("bcra_rates_cache").upsert({
    id: key,
    value: fresh.valor,
    as_of_date: fresh.fecha,
    fetched_at: new Date().toISOString(),
  });

  return { value: fresh.valor, asOfDate: fresh.fecha };
}

export async function getUvaValue() {
  return getBcraRate("uva");
}

export async function getMonthlyInflation() {
  return getBcraRate("inflacion_mensual");
}
