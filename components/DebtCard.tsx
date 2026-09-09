import Link from "next/link";
import { formatMoney } from "@/lib/calc/money";
import { DEBT_KINDS } from "@/app/dashboard/debts/validation";
import type { DashboardDebt } from "@/lib/data/dashboard";

/**
 * La tarjeta de una deuda en la lista del dashboard.
 *
 * Lo que la hace legible de un vistazo no es el saldo —ese ya estaba— sino la
 * barra de abajo: cuánto de esta deuda ya se pagó. `paidFraction` se venía
 * calculando en la capa de datos desde el principio, con su comentario
 * explicando que tenía que moverse sola al registrar un pago, y no la dibujaba
 * nadie.
 *
 * ## El tono, que acá se deriva y en el prototipo no
 *
 * El prototipo pinta tres cosas del mismo color —la barra de la izquierda, el
 * ícono y el relleno del progreso— pero ese color es un campo `accent` escrito
 * a mano en sus datos semilla, deuda por deuda. **No hay regla que copiar**:
 * su Mastercard Black es brick porque alguien la pintó brick, no porque algo
 * de esa deuda lo diga. Con sus propias cifras el mínimo cubre el interés de
 * sobra.
 *
 * Como acá ninguna cifra visible se escribe a mano, el tono sale de la deuda:
 *
 *  - `brick` cuando el saldo está creciendo, o sea cuando el mínimo no alcanza
 *    a cubrir el interés del mes. Es la única que pide una decisión.
 *  - `gold` cuando es de cuota fija y no tiene resumen que mirar: un préstamo.
 *    No está mal, pero tampoco se sigue igual que una tarjeta.
 *  - `pine` cuando no pasa ninguna de las dos.
 *
 * Que el rojo gane sobre el dorado es a propósito: un préstamo cuyo saldo
 * crece es primero un problema y después un préstamo.
 *
 * Consecuencia esperada: puesto al lado del prototipo con su mismo dataset,
 * todo coincide menos la Mastercard Black, que a él le queda brick y acá pine.
 * Si algún día hay que igualarlo, el que tiene que cambiar es el prototipo.
 */

type Tone = "pine" | "gold" | "brick";

const TONES: Record<Tone, { bar: string; ink: string; wash: string; fill: string; pct: string }> = {
  pine: {
    bar: "#0E3A31",
    ink: "#0E3A31",
    wash: "#E0F4E9",
    fill: "linear-gradient(90deg,#25835D,#5BB38A)",
    pct: "#175F42",
  },
  gold: {
    bar: "#A77530",
    ink: "#7A5116",
    wash: "#FCEEDC",
    fill: "linear-gradient(90deg,#A77530,#CA9B5A)",
    pct: "#7A5116",
  },
  brick: {
    bar: "#B14D3B",
    ink: "#823123",
    wash: "#FFE9E4",
    fill: "linear-gradient(90deg,#25835D,#5BB38A)",
    pct: "#175F42",
  },
};

const MONTHS_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * "10-sep": el día que vence y en qué mes cae la próxima vez. Solo con el día
 * —"vto. 7"— hay que hacer la cuenta de si ya pasó o no este mes, que es
 * justo lo que la tarjeta tendría que contestar sola.
 */
function nextDueLabel(dueDay: number, today: Date): string {
  const month = today.getDate() <= dueDay ? today.getMonth() : (today.getMonth() + 1) % 12;
  return `${String(dueDay).padStart(2, "0")}-${MONTHS_ABBR[month]}`;
}

function kindLabel(kind: string): string {
  return DEBT_KINDS.find((k) => k.value === kind)?.label ?? "Otro";
}

export function DebtCard({ debt, today }: { debt: DashboardDebt; today: Date }) {
  const tone = TONES[debt.growth ? "brick" : debt.dueDay == null ? "gold" : "pine"];
  const pct = Math.round(debt.paidFraction * 100);

  return (
    <Link
      href={`/dashboard/debts/${debt.id}`}
      className="relative block overflow-hidden rounded-[16px] border border-border bg-surface py-[14px] pl-[18px] pr-[28px] shadow-[0_16px_30px_-16px_rgba(14,58,49,.14),0_2px_6px_rgba(14,58,49,.05)] transition-colors duration-150 ease-sd hover:bg-surface-sunken"
    >
      {/* La barra del borde y el resplandor: decoración con dato adentro. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: tone.bar }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[45%] right-[-18%] h-[180px] w-[180px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(14,58,49,.14) 0%, transparent 72%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-[18px] leading-none"
        style={{ color: "#B8C2B8" }}
      >
        ›
      </span>

      <div className="relative flex items-start gap-3 pr-10">
        <span
          aria-hidden
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: tone.wash }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tone.ink}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-[1.28] text-ink">
            {debt.name}
          </span>

          <span className="mt-[7px] flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted">{kindLabel(debt.kind)}</span>
            <span
              className="whitespace-nowrap rounded-[5px] px-1.5 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.03em]"
              style={{ backgroundColor: "#E7EBE6", color: "#5C6B65" }}
            >
              {debt.dueDay != null ? `vto. ${nextDueLabel(debt.dueDay, today)}` : "cuota fija"}
            </span>
          </span>

          {debt.installmentCount > 0 && (
            <span className="mt-1 block text-[11px] text-muted">
              incluye {debt.installmentCount}{" "}
              {debt.installmentCount === 1 ? "compra en cuotas" : "compras en cuotas"}:{" "}
              {formatMoney(debt.installmentTotal)}
            </span>
          )}
        </span>
      </div>

      <div className="relative mt-4 flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-[14px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">Saldo</span>
        <span className="whitespace-nowrap font-mono text-[18px] font-semibold tracking-[-0.01em] text-ink">
          {formatMoney(debt.balance)}
        </span>
      </div>

      {/*
        Sin pagos registrados no hay barra. El prototipo la muestra siempre
        porque sus cinco deudas vienen con pagos hechos; en una deuda recién
        cargada una barra en cero no informa nada y sugiere que se empezó algo.
        La decisión ya estaba tomada acá y se conserva.

        Cuando sí va, se escala con `transform` y no con `width`, para que el
        navegador la anime en el compositor: se mueve sola al registrar un
        pago, y un salto de ancho ahí se ve como un parpadeo.
      */}
      {debt.paid > 0 && (
        <>
          <div
            className="relative mt-[14px] h-2 overflow-hidden rounded-pill border border-border"
            style={{ backgroundColor: "#EFF2EE" }}
            role="img"
            aria-label={`${pct}% saldado`}
          >
            <span
              data-motion-move
              className="block h-full rounded-pill"
              style={{
                background: tone.fill,
                transformOrigin: "left center",
                transform: `scaleX(${debt.paidFraction})`,
                transition: "transform 260ms cubic-bezier(.23,1,.32,1)",
              }}
            />
          </div>

          <div className="relative mt-[7px] flex justify-between gap-2.5">
            <span className="text-[10.5px] text-muted">{formatMoney(debt.paid)} pagado</span>
            <span className="font-mono text-[11px] font-semibold" style={{ color: tone.pct }}>
              {pct}%
            </span>
          </div>
        </>
      )}

      {debt.growth && (
        <p className="relative mt-2 border-t border-border-row pt-2 text-[11.5px] text-brick-ink">
          {debt.growth.kind === "interes"
            ? `El mínimo no cubre el interés de ${formatMoney(debt.growth.amount)} por mes — el saldo va a seguir creciendo.`
            : `Al mínimo le faltan ${formatMoney(debt.growth.amount)} por mes para que el saldo deje de crecer.`}
        </p>
      )}
    </Link>
  );
}
