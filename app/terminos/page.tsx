import Link from "next/link";
import type { Metadata } from "next";
import { PaginaLegal, SeccionLegal, ListaLegal } from "@/components/PaginaLegal";
import { HORAS_DE_PRUEBA } from "@/lib/auth/prueba";

export const metadata: Metadata = {
  title: "Términos · ¿Llegás?",
  description: "Qué es ¿Llegás?, qué no es, y con qué te podés encontrar.",
};

/**
 * Los términos de uso.
 *
 * El punto que importa, y por el que esta página no es un trámite: **esto no
 * es asesoramiento financiero**. La app proyecta seis meses con los números que
 * la persona carga y con los que lee de un PDF, y las dos fuentes pueden estar
 * mal. Decirlo acá es lo mínimo; decirlo también en cada pantalla donde una
 * cifra pueda confundirse con una promesa es lo que la app ya hace.
 */
export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      bajada="Qué es esto, qué no es, y con qué te podés encontrar."
      actualizado="13 de septiembre de 2026"
    >
      <SeccionLegal titulo="Qué es ¿Llegás?">
        <p>
          Una herramienta para mirar tus deudas mes a mes: en qué mes te quedás sin plata, por
          qué crece cada saldo, y qué cambia si pagás distinto. Es gratis y la hacemos porque
          nos hacía falta.
        </p>
        <p>
          Usarla implica aceptar estos términos. Si no estás de acuerdo con algo de acá, no la
          uses — y si podés, contanos qué te frenó.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Esto NO es asesoramiento financiero">
        <p>
          Las proyecciones son estimaciones hechas con los números que vos cargás. No somos un
          banco, ni una entidad financiera, ni asesores de inversión, y nada de lo que diga la
          app es una recomendación profesional sobre qué hacer con tu plata.
        </p>
        <p>
          Cuando la app dice que un mes no cierra, está haciendo una cuenta con tus datos, no
          prediciendo el futuro. Las decisiones son tuyas y las consecuencias también.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Los números los cargás vos">
        <ListaLegal
          items={[
            <>
              <strong className="text-ink">Lo que leemos del PDF puede estar mal.</strong> El
              lector está atado a la maquetación del resumen de cada banco y se rompe cuando el
              banco la cambia. Por eso nunca guardamos directo lo que sale de ahí: te lo
              mostramos para que lo revises y lo confirmes.
            </>,
            <>
              <strong className="text-ink">El que manda es el resumen de tu banco.</strong> Si
              lo que ves en la app no coincide con lo que dice el banco, el que tiene razón es
              el banco. La app te muestra los dos números al lado justamente para que la
              diferencia se vea.
            </>,
            <>
              <strong className="text-ink">Las tasas y los cargos cambian.</strong> El interés,
              los impuestos y los mínimos salen de lo que declara cada resumen. Un mes sin
              cargar deja la proyección corriendo con datos viejos.
            </>,
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Tu cuenta">
        <ListaLegal
          items={[
            <>
              Sos responsable de tu clave y de lo que se haga desde tu cuenta. Usá una que no
              uses en el banco.
            </>,
            <>
              <strong className="text-ink">
                Las cuentas de prueba duran {HORAS_DE_PRUEBA} horas
              </strong>{" "}
              y después se borran con todo lo que tengan adentro. No tienen mail, así que no
              hay forma de recuperarlas: si querés conservar lo que cargaste, ponele tu mail
              antes.
            </>,
            <>
              Cargá datos tuyos. Si cargás los de otra persona —la tarjeta adicional de tu
              pareja, por ejemplo— asegurate de que esté de acuerdo.
            </>,
            <>
              Podés borrar todos tus datos cuando quieras desde Ajustes, y pedirnos la baja de
              la cuenta por mail.
            </>,
          ]}
        />
      </SeccionLegal>

      <SeccionLegal titulo="Qué no hacer">
        <p>
          No intentes romper la app, entrar a datos de otras cuentas, ni automatizar pedidos
          para saturarla. Es un proyecto chico: lo que en una empresa grande es una molestia,
          acá lo deja abajo para todos.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Disponibilidad y cambios">
        <p>
          La app se ofrece tal como está, sin garantía de que funcione siempre ni de que los
          resultados sean exactos. Puede haber interrupciones, errores, o un cálculo que
          mejoremos y cambie lo que veías la semana pasada.
        </p>
        <p>
          Podemos cambiar funciones, agregar otras o dejar de ofrecer el servicio. Si eso
          último llegara a pasar, avisaremos con tiempo para que puedas llevarte tus datos.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Responsabilidad">
        <p>
          En la medida en que la ley lo permita, no respondemos por daños derivados de usar la
          app o de no poder usarla, incluyendo decisiones tomadas a partir de sus proyecciones,
          pérdida de datos o interrupciones del servicio. Nada de esto limita los derechos que
          te correspondan como consumidor.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República Argentina, y cualquier disputa
          se resuelve ante los tribunales que correspondan según el domicilio del usuario.
        </p>
        <p>
          Consultas:{" "}
          <a href="mailto:okmanb@gmail.com" className="text-pine underline underline-offset-2">
            okmanb@gmail.com
          </a>
          . Qué hacemos con tus datos está en la{" "}
          <Link href="/privacidad" className="text-pine underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>
      </SeccionLegal>
    </PaginaLegal>
  );
}
