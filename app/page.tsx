import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { addMonths } from "@/lib/calc/cashflow";
import { currentPeriod, formatPeriodMonth, formatPeriodShort } from "@/lib/calc/dates";
import { ENTRY_PRIMARY, ENTRY_SECONDARY } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * La puerta de entrada.
 *
 * La raíz caía directo en el onboarding, y eso deja sin salida a quien ya
 * tiene cuenta pero no tiene la sesión abierta —otro dispositivo, otro
 * navegador, la sesión vencida—: la única forma de llegar a /login era
 * escribirla a mano.
 *
 * Sigue habiendo un solo camino recomendado, el de probar sin cuenta: es lo
 * que hace el prototipo y lo que hace que la app se entienda en treinta
 * segundos. Pero ahora es una elección visible y no la única puerta.
 *
 * `?probar` salta directo al alta guiada, para que el botón no cueste una
 * recarga entera y para poder linkear ahí desde otro lado.
 *
 * ## Por qué esta pantalla no la manda el prototipo
 *
 * El prototipo no tiene landing: sus pantallas de cuenta son `login`, `signup`
 * y `recover`, y nada más. Así que esta es invención de la app, y es la única
 * donde hay margen de diseño sin contradecirlo. Lo que sí manda el prototipo
 * es el vocabulario, y de ahí sale todo lo de acá: los verdes, Work Sans,
 * los tres radios, y la única sombra del sistema —que se gasta una sola vez,
 * en la tarjeta de la respuesta.
 *
 * El punch es tipográfico y no de color: el nombre de la app ES la pregunta
 * que contesta, y puesto a tamaño de display se sostiene solo. Se descartó a
 * propósito una versión con un bloque oscuro a sangre completa: hacía más
 * ruido, pero rompía la calma clara del resto de la app, que es lo único que
 * hace que las cifras en rojo signifiquen algo cuando aparecen.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ probar?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Quien ya tiene sesión no vuelve a pasar por la puerta.
  if (data.user) redirect("/dashboard");

  const query = await searchParams;
  if (query.probar !== undefined) return <OnboardingFlow />;

  return (
    <main
      data-motion
      className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] pb-11 pt-[54px]"
    >
      <span className="block font-mono text-label uppercase text-muted">
        Tus deudas, mes a mes
      </span>
      <h1 className="mt-1.5 text-[62px] font-extrabold leading-[.94] tracking-[-.045em] text-pine">
        ¿Llegás?
      </h1>

      {/* La bajada cuelga de una barra mint: el único acento de color del
          bloque, y lo que sostiene la jerarquía debajo del título. */}
      <div className="mt-7 border-l-2 border-mint pl-[15px]">
        <p className="text-[19px] font-semibold leading-[1.28] tracking-[-.015em] text-ink">
          Mirá el mes que viene antes de que llegue.
        </p>
        <p className="help mt-3 text-[13px]">
          En qué mes te quedás sin plata, por qué crece cada saldo y qué cambia si pagás
          distinto. No promete sacarte de la deuda: te muestra con qué te vas a encontrar.
        </p>
      </div>

      <Respuesta />

      <div className="mt-7 space-y-2.5">
        <Link
          href="/?probar"
          className={`${ENTRY_PRIMARY} justify-between`}
        >
          <span>Probar con una deuda</span>
          <Flecha className="stroke-white" />
        </Link>
        <Link
          href="/login"
          className={`${ENTRY_SECONDARY} justify-center`}
        >
          Ya tengo cuenta
        </Link>
      </div>

      {/*
        Decir que no hace falta cuenta es lo que destraba el primer paso: la
        objeción de alguien que debe plata no es la app, es tener que
        registrarse para mostrarle a un desconocido cuánto debe. Va pegada al
        botón, que es donde aparece la duda.
      */}
      <p className="help mt-5">
        Probar no pide cuenta ni datos del banco. No se conecta a ningún banco ni te pide
        claves. Si después querés guardarlo, creás la cuenta y lo que cargaste se conserva.
      </p>

      {/* Renglones y no tarjetas: la tarjeta ya se gastó arriba, y repetir ese
          contenedor le saca peso a la respuesta. */}
      <div className="mt-8 border-t border-border">
        <Punto
          n="01"
          titulo="En qué mes no llegás"
          texto="La proyección a seis meses con tus ingresos, tus gastos fijos y lo que vence cada mes."
        />
        <Punto
          n="02"
          titulo="Por qué crece cada saldo"
          texto="Cargás el PDF del resumen y sale el interés que te cobraron, los impuestos y las cuotas del mes."
        />
        <Punto
          n="03"
          titulo="Qué cambia si pagás distinto"
          texto="Cuántos meses y cuánto interés te ahorrás pagando más que el mínimo, deuda por deuda."
          ultimo
        />
      </div>

      {/* El cierre repite la MISMA acción primaria. Nunca una segunda que
          compita: si hay dos botones igual de fuertes, no hay ninguno. */}
      <div className="mt-2.5 border-t border-border pt-7">
        <p className="text-[17px] font-semibold leading-[1.3] tracking-[-.012em] text-ink">
          Cargá una deuda y mirá cómo queda el mes que viene.
        </p>
        <Link
          href="/?probar"
          className={`mt-3.5 ${ENTRY_PRIMARY} justify-between`}
        >
          <span>Probar con una deuda</span>
          <Flecha className="stroke-white" />
        </Link>
        <p className="mt-3.5 text-center text-[12px] text-muted">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-pine underline underline-offset-2">
            Ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Cuántos meses adelante cae el quiebre del ejemplo, contando desde hoy. */
const MES_DEL_QUIEBRE = 3;
/** Los que muestra el eje: los mismos seis que proyecta la app de verdad. */
const MESES_A_LA_VISTA = 6;

/**
 * La respuesta: una curva que cruza el cero y el mes en que lo cruza.
 *
 * Es el producto, no un adorno — la app existe porque esa línea se da vuelta
 * en algún mes y nadie lo sabe hasta que pasa. Las cifras son inventadas y por
 * eso dice "ejemplo" arriba a la derecha: la app no muestra un número sin
 * decir de dónde sale, y esta pantalla no puede ser la excepción.
 *
 * Es la única tarjeta con sombra de la pantalla, y la única del sistema: esa
 * sombra existe para un elemento y acá se gasta en este.
 *
 * ## El mes se cuenta desde hoy, no está escrito
 *
 * Decía "hasta diciembre" fijo, y eso envejece mal en las dos direcciones: en
 * enero, diciembre queda a once meses y la promesa deja de ser "el mes que
 * viene antes de que llegue"; pasado diciembre, directamente es una fecha que
 * ya ocurrió. El quiebre cae siempre tres meses adelante del mes corriente,
 * que es la distancia a la que la pregunta todavía se puede contestar y ya es
 * lo bastante cerca como para preocupar.
 *
 * La página es `force-dynamic`, así que esto se recalcula en cada visita.
 */
function Respuesta() {
  const desde = currentPeriod();
  const meses = Array.from({ length: MESES_A_LA_VISTA }, (_, i) => addMonths(desde, i));
  const quiebre = meses[MES_DEL_QUIEBRE];

  return (
    <div className="mt-7 rounded-surface-lg border border-border bg-surface px-[17px] py-[18px] shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-label uppercase text-muted">La respuesta</span>
        {/* Legible a propósito: es el rótulo que dice que la cifra es
            inventada, y un aviso de honestidad que no se lee no avisa. */}
        <span className="font-mono text-label uppercase text-muted">ejemplo</span>
      </div>

      <p className="mt-3.5 flex items-baseline gap-2.5">
        <span className="text-[36px] font-bold leading-none tracking-[-.03em] text-brick">No.</span>
        <span className="text-[14px] leading-[1.3] text-muted">
          Hasta {formatPeriodMonth(quiebre)}.
        </span>
      </p>

      <svg viewBox="0 0 316 76" className="mt-3.5 block h-[76px] w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="bajoCero" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B14D3B" stopOpacity=".16" />
            <stop offset="100%" stopColor="#B14D3B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M180 44 L190 47 L253 58 L316 68 L316 44 Z" fill="url(#bajoCero)" />
        <line x1="0" y1="44" x2="316" y2="44" className="stroke-border" strokeDasharray="3 4" />
        <polyline
          points="0,16 63,22 126,31 180,44"
          className="stroke-leaf"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="180,44 190,47 253,58 316,68"
          className="stroke-brick"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="180" cy="44" r="5" className="fill-surface stroke-brick" strokeWidth="2.2" />
      </svg>

      {/* 10px mono en muted: el mismo tratamiento que los meses del gráfico de
          flujo de verdad (CashflowBoard), para que los dos ejes se lean igual. */}
      <div className="mt-1 grid grid-cols-6 font-mono text-[10px] text-muted">
        {meses.map((mes, i) => (
          <span
            key={mes}
            className={[
              i === 0 ? "text-left" : i === meses.length - 1 ? "text-right" : "text-center",
              i === MES_DEL_QUIEBRE ? "font-semibold text-brick-ink" : "",
            ].join(" ")}
          >
            {formatPeriodShort(mes)}
          </span>
        ))}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border-row pt-3">
        <span className="text-[12px] text-muted">Te faltan</span>
        <span className="num text-[15px] font-semibold text-brick-ink">$ 412.000</span>
      </div>
    </div>
  );
}

function Punto({
  n,
  titulo,
  texto,
  ultimo,
}: {
  n: string;
  titulo: string;
  texto: string;
  ultimo?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3.5 py-[18px] ${ultimo ? "" : "border-b border-border-row"}`}
    >
      {/* En muted y no en un gris de borde: a #CBD2C9 sobre el fondo de la app
          no se leían, y una numeración que no se lee no numera nada. */}
      <span className="shrink-0 pt-[3px] font-mono text-[10px] text-muted">{n}</span>
      <div>
        <p className="text-[14px] font-semibold leading-[1.3] text-ink">{titulo}</p>
        <p className="help mt-0.5">{texto}</p>
      </div>
    </div>
  );
}

/** La flecha de los botones. Dibujada, no una entidad: `→` cambia de ancho y
 *  de alto según la tipografía que resuelva el sistema operativo. */
export function Flecha({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M2.5 8h11M9 3.5 13.5 8 9 12.5"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
