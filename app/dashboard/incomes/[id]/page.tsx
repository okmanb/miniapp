import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/calc/money";
import { addMonths } from "@/lib/calc/cashflow";
import { currentPeriod, formatMonthName, formatPeriodLong } from "@/lib/calc/dates";
import { Screen, Card, MetaChip } from "@/components/ui";
import { IncomeEditor } from "@/components/IncomeEditor";

export const dynamic = "force-dynamic";

function whenLabel(kind: string, months: number[]): string {
  if (kind === "mensual" || months.length === 0) return "todos los meses";
  return months.map(formatMonthName).join(" y ");
}

/**
 * Un ingreso, con lo único que se le hace: cambiarle el monto.
 *
 * Existe por el aumento de sueldo, que hasta acá no tenía dónde registrarse: la
 * pantalla de ingresos solo sabía agregar. Y el aumento no es editar un número
 * —los meses que ya pasaron cobraron lo otro—, así que la decisión de si el
 * monto nuevo corrige o reemplaza es lo que esta pantalla pregunta.
 *
 * ## El historial es la mitad del argumento
 *
 * Si no se muestra lo que cobrabas antes, "el historial no se toca" es una
 * promesa que nadie puede verificar. Por eso abajo van los tramos cerrados, con
 * el monto y desde/hasta cuándo valió cada uno. Salen de las mismas filas que
 * usa la proyección: no hay una tabla de historial aparte, y no debería haberla.
 *
 * Los tramos se encuentran por descripción dentro del escenario, que es como
 * `updateIncomeAmount` arma el reemplazo. Dos ingresos distintos con el mismo
 * nombre se verían como uno solo — es el precio de no agregarle una columna al
 * modelo para algo que la persona ya distingue poniéndoles nombres distintos.
 */
export default async function IncomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: income } = await supabase
    .from("incomes")
    .select("id, description, amount, kind, eligible_months, period, ended_period, scenario_id")
    .eq("id", id)
    .maybeSingle();

  if (!income) notFound();

  const { data: anteriores } = await supabase
    .from("incomes")
    .select("id, amount, period, ended_period")
    .eq("scenario_id", income.scenario_id)
    .eq("description", income.description)
    .not("ended_period", "is", null)
    .order("period", { ascending: false });

  const tramos = (anteriores ?? []).filter((tramo) => tramo.id !== income.id);
  const mesActual = currentPeriod();
  const hayHistorial = income.period < mesActual;

  return (
    <Screen>
      <Link
        href="/dashboard/incomes"
        className="inline-flex min-h-touch items-center gap-1.5 text-[12px] text-muted hover:text-leaf"
      >
        <span aria-hidden>←</span> Volver a los ingresos
      </Link>

      <h1 className="mt-2 text-screen text-ink">{income.description}</h1>

      <Card className="mt-4 px-4 py-4">
        <div className="text-label uppercase text-muted">
          {income.ended_period ? "Último monto" : "Monto de hoy"}
        </div>
        <div className="mt-1 font-mono text-[28px] font-semibold text-ink">
          {formatMoney(Number(income.amount))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-row pt-3">
          <MetaChip>{whenLabel(income.kind, income.eligible_months ?? [])}</MetaChip>
          <MetaChip>desde {formatPeriodLong(income.period)}</MetaChip>
          {income.ended_period && (
            <MetaChip>ya no entra desde {formatPeriodLong(income.ended_period)}</MetaChip>
          )}
        </div>
      </Card>

      {income.ended_period ? (
        <p className="help mt-4">
          Este tramo está cerrado: dejó de contar en {formatPeriodLong(income.ended_period)} y se
          queda acá porque los meses anteriores contaron con él.
        </p>
      ) : (
        <IncomeEditor
          id={income.id}
          currentAmount={Number(income.amount)}
          hayHistorial={hayHistorial}
          desdeMes={formatPeriodLong(mesActual)}
        />
      )}

      {tramos.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[15px] font-semibold text-ink">Antes venía así</h2>
          <p className="help mt-1">
            Cada tramo siguió valiendo en los meses en que lo cobraste. La proyección de esos
            meses no cambia cuando el monto sube.
          </p>

          <ul className="mt-3 space-y-2">
            {tramos.map((tramo) => (
              <li
                key={tramo.id}
                className="flex items-baseline justify-between gap-3 border-b border-border-row pb-2 last:border-0"
              >
                <span className="text-[12px] text-muted">
                  {formatPeriodLong(tramo.period)} a{" "}
                  {formatPeriodLong(addMonths(tramo.ended_period!, -1))}
                </span>
                <span className="font-mono text-[13.5px] text-ink">
                  {formatMoney(Number(tramo.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
