"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { entrarConGoogle } from "@/app/auth-actions";
import { createClient } from "@/lib/supabase/client";
import { ENTRY_SECONDARY } from "@/components/ui";

/**
 * Entrar con Google sin pasar por la pantalla de Supabase.
 *
 * ## El problema que resuelve
 *
 * El camino de siempre —`signInWithOAuth`— manda el navegador a
 * `<ref>.supabase.co/auth/v1/authorize`, y Google, que muestra siempre a dónde
 * te está mandando, escribe eso en la pantalla de elegir cuenta:
 *
 *     Para continuar a udhqdbpjhifeotgoqaoa.supabase.co
 *
 * Veinte caracteres al azar que no le dicen nada a nadie, y que son justo lo
 * que uno miraría para darse cuenta de que está en una pantalla falsa. La
 * documentación de Supabase lo dice con todas las letras: sin dominio propio
 * el usuario ve el id del proyecto, y eso hace la app más fácil de suplantar.
 *
 * Arreglarlo del lado del servidor cuesta plata —el dominio propio de Supabase
 * es un add-on de un plan pago, y este proyecto está en el gratuito—. Del lado
 * del navegador no cuesta nada: con la librería de Google (GIS) el token lo
 * pide ESTA página, así que el origen que Google muestra es el de la app.
 *
 * Google devuelve un id token firmado y `signInWithIdToken` lo canjea por una
 * sesión de Supabase. Termina siendo el mismo usuario y la misma identidad que
 * por el otro camino: cambia quién le pide el token a Google, no quién entra.
 *
 * ## Por qué igual queda el camino viejo abajo
 *
 * GIS no anda en cualquier lado: si el origen no está en "Authorized
 * JavaScript origins" de la consola de Google, si el script está bloqueado, o
 * si el navegador corta las cookies de terceros de una forma que FedCM no
 * salva, el botón no se dibuja. Y como este es el ÚNICO ingreso de la app,
 * quedarse sin botón es quedarse afuera.
 *
 * Por eso esto es una mejora progresiva y no un reemplazo: se dibuja el botón
 * de Google si se puede, y si no, el mismo formulario de antes, que funciona
 * siempre porque lo resuelve el servidor. Lo único que se pierde en ese caso
 * es la línea prolija en la pantalla de Google.
 *
 * ## El nonce
 *
 * Va hasheado a Google y en crudo a Supabase, que es como lo pide la
 * documentación: Google firma el hash adentro del token y Supabase compara.
 * Sin eso, un token conseguido en otro lado serviría acá.
 */

type Estado = "cargando" | "google" | "fallback" | "entrando";

/**
 * Cuánto mide de alto un botón de esta app, y por qué no son 52.
 *
 * Es `BUTTON_HEIGHT_OUTLINED`: el botón de contorno va un píxel más bajo que el
 * relleno a propósito —está explicado en `components/ui.tsx`— porque una figura
 * clara sobre fondo claro se agranda a la vista. El de Google es claro, así que
 * le toca 51.
 *
 * Google dibuja el suyo de 40 y no ofrece más: `size` tiene tres valores y
 * `large` es el más grande. Así que se lo escala, que es lo único que se puede
 * hacer sin tocar lo que Google dibuja: la proporción, los colores y el logo
 * quedan intactos, solo cambia el tamaño.
 */
const ALTO_DEL_BOTON = 51;

interface Credencial {
  credential?: string;
}

/** Lo que la librería de Google cuelga de `window`, con lo poco que se usa. */
interface GoogleGlobal {
  accounts?: {
    id?: {
      initialize: (config: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, opciones: Record<string, unknown>) => void;
    };
  };
}

/**
 * El nonce, en sus dos formas.
 *
 * `crypto.subtle` existe solo en contexto seguro: https y localhost. Los dos
 * únicos lugares donde esto corre.
 */
async function generarNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hasheado = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { nonce, hasheado };
}

export function EntrarConGoogle({
  clientId,
  verbo = "Entrar",
  destino = "/dashboard",
}: {
  /** El client id de la consola de Google. Es público: viaja en cada URL de OAuth. */
  clientId?: string;
  /** "Entrar" en el login, "Crear cuenta" en el alta. Solo cambia el texto. */
  verbo?: string;
  destino?: string;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string | null>(null);
  const yaArranco = useRef(false);

  const [estado, setEstado] = useState<Estado>(clientId ? "cargando" : "fallback");
  const [escala, setEscala] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const entrar = useCallback(
    async (token: string) => {
      setEstado("entrando");
      setError(null);

      const supabase = createClient();
      const { error: fallo } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token,
        nonce: nonceRef.current ?? undefined,
      });

      if (fallo) {
        console.error("signInWithIdToken", fallo);
        // El camino largo sigue estando y no depende de nada de esto, así que
        // el error no es un callejón: es "probá por la puerta de al lado".
        setError("No pudimos entrar con ese token de Google. Probá con el botón de abajo.");
        setEstado("fallback");
        return;
      }

      // Recarga entera y no `router.push`: la sesión se acaba de escribir en
      // las cookies y el tablero se arma del lado del servidor.
      window.location.href = destino;
    },
    [destino]
  );

  const iniciar = useCallback(async () => {
    if (yaArranco.current || !clientId) return;

    const google = (window as unknown as { google?: GoogleGlobal }).google;
    if (!google?.accounts?.id || !caja.current || !marco.current) return;

    const idDeGoogle = google.accounts.id;
    yaArranco.current = true;

    try {
      const { nonce, hasheado } = await generarNonce();
      nonceRef.current = nonce;

      idDeGoogle.initialize({
        client_id: clientId,
        callback: (respuesta: Credencial) => {
          if (respuesta.credential) void entrar(respuesta.credential);
        },
        nonce: hasheado,
        // Para que el día que Chrome termine de cortar las cookies de terceros
        // esto siga andando.
        use_fedcm_for_prompt: true,
        itp_support: true,
        ux_mode: "popup",
      });

      /*
       * Google quiere el ancho en píxeles y no acepta "el 100%", así que hay
       * que medirlo. La medición puede dar cero —la pantalla entra con una
       * animación, y en desarrollo React monta dos veces—, y un botón de 320 en
       * una columna de 394 se ve torcido al lado del de abajo. El respaldo es
       * la cuenta de la columna de `AuthShell`: `max-w-[430px]` menos los
       * `px-[18px]` de cada lado.
       */
      const medido = Math.round(marco.current.getBoundingClientRect().width);
      const ancho = medido || Math.min(394, document.documentElement.clientWidth - 36);

      const dibujar = (anchoPedido: number) =>
        idDeGoogle.renderButton(caja.current!, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "left",
          locale: "es-419",
          width: Math.min(400, Math.max(200, Math.round(anchoPedido))),
        });

      /*
       * Se dibuja dos veces, y la primera es solo para medir.
       *
       * El alto de Google se mide en vez de darlo por sabido: hoy son 40, pero
       * si mañana cambia, el factor se recalcula solo y el botón sigue
       * midiendo lo mismo que los de al lado. El ancho de este primer dibujo da
       * igual, se descarta enseguida.
       */
      dibujar(260);
      await new Promise((listo) => window.setTimeout(listo, 120));

      if (!caja.current || !marco.current) {
        // Nunca dejarlo en "cargando": eso es una pantalla de entrar sin botón.
        setEstado("fallback");
        return;
      }

      const altoDeGoogle = caja.current.firstElementChild?.getBoundingClientRect().height ?? 0;
      const factor =
        altoDeGoogle > 0 && altoDeGoogle < ALTO_DEL_BOTON
          ? Math.min(1.6, ALTO_DEL_BOTON / altoDeGoogle)
          : 1;

      // Y el de verdad: a un ancho que, agrandado por el factor, llena la
      // columna exacta que ocupan los demás botones.
      caja.current.replaceChildren();
      setEscala(factor);
      dibujar(ancho / factor);
    } catch (e) {
      console.error("No se pudo preparar el ingreso con Google", e);
      setEstado("fallback");
      return;
    }

    /*
     * Google no avisa cuando el origen no está autorizado: escribe una línea en
     * la consola del navegador y no dibuja nada. Así que la única forma de
     * saber si el botón está es mirar si quedó algo adentro de la caja.
     */
    window.setTimeout(() => {
      setEstado(caja.current?.childElementCount ? "google" : "fallback");
    }, 600);
  }, [clientId, entrar]);

  useEffect(() => {
    if (!clientId) return;

    // Volver a esta pantalla con el script ya cargado no dispara `onLoad`.
    void iniciar();

    // Y si el script no llega —bloqueado, sin internet, una red que lo come—
    // no se puede esperar para siempre: a los cinco segundos, el camino largo.
    const reloj = window.setTimeout(() => {
      setEstado((actual) => (actual === "cargando" ? "fallback" : actual));
    }, 5000);

    return () => window.clearTimeout(reloj);
  }, [clientId, iniciar]);

  return (
    <div ref={marco} className="mt-4">
      {clientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => void iniciar()}
          onError={() => setEstado("fallback")}
        />
      )}

      {/* Siempre montada: `renderButton` necesita un nodo de verdad, y el ancho
          se calcula antes de que haya nada adentro. La fila fija el alto de la
          app y centra lo que Google dibuje; la caja de adentro es la que se
          agranda, desde el centro, para llegar a ese alto. */}
      <div
        className={
          estado === "google"
            ? "flex items-center justify-center"
            : "invisible h-0 overflow-hidden"
        }
        style={estado === "google" ? { height: ALTO_DEL_BOTON } : undefined}
      >
        <div ref={caja} style={escala === 1 ? undefined : { transform: `scale(${escala})` }} />
      </div>

      {estado === "cargando" && (
        <div aria-busy className={`${ENTRY_SECONDARY} justify-center opacity-60`}>
          <LogoGoogle />
          {verbo} con Google
        </div>
      )}

      {estado === "entrando" && (
        <div aria-busy className={`${ENTRY_SECONDARY} justify-center opacity-60`}>
          <LogoGoogle />
          Entrando…
        </div>
      )}

      {estado === "fallback" && <BotonGoogleRedirect verbo={verbo} />}

      {error && (
        <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * El camino largo: lo resuelve el servidor y anda siempre.
 *
 * Es el que se usa también para guardar una cuenta de prueba, y ahí no es un
 * plan B sino el único plan: enlazar una identidad a una cuenta que ya existe
 * (`linkIdentity`) solo se puede por redirección. Con el token de GIS, Supabase
 * abriría una cuenta NUEVA y la de prueba quedaría esperando que el cron la
 * borre con todo lo que tenga cargado adentro.
 */
export function BotonGoogleRedirect({ verbo = "Entrar" }: { verbo?: string }) {
  return (
    <form action={entrarConGoogle}>
      <button type="submit" className={`${ENTRY_SECONDARY} justify-center`}>
        <LogoGoogle />
        {verbo} con Google
      </button>
    </form>
  );
}

/** La G de Google, en sus cuatro colores. Es marca registrada: no se recolorea. */
export function LogoGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
