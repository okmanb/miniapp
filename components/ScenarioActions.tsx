"use client";

import { useState, useTransition } from "react";
import {
  activateScenario,
  createScenario,
  duplicateScenario,
} from "@/app/dashboard/scenarios/actions";
import { ChoiceGroup } from "./ChoiceGroup";
import { Spinner } from "./ui";

const NOTE_MAX = 200;

/**
 * Acciones de un escenario. Copiar pide el nombre antes de hacer nada: una
 * copia llamada "Plan base (copia)" en una lista de escenarios que ya se
 * parecen entre sí no se distingue de nada.
 */
export function ScenarioActions({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-border-row pt-3">
      <div className="flex flex-wrap gap-2">
        {!isActive && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await activateScenario(id);
                if (!result.ok) setError(result.message);
              })
            }
            className="flex min-h-touch items-center gap-2 rounded-pill bg-teal px-[14px] py-2 text-[12px] font-semibold text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Activar
          </button>
        )}

        <button
          type="button"
          onClick={() => setCopying((v) => !v)}
          aria-expanded={copying}
          className="min-h-touch rounded-pill border border-border bg-surface px-[14px] py-2 text-[12px] font-semibold text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
        >
          {copying ? "Cancelar" : "Copiar tal cual"}
        </button>
      </div>

      {copying && (
        <form
          className="mt-3 flex items-center gap-2"
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await duplicateScenario(formData);
              if (result.ok) setCopying(false);
              else setError(result.message);
            })
          }
        >
          <input type="hidden" name="source_id" value={id} />
          <input
            name="name"
            required
            autoFocus
            defaultValue={`${name} — variante`}
            aria-label="Nombre de la copia"
            className="min-h-touch flex-1 rounded-surface border border-border-input bg-surface px-3 text-[13px] text-ink outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-touch items-center gap-2 rounded-pill bg-teal px-[14px] py-2 text-[12px] font-semibold text-white hover:bg-teal-hover disabled:opacity-70"
          >
            {pending && <Spinner className="text-white" />}
            Copiar
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export interface SeedOption {
  id: string;
  name: string;
  startingBalance: number;
  monthlyIncome: number;
  monthlyFixed: number;
}

/**
 * Alta de un escenario.
 *
 * Elegir de dónde copiar precarga los números de ese plan. Es la diferencia
 * entre "probá otra cosa" y "volvé a cargar todo para probar otra cosa", y sin
 * eso nadie crea un segundo escenario.
 *
 * Lo que copia y lo que no está dicho en el formulario y no es un detalle: las
 * deudas vienen del plan copiado, tu ingreso y tu gasto fijo se escriben acá.
 */
export function NewScenarioForm({
  isFirst = false,
  seeds,
}: {
  isFirst?: boolean;
  seeds: SeedOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [note, setNote] = useState("");
  const [seed, setSeed] = useState("");
  const [startBalance, setStartBalance] = useState("");
  const [income, setIncome] = useState("");
  const [fixed, setFixed] = useState("");

  function pickSeed(value: string) {
    setSeed(value);
    const source = seeds.find((s) => s.id === value);
    setStartBalance(source ? String(Math.round(source.startingBalance)) : "");
    setIncome(source ? String(Math.round(source.monthlyIncome)) : "");
    setFixed(source ? String(Math.round(source.monthlyFixed)) : "");
  }

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-ink">+ Nuevo escenario</h2>

      <form
        className="mt-3"
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const result = await createScenario(formData);
            if (result.ok) {
              setDone(true);
              setNote("");
              pickSeed("");
            } else {
              setDone(false);
              setError(result.message);
            }
          })
        }
      >
        <label htmlFor="scenario-name" className="block text-label uppercase text-muted">
          Nombre
        </label>
        <input
          id="scenario-name"
          name="name"
          required
          defaultValue={isFirst ? "Plan base" : ""}
          placeholder="Plan de contingencia"
          className="mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        <div className="mt-5 flex items-baseline justify-between gap-2">
          <label htmlFor="scenario-note" className="text-label uppercase text-muted">
            Notas (opcional)
          </label>
          <span className="font-mono text-[10.5px] text-muted">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
        <textarea
          id="scenario-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full resize-none rounded-surface border border-border-input bg-surface px-3 py-2 text-[14px] text-ink outline-none"
        />
        <p className="help mt-1.5">
          Para recordarte después qué cambiaste en este plan.
        </p>

        {seeds.length > 0 && (
          <>
            {/*
              En dos columnas y no apilado: los nombres de escenario son
              cortos —"Plan base", "Plan de contingencia"— y así lo dibuja el
              prototipo. El que se pase de largo se recorta con puntos
              suspensivos, porque acá el nombre lo escribe la persona.
            */}
            <ChoiceGroup
              name="seed"
              label="Arrancar copiando las deudas de"
              value={seed}
              onChange={pickSeed}
              layout="grid"
              options={[
                ...seeds.map((s) => ({ value: s.id, label: s.name })),
                { value: "", label: "Ninguno (vacío)" },
              ]}
              help="Precargamos los números de ese plan — cambiá los que quieras probar distinto."
            />
          </>
        )}

        <MoneyField
          id="starting_balance"
          label="Saldo de partida"
          value={startBalance}
          onChange={setStartBalance}
        />
        <MoneyField
          id="monthly_income"
          label="Ingresos por mes"
          value={income}
          onChange={setIncome}
        />
        <MoneyField
          id="monthly_fixed"
          label="Gastos fijos por mes"
          value={fixed}
          onChange={setFixed}
        />

        <p className="help mt-1.5">
          Las deudas del mes las toma del plan que copiás. Acá cambiás tu lado de la cuenta.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex min-h-touch w-full items-center justify-center gap-2 rounded-pill bg-teal px-[14px] py-[11px] text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover disabled:opacity-70"
        >
          {pending && <Spinner className="text-white" />}
          Crear escenario
        </button>

        {done && (
          <p role="status" className="mt-3 text-[11.5px] text-leaf-deep">
            {isFirst
              ? "Listo, y quedó activo. Ya podés cargar tu primera deuda."
              : "Listo. Está en la lista de arriba, todavía sin activar."}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[11.5px] text-brick-ink">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor={id} className="mt-5 block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-2 flex items-center rounded-surface border border-border-input bg-surface px-3">
        <span className="font-mono text-[15px] text-muted" aria-hidden>
          $
        </span>
        <input
          id={id}
          name={id}
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-touch w-full bg-transparent px-2 font-mono text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </div>
    </>
  );
}
