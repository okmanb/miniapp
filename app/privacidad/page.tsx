import Link from "next/link";
import type { Metadata } from "next";
import { PaginaLegal, SeccionLegal, ListaLegal } from "@/components/PaginaLegal";
import { HORAS_DE_PRUEBA } from "@/lib/auth/prueba";

export const metadata: Metadata = {
  title: "Privacidad · ¿Llegás?",
  description: "Qué datos guarda ¿Llegás?, dónde viven y cómo borrarlos.",
};

/**
 * La política de privacidad.
 *
 * Existe por dos motivos y el segundo es el bueno: Google la pide para publicar
 * la pantalla de consentimiento, y una app donde alguien escribe cuánto debe
 * tiene que poder decir en una pantalla qué hace con eso.
 *
 * **Todo lo que dice acá está verificado contra el código**, no es una
 * plantilla: el PDF no se guarda (`parse-actions.ts` lo dice y lo cumple), la
 * base está en `us-west-2`, no hay una sola librería de analítica en el
 * `package.json`, y las cuentas de prueba las borra el cron de la migración
 * 013. Si alguna de esas cosas cambia, esta página cambia en el mismo commit.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Privacidad"
      bajada="Qué guardamos, dónde vive, y cómo lo borrás."
      actualizado="13 de septiembre de 2026"
    >
      <SeccionLegal titulo="Lo más corto posible">
        <p>
          Guardamos lo que cargás para poder mostrarte la proyección, y nada más. No vendemos
          ni compartimos tus datos, no hay publicidad, no hay rastreadores, y no nos
          conectamos a ningún banco.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Qué guardamos">
        <ListaLegal
          items={[
            <>
              <strong className="text-ink">Tu cuenta:</strong> el mail, una clave cifrada que
              nunca vemos en claro, y el nombre si lo escribiste. Si entrás con Google,
              guardamos el mail y el nombre que Google nos pasa.
            </>,
            <>
              <strong className="text-ink">Tus números:</strong> deudas, saldos, tasas, días de
              vencimiento, pagos, ingresos, gastos fijos y los escenarios con los que probás
              alternativas.
            </>,
            <>
              <strong className="text-ink">Los resúmenes de tarjeta</strong> que cargás: el
              período, el saldo anterior, los consumos, el interés, los impuestos, el mínimo,
              cuánto se pagó, el total en dólares con su cotización, y las compras en cuotas
              con su cupón, su comercio y su tasa.
            </>,
            <>
              <strong className="text-ink">Tus preferencias de aviso:</strong> cuándo y sobre
              qué deudas querés que te avisemos.
            </>,
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Qué NO guardamos">
        <ListaLegal
          items={[
            <>
              <strong className="text-ink">El PDF del resumen.</strong> Se lee en el servidor
              para prellenar el formulario y se descarta ahí mismo: no se copia a ningún lado,
              no queda archivado, no se puede volver a abrir. Lo que queda son los números que
              vos confirmás.
            </>,
            <>
              <strong className="text-ink">Claves de tu banco.</strong> No te las pedimos nunca
              y no hay dónde escribirlas. Tampoco nos conectamos a tu banco.
            </>,
            <>
              <strong className="text-ink">Datos de tarjeta.</strong> Solo el nombre que le
              pusiste y los últimos cuatro números si vinieron en el resumen. Nunca el número
              completo ni el código de seguridad, que además no servirían para nada acá.
            </>,
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Dónde viven">
        <p>
          La base de datos y las cuentas las maneja <strong className="text-ink">Supabase</strong>,
          en servidores de Estados Unidos (región <span className="num">us-west-2</span>,
          Oregón). La app se sirve desde <strong className="text-ink">Vercel</strong>. Usar el
          servicio implica esa transferencia internacional de datos.
        </p>
        <p>
          Cada cuenta ve únicamente sus propias filas, y eso lo hace cumplir la base de datos
          —no la aplicación— con reglas por usuario sobre cada tabla.
        </p>
        <p>
          La app le pregunta al <strong className="text-ink">BCRA</strong> el valor de la UVA y
          la inflación, que son datos públicos. En esa consulta no viaja nada tuyo.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Cookies y lo que queda en tu navegador">
        <p>
          Una sola cookie, la de tu sesión: es lo que te mantiene adentro entre una pantalla y
          la siguiente. No hay cookies de analítica ni de publicidad, y no hay una sola
          librería de rastreo en el código.
        </p>
        <p>
          Si probás sin cuenta, lo que cargás en los tres pasos queda en el{" "}
          <span className="num">localStorage</span> de tu navegador hasta que entres: ahí se
          sube a tu cuenta y se limpia de ahí.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Cuánto dura cada cosa">
        <ListaLegal
          items={[
            <>
              <strong className="text-ink">
                Las cuentas de prueba se borran solas a las {HORAS_DE_PRUEBA} horas
              </strong>
              , con todo lo que hayan cargado. No tienen mail ni ningún dato que te
              identifique. Ponerle tu mail las convierte en una cuenta común y dejan de
              borrarse.
            </>,
            <>
              <strong className="text-ink">Las tarjetas que borrás</strong> salen de la vista en
              el momento y se eliminan del todo a los 7 días, con sus resúmenes, pagos y
              cuotas.
            </>,
            <>
              <strong className="text-ink">
                El resto queda mientras tengas la cuenta abierta.
              </strong>{" "}
              No hay borrado automático de tus datos: los borrás vos cuando quieras.
            </>,
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Cómo borrar todo">
        <p>
          En <strong className="text-ink">Ajustes → Borrar todos mis datos</strong> se van las
          deudas, los pagos, los ingresos, los gastos, los resúmenes y los escenarios. Es
          inmediato y no tiene vuelta atrás.
        </p>
        <p>
          Eso deja la cuenta abierta y vacía. Si además querés que borremos la cuenta,
          escribinos a{" "}
          <a href="mailto:okmanb@gmail.com" className="text-pine underline underline-offset-2">
            okmanb@gmail.com
          </a>{" "}
          desde la dirección de esa cuenta y la damos de baja.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Tus derechos">
        <p>
          Podés pedir acceso, rectificación, actualización o supresión de tus datos personales
          escribiendo al mail de arriba. La mayor parte la podés hacer sin pedir permiso: todo
          lo que guardamos se ve y se edita en pantalla.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de
          la Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos que
          interpongan quienes resulten afectados en sus derechos por incumplimiento de las
          normas vigentes en materia de protección de datos personales.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Si esto cambia">
        <p>
          Esta página cambia cuando cambia lo que hace la app, y la fecha de arriba lo muestra.
          Si el cambio es de fondo —datos nuevos, o un tercero nuevo— te lo avisamos dentro de
          la app antes de que pase.
        </p>
        <p>
          Dudas, pedidos o algo que no cuadre:{" "}
          <a href="mailto:okmanb@gmail.com" className="text-pine underline underline-offset-2">
            okmanb@gmail.com
          </a>
          . También podés leer los{" "}
          <Link href="/terminos" className="text-pine underline underline-offset-2">
            términos de uso
          </Link>
          .
        </p>
      </SeccionLegal>
    </PaginaLegal>
  );
}
