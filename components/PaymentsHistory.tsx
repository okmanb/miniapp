"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/calc/money";
import { currentPeriod } from "@/lib/calc/dates";
import { Card, EmptyState, PrimaryButton, Screen, Amount, MetaChip } from "@/components/ui";

/**
 * El cuerpo de la pantalla 15. Aparte de la página por lo mismo que la 03: sin
 * esto no había forma de mirarla sin sesión, y una pantalla que no se puede
 * mirar es una pantalla que nadie compara contra el prototipo.
 */
export interface PaymentRow {
  id: string;
  amount: number;
  period: string;
  paidOn: string | null;
  kind: string;
  debtName: string;
  /**
   * Si salió del campo "cuánto pagaste" de un resumen. Se marca porque es la
   * única fila que no se puede borrar desde acá: se corrige volviendo a cargar
   * el resumen, que es de donde sale.
   */
  fromStatement: boolean;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthTitle(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_ES[Number(month) - 1]} ${year}`;
}

/** El valor del filtro que no filtra. */
const TODOS = "todas";

const KIND_LABEL: Record<string, string> = {
  cuota_fija: "Cuota fija",
  pago_variable: "Pago",
  minimo_estimado: "Mínimo del resumen",
  unico: "Pago extra",
};

/**
 * Historial de pagos (pantalla 15).
 *
 * Agrupado por mes con subtotal, porque la pregunta real que trae a alguien
 * acá es "cuánto puse este mes", no "qué pagué el martes".
 *
 * Es de cliente por el filtro por tipo, que el prototipo tiene y acá faltaba.
 * `currentPeriod` vino de `lib/calc/dates` y no de `lib/data/dashboard` por
 * eso mismo: aquel módulo arrastra el cliente de Supabase al bundle.
 */
export function PaymentsHistory({ rows }: { rows: PaymentRow[] }) {
  const [filter, setFilter] = useState<string>(TODOS);

  /*
   * Los tipos que hay, no los que podría haber: el prototipo arma la fila con
   * los que aparecen en las filas. Un filtro que ofrece "cuota fija" cuando no
   * tenés ninguna es una promesa vacía.
   */
  const kinds: string[] = [];
  for (const row of rows) if (!kinds.includes(row.kind)) kinds.push(row.kind);

  const shown = filter === TODOS ? rows : rows.filter((r) => r.kind === filter);

  /*
   * No hay estado de "nada con este filtro", y es a propósito.
   *
   * El prototipo lo tiene porque además filtra por deuda: cambiando de deuda
   * con un tipo ya elegido se puede quedar sin filas. Acá los tipos salen de
   * las filas que hay, así que cada píldora tiene al menos un pago y `shown`
   * no puede quedar vacío. Escribir esa pantalla sería agregar una rama
   * inalcanzable, que es de lo que este proyecto ya se comió dos.
   */

  /*
   * Los totales NO siguen al filtro, como en el prototipo: son de todo lo
   * pagado. "Este mes" filtrado por tipo contestaría una pregunta que nadie
   * hizo, y encima se leería como si fuera el total del mes.
   */
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const thisMonth = rows
    .filter((r) => r.period === currentPeriod())
    .reduce((sum, r) => sum + r.amount, 0);

  const groups = new Map<string, PaymentRow[]>();
  for (const row of shown) {
    const list = groups.get(row.period) ?? [];
    list.push(row);
    groups.set(row.period, list);
  }

  return (
    <Screen>
      <Link
        href="/dashboard"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver al dashboard
      </Link>

      <h1 className="mt-2 text-screen text-ink">Historial de pagos</h1>
      <p className="help mt-1">Todo lo que registraste, de todas tus deudas, ordenado por mes.</p>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Todavía no registraste pagos"
            note="Cada pago que cargues baja el saldo de esa deuda y queda acá con su fecha."
            action={<PrimaryButton href="/dashboard">Ir a mis deudas</PrimaryButton>}
          />
        </div>
      ) : (
        <>
          <Card className="mt-4 px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">Este mes</span>
              <Amount className="text-[18px] font-semibold text-leaf-deep">
                {formatMoney(thisMonth)}
              </Amount>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
              <span className="text-[13px] text-muted">Desde que empezaste</span>
              <Amount className="text-[13px] text-ink">{formatMoney(total)}</Amount>
            </div>
          </Card>

          {/*
            La fila de filtros. Píldoras que scrollean al costado cuando no
            entran, con los colores del prototipo: el elegido en pine sólido,
            el resto en blanco con borde. Se sale del padding de la pantalla
            para que el scroll llegue hasta el borde, como él.
          */}
          {kinds.length > 1 && (
            <div className="-mx-[18px] mt-4 flex gap-[7px] overflow-x-auto px-[18px] pb-1">
              {[TODOS, ...kinds].map((k) => {
                const on = filter === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={on}
                    className="min-h-touch shrink-0 whitespace-nowrap rounded-pill border px-3 text-[12px] font-semibold transition-colors duration-150 ease-sd"
                    style={{
                      backgroundColor: on ? "#0E3A31" : "#FFFFFF",
                      borderColor: on ? "#0E3A31" : "#DEE3DD",
                      color: on ? "#FFFFFF" : "#5C6B65",
                    }}
                  >
                    {k === TODOS ? "Todos" : (KIND_LABEL[k] ?? k)}
                  </button>
                );
              })}
            </div>
          )}

          {[...groups.entries()].map(([groupPeriod, list]) => {
            const subtotal = list.reduce((sum, r) => sum + r.amount, 0);
            return (
              <section key={groupPeriod} className="mt-6">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-ink">{monthTitle(groupPeriod)}</h2>
                  <Amount className="text-[11.5px] text-muted">{formatMoney(subtotal)}</Amount>
                </div>

                <ul className="space-y-2">
                  {list.map((row) => (
                    <li key={row.id}>
                      <Card className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-card text-ink">{row.debtName}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <MetaChip>{KIND_LABEL[row.kind] ?? row.kind}</MetaChip>
                            {row.fromStatement && <MetaChip>Del resumen</MetaChip>}
                            {/*
                              El día solo, como el prototipo: el encabezado del
                              grupo ya dice el mes y el año, y repetirlos en cada
                              fila con la fecha ISO cruda —"2026-09-07"— era lo
                              único de esta pantalla escrito en un idioma que no
                              es el de la app.
                            */}
                            {row.paidOn && <MetaChip>Día {Number(row.paidOn.slice(8, 10))}</MetaChip>}
                          </div>
                        </div>
                        <Amount className="shrink-0 text-card-lg text-leaf-deep">
                          −{formatMoney(row.amount)}
                        </Amount>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </Screen>
  );
}
