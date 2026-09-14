import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estadoDePrueba } from "@/lib/auth/prueba";

/**
 * El cartel de la cuenta de prueba.
 *
 * Vive en el marco del tablero, así que aparece en las dieciséis pantallas
 * privadas y no solo en la primera. Es a propósito: la cuenta se borra sola, y
 * el momento en que eso importa es cualquiera —cargando un resumen, mirando la
 * proyección— no el instante en que entró.
 *
 * Dice **cuánto falta**, no "temporal" a secas. Un cartel que avisa sin decir
 * cuándo obliga a decidir a ciegas, que es justo lo que esta app no hace con
 * ninguna otra cifra.
 *
 * En gold y no en rojo: no hay nada roto ni vencido todavía. El rojo de este
 * sistema significa "te falta plata" y no se gasta en otra cosa.
 *
 * No se puede cerrar. Un aviso que se descarta y borra datos veinte horas
 * después es un aviso que no avisó.
 */
export async function CuentaDePrueba() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user?.is_anonymous) return null;

  const { etiqueta } = estadoDePrueba(user.created_at);

  return (
    <div className="mx-auto w-full max-w-[430px] px-[18px] pt-4">
      <div className="rounded-surface border border-gold-border bg-[#FCF4E7] px-4 py-3">
        <p className="text-[12px] font-semibold text-gold-ink">
          Estás probando con una cuenta temporal
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.5] text-gold-ink">
          Se borra sola {etiqueta}, con todo lo que cargues. Entrá con Google y queda guardada:
          no se pierde nada ni hay que volver a empezar.
        </p>
        <Link
          href="/signup?desde=prueba"
          className="mt-2.5 inline-flex min-h-touch items-center gap-1.5 text-[12px] font-semibold text-gold-ink underline underline-offset-2"
        >
          Guardar mi cuenta
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
