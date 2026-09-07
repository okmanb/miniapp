"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEBT_TYPES,
  debtTypeOf,
  emptyDraft,
  estimatedMinimum,
  monthlyInterest,
  paymentCapacity,
  readDraft,
  writeDraft,
  type OnboardingDebtKind,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";
import { formatMoney } from "@/lib/calc/money";
import { nextDueDate, formatDayMonth, daysUntil, dueInLabel } from "@/lib/calc/dates";

/**
 * Onboarding (pantalla 00): tres pasos que terminan con algo accionable.
 *
 * No pide cuenta. El prototipo lo dice explícito —"no hace falta crear
 * cuenta"— y la razón se nota en el paso 3: alguien que llega con una deuda
 * encima necesita ver qué hacer esta semana antes de que le pidan un mail.
 * Lo cargado vive en el navegador hasta que decida guardarlo.
 *
 * Los tres pasos son un solo componente y no tres rutas: el borrador se
 * comparte, volver atrás no puede perder lo escrito, y no hay estado que
 * sincronizar con la URL.
 */
export function OnboardingFlow() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // El borrador se lee después del primer render: en el servidor no hay
  // localStorage, y leerlo durante el render rompería la hidratación.
  useEffect(() => {
    const saved = readDraft();
    if (saved) setDraft(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeDraft(draft);
  }, [draft, loaded]);

  function patch(next: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  /** Elegir el tipo reescribe tasa y día: son los típicos de ese tipo. */
  function pickKind(kind: OnboardingDebtKind) {
    const type = debtTypeOf(kind);
    patch({ kind, annualRate: type.annualRate, dueDay: type.dueDay });
  }

  return (
    <main
      data-motion
      className="animate-screen-in mx-auto w-full max-w-[430px] px-[18px] pb-16 pt-8"
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="font-mono text-[12px] uppercase text-leaf-deep"
          style={{ letterSpacing: ".08em" }}
        >
          Simuladeudas
        </p>
        <p
          className="font-mono text-[10.5px] uppercase text-muted"
          style={{ letterSpacing: ".06em" }}
        >
          Paso {step} de 3
        </p>
      </div>

      {/* Tres tramos, no una barra: se ve cuántos faltan, no un porcentaje. */}
      <div className="mt-3 flex gap-1" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            data-motion-move
            className="h-1 flex-1 rounded-pill transition-colors duration-200 ease-sd"
            style={{ backgroundColor: n <= step ? "#25835D" : "#E7EBE6" }}
          />
        ))}
      </div>

      {step === 1 && (
        <StepDebt
          draft={draft}
          error={error}
          onPickKind={pickKind}
          onPatch={patch}
          onContinue={() => {
            if (!(draft.balance > 0)) {
              setError("Escribí cuánto debés hoy, aunque sea aproximado");
              return;
            }
            setError(null);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <StepCapacity
          draft={draft}
          onPatch={patch}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && <StepToday draft={draft} />}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* 1 · La deuda                                                                */
/* -------------------------------------------------------------------------- */

function StepDebt({
  draft,
  error,
  onPickKind,
  onPatch,
  onContinue,
}: {
  draft: OnboardingDraft;
  error: string | null;
  onPickKind: (kind: OnboardingDebtKind) => void;
  onPatch: (next: Partial<OnboardingDraft>) => void;
  onContinue: () => void;
}) {
  const type = debtTypeOf(draft.kind);

  return (
    <>
      <h1 className="mt-6 text-screen text-ink">Empecemos por una deuda</h1>
      <p className="help mt-2">
        No hace falta crear cuenta ni tener los datos exactos. Con el saldo aproximado ya
        podemos mostrarte qué pasa este mes.
      </p>

      <h2 className="mt-6 text-label uppercase text-muted">¿Qué tipo de deuda es?</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {DEBT_TYPES.map((option) => {
          const active = option.value === draft.kind;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onPickKind(option.value)}
              aria-pressed={active}
              className="min-h-touch rounded-surface-lg border px-3 py-3 text-left transition-colors duration-150 ease-sd"
              style={{
                backgroundColor: active ? "#E0F4E9" : "#FFFFFF",
                borderColor: active ? "#BEE1CE" : "#DEE3DD",
              }}
            >
              <span className="block text-card" style={{ color: active ? "#175F42" : "#12211D" }}>
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted">{option.note}</span>
            </button>
          );
        })}
      </div>

      <label htmlFor="balance" className="mt-6 block text-label uppercase text-muted">
        Saldo que debés hoy
      </label>
      <div
        className="mt-2 flex items-center rounded-surface border bg-surface px-3"
        style={{ borderColor: error ? "#F2C7BE" : "#D3DAD2" }}
      >
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id="balance"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={draft.balance ? String(draft.balance) : ""}
          onChange={(e) => onPatch({ balance: Number(e.target.value.replace(/\D/g, "")) })}
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[11.5px] text-brick-ink">
          {error}
        </p>
      ) : (
        <p className="help mt-1.5">
          Un número aproximado sirve. Lo vas a poder corregir cuando llegue el resumen.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="rate" className="block text-label uppercase text-muted">
            Tasa anual (%)
          </label>
          <input
            id="rate"
            inputMode="decimal"
            autoComplete="off"
            value={draft.annualRate.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            onChange={(e) =>
              onPatch({
                annualRate: Number(e.target.value.replace(/\./g, "").replace(",", ".")) || 0,
              })
            }
            className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 font-mono text-[15px] text-ink outline-none"
          />
        </div>
        <div>
          <label htmlFor="dueDay" className="block text-label uppercase text-muted">
            Día de vto.
          </label>
          <select
            id="dueDay"
            value={draft.dueDay}
            onChange={(e) => onPatch({ dueDay: Number(e.target.value) })}
            className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="help mt-1.5">
        Prellenamos la tasa típica de {type.label.toLowerCase()}. Si no la sabés, dejala así:
        sirve para estimar.
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
      >
        Continuar <span aria-hidden>→</span>
      </button>

      <Link
        href="/dashboard/statements/new"
        className="mt-3 flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        Importar resumen de tarjeta
      </Link>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 2 · La capacidad                                                            */
/* -------------------------------------------------------------------------- */

function StepCapacity({
  draft,
  onPatch,
  onBack,
  onContinue,
}: {
  draft: OnboardingDraft;
  onPatch: (next: Partial<OnboardingDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const capacity = paymentCapacity(draft);
  const hasIncome = draft.monthlyIncome > 0;

  return (
    <>
      <h1 className="mt-6 text-screen text-ink">¿Con cuánto contás por mes?</h1>
      <p className="help mt-2">
        Esto define cuánto podés destinar a la deuda sin quedarte corto para vivir. Dos
        números y seguimos.
      </p>

      <MoneyField
        id="income"
        label="Ingreso mensual"
        help="Sueldo, facturación, todo lo que entra en un mes normal."
        value={draft.monthlyIncome}
        onChange={(monthlyIncome) => onPatch({ monthlyIncome })}
      />
      <MoneyField
        id="fixed"
        label="Gastos fijos del mes"
        help="Alquiler, servicios, comida, transporte. Sin contar los pagos de deuda."
        value={draft.fixedExpenses}
        onChange={(fixedExpenses) => onPatch({ fixedExpenses })}
      />

      {/*
        La capacidad no se pide: se deriva. Mientras falte el ingreso muestra
        una raya y explica qué falta, en vez de un cero que parecería un
        resultado.
      */}
      <div className="mt-6 rounded-surface-lg bg-mint-wash px-4 py-3">
        <div className="text-label uppercase text-muted">Capacidad de pago</div>
        <div
          className="mt-1 font-mono text-[22px] font-semibold"
          style={{ color: capacity < 0 ? "#94362A" : "#175F42" }}
        >
          {hasIncome ? formatMoney(capacity) : "—"}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {!hasIncome
            ? "Cargá tu ingreso y calculamos con cuánto contás para las deudas."
            : capacity < 0
              ? "Los gastos fijos ya superan lo que entra. Te vamos a mostrar el mes igual, sin maquillarlo."
              : "Es lo que queda después de vivir. De acá sale lo que puede ir a la deuda."}
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
      >
        Ver qué hacer hoy <span aria-hidden>→</span>
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-3 flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        Volver
      </button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 3 · Qué hacer hoy                                                           */
/* -------------------------------------------------------------------------- */

function StepToday({ draft }: { draft: OnboardingDraft }) {
  const type = debtTypeOf(draft.kind);
  const due = nextDueDate(draft.dueDay);
  const days = daysUntil(due);
  const minimum = estimatedMinimum(draft.balance);
  const interest = monthlyInterest(draft.balance, draft.annualRate);
  const capacity = paymentCapacity(draft);
  const surplus = capacity - minimum;

  return (
    <>
      <h1 className="mt-6 text-screen text-ink">Tu próximo vencimiento</h1>
      <p className="help mt-2">
        Esto es lo único que te tiene que ocupar esta semana. El resto puede esperar.
      </p>

      <section
        data-motion
        className="animate-card-in mt-5 overflow-hidden rounded-surface-lg border border-border bg-surface"
      >
        <div className="px-4 py-3" style={{ backgroundColor: days <= 3 ? "#FDF0EC" : "#F3F6F2" }}>
          <div
            className="font-mono text-[10px] uppercase"
            style={{ letterSpacing: ".06em", color: days <= 3 ? "#B14D3B" : "#5C6B65" }}
          >
            {dueInLabel(days)}
          </div>
          <div className="mt-0.5 text-card-lg text-ink">{formatDayMonth(due)}</div>
          <div className="mt-0.5 text-[11.5px] text-muted">{type.label}</div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border-row border-t border-border-row">
          <div className="px-4 py-3">
            <div className="text-label uppercase text-muted">Pago mínimo</div>
            <div className="mt-1 font-mono text-[18px] font-semibold text-ink">
              {formatMoney(minimum)}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-label uppercase text-muted">Interés del mes</div>
            <div className="mt-1 font-mono text-[18px] font-semibold text-ink">
              {formatMoney(interest)}
            </div>
          </div>
        </div>
      </section>

      <h2 className="mt-6 text-[15px] font-semibold text-ink">Qué hacer hoy</h2>
      <ul className="mt-2 space-y-2">
        <Advice>
          {capacity >= minimum ? (
            <>
              El mínimo de {formatMoney(minimum)} entra en lo que te queda. Pagalo antes del{" "}
              {formatDayMonth(due)} y no se suman recargos.
            </>
          ) : (
            <>
              El mínimo de {formatMoney(minimum)} no entra en lo que te queda este mes. Pagá lo
              que puedas antes del {formatDayMonth(due)}: pagar de menos cuesta menos que no
              pagar.
            </>
          )}
        </Advice>

        {surplus > 0 && (
          <Advice>
            Te sobran {formatMoney(surplus)} por encima del mínimo. Puestos acá, recortan
            interés todos los meses.
          </Advice>
        )}

        {minimum < interest && (
          <Advice tone="brick">
            Ojo: el mínimo no cubre el interés de {formatMoney(interest)}. Pagando solo el
            mínimo, el saldo va a crecer igual.
          </Advice>
        )}
      </ul>

      {/*
        El orden es el del prototipo y no es un detalle: la accion principal
        es seguir usando la app, no registrarse. Poner "guardar con una
        cuenta" primero convertiria la pantalla en un muro de registro, que es
        justo lo que el texto de abajo promete que no va a pasar.
      */}
      <Link
        href="/dashboard"
        className="mt-7 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
      >
        Ir a mi tablero <span aria-hidden>→</span>
      </Link>

      <Link
        href="/signup?desde=onboarding"
        className="mt-3 flex min-h-touch w-full items-center justify-center rounded-pill border border-border bg-surface px-[14px] py-[11px] text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        Guardar esto con una cuenta
      </Link>

      <p className="help mt-3 text-center">
        Podés seguir sin cuenta. Te la vamos a pedir recién cuando quieras guardar.
      </p>
    </>
  );
}

function Advice({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brick";
}) {
  const brick = tone === "brick";
  return (
    <li
      className="rounded-surface border px-4 py-3 text-[12px] leading-[1.5]"
      style={{
        backgroundColor: brick ? "#FFF6F3" : "#FFFFFF",
        borderColor: brick ? "#F2C7BE" : "#DEE3DD",
        color: brick ? "#823123" : "#12211D",
      }}
    >
      {children}
    </li>
  );
}

function MoneyField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value ? String(value) : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")))}
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className="help mt-1.5">{help}</p>
    </div>
  );
}
