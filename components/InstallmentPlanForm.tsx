"use client";

import { useMemo, useState, useTransition } from "react";
import { createInstallmentPlan } from "@/app/dashboard/debts/[id]/cuotas/actions";
import { installmentFor } from "@/lib/calc/installments";
import { formatMoney, parseMoney } from "@/lib/calc/money";
import { Spinner } from "./ui";

/**
 * Alta de una compra en cuotas.
 *
 * La cuota se muestra antes de guardar porque es el número que importa: nadie
 * recuerda el total de una compra en doce, todos recuerdan cuánto les sale por
 * mes. Y una compra en cuotas sube el saldo de la tarjeta hoy, así que el
 * formulario lo dice antes y no después.
 */
export function InstallmentPlanForm({ debtId }: { debtId: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const [total, setTotal] = useState("");
  const [count, setCount] = useState("6");
  const [tna, setTna] = useState("");

  const preview = useMemo(() => {
    const amount = parseMoney(total);
    const n = Math.round(Number(count.replace(/[^0-9]/g, ""))) || 0;
    if (amount <= 0 || n < 1 || n > 60) return null;

    const rate = tna.trim() === "" ? 0 : Number(tna.replace(",", "."));
    const monthly = Number.isFinite(rate) && rate > 0 ? rate / 100 / 12 : 0;
    const installment = Math.round(installmentFor(amount, n, monthly));

    return { installment, n, interest: Math.round(installment * n - amount) };
  }, [total, count, tna]);

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-ink">+ Agregar compra en cuotas</h2>

      <form
        className="mt-3"
        action={(formData) =>
          startTransition(async () => {
            const result = await createInstallmentPlan(formData);
            setStatus(
              result.ok
                ? {
                    ok: true,
                    message:
                      "Cargada. El total se sumó al saldo de la tarjeta, y la cuota entra en el flujo de cada mes.",
                  }
                : { ok: false, message: result.message }
            );
            if (result.ok) {
              setTotal("");
              setTna("");
              setCount("6");
            }
          })
        }
      >
        <input type="hidden" name="debt_id" value={debtId} />

        <label htmlFor="description" className="block text-label uppercase text-muted">
          Qué compraste
        </label>
        <input
          id="description"
          name="description"
          required
          autoComplete="off"
          placeholder="Heladera, pasaje, refinanciación"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        <label htmlFor="total" className="mt-5 block text-label uppercase text-muted">
          Monto total
        </label>
        <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
          <span className="font-mono text-[15px] text-muted" aria-hidden>
            $
          </span>
          <input
            id="total"
            name="total"
            required
            inputMode="numeric"
            placeholder="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="installments" className="block text-label uppercase text-muted">
              En cuántas cuotas
            </label>
            <input
              id="installments"
              name="installments"
              required
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
            />
          </div>
          <div>
            <label htmlFor="tna" className="block text-label uppercase text-muted">
              TNA % (opcional)
            </label>
            <input
              id="tna"
              name="tna"
              inputMode="decimal"
              placeholder="0"
              value={tna}
              onChange={(e) => setTna(e.target.value)}
              className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <p className="help mt-1.5">
          Si la compra es en cuotas sin interés, dejá la TNA vacía.
        </p>

        {preview && (
          <div className="mt-5 rounded-surface-lg border border-border bg-surface-sunken px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] text-muted">Te queda en</span>
              <span className="font-mono text-[15px] font-semibold text-ink">
                {formatMoney(preview.installment)} × {preview.n}
              </span>
            </div>
            {preview.interest > 0 && (
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-muted">Interés de la compra</span>
                <span className="font-mono text-[13px] text-ink">
                  {formatMoney(preview.interest)}
                </span>
              </div>
            )}
            <p className="help mt-2">
              El total se suma al saldo de la tarjeta hoy: comprar en cuotas no aplaza la deuda,
              aplaza los pagos.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          Agregar compra en cuotas
        </button>

        {status && (
          <p
            role="status"
            className="mt-3 text-[11.5px]"
            style={{ color: status.ok ? "#175F42" : "#823123" }}
          >
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
