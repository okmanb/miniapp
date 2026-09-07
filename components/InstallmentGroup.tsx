import { formatMoney } from "@/lib/calc/money";
import type { InstallmentPlanView } from "@/lib/calc/installments";
import { Card, Amount, MetaChip } from "@/components/ui";

/**
 * Un grupo de compras en cuotas: con costo financiero, sin costo financiero o
 * terminadas.
 *
 * Es un componente y no un bloque adentro de la pantalla para que el banco de
 * pruebas lo renderice con los datos del prototipo y se pueda comparar fila
 * por fila. Un layout que solo existe adentro de un server component no se
 * puede poner al lado del original.
 */
export function InstallmentGroup({
  title,
  count,
  hint,
  note,
  plans,
}: {
  title: string;
  count: number;
  hint?: string;
  note?: string;
  plans: InstallmentPlanView[];
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <span className="rounded-pill bg-track px-2 py-0.5 font-mono text-[10.5px] font-bold text-muted">
          {count}
        </span>
        {hint && <span className="text-[11px] text-muted">· {hint}</span>}
      </div>
      {note && <p className="help mt-1">{note}</p>}

      <ul className="mt-3 space-y-2">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Card className="px-4 py-3">
              <div className="text-card text-ink">{plan.description}</div>
              <div className="mt-1 text-[11.5px] text-muted">
                {plan.finished
                  ? `cuota ${plan.total}/${plan.total} · terminada`
                  : `cuota ${plan.current}/${plan.total} · termina ${plan.endsOn} · ${formatMoney(plan.amount)} por mes`}
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-row pt-2">
                <span className="text-label uppercase text-muted">Saldo</span>
                <Amount className="text-[15px] font-semibold text-ink">
                  {formatMoney(plan.balance)}
                </Amount>
              </div>

              <div className="mt-1.5">
                {plan.finished ? (
                  <MetaChip>✓ pagada por completo</MetaChip>
                ) : (plan.tna ?? 0) > 0 ? (
                  <MetaChip>{plan.tna!.toLocaleString("es-AR")}% TNA</MetaChip>
                ) : (
                  <MetaChip>cuota sin interés</MetaChip>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
