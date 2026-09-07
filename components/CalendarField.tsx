"use client";

import { useEffect, useState } from "react";

/**
 * El calendario del prototipo, en sus tres modos.
 *
 * Es uno solo para todas las fechas de la app y no seis controles distintos:
 * elegir el día que vence una tarjeta, el mes de un bono y la fecha exacta de
 * un pago son la misma acción con distinto grano, y el `<select>` nativo de
 * "Día 1 … Día 31" obliga a scrollear una lista de 31 items para contestar una
 * pregunta que un calendario responde de un vistazo.
 *
 *  - `day`   → un día del mes que se repite todos los meses (vencimientos).
 *  - `month` → un mes del año (bono, resumen, devolución de un puente).
 *  - `date`  → una fecha exacta (cuándo salió la plata de la cuenta).
 *
 * Elegir aplica y cierra, como en el prototipo: no hay un segundo paso de
 * confirmar algo que ya se ve arriba en el encabezado.
 */

/**
 * `monthOfYear` guarda solo el número de mes (1-12), sin año: un bono entra
 * "en septiembre", todos los años, y atarlo a un año concreto lo volvería un
 * ingreso de una sola vez.
 */
export type CalendarMode = "day" | "month" | "monthOfYear" | "date";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Semana que arranca el lunes, como el prototipo. */
const DOW_ES = ["LU", "MA", "MI", "JU", "VI", "SÁ", "DO"];

function iso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function longDate(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cómo se lee el valor elegido en el botón y en el encabezado del panel. */
export function describeCalendarValue(mode: CalendarMode, value: string): string {
  if (!value) {
    if (mode === "day") return "Sin día elegido";
    return mode === "date" ? "Sin fecha elegida" : "Sin mes elegido";
  }
  if (mode === "day") return `Día ${Number(value)} de cada mes`;
  if (mode === "monthOfYear") return `${capitalize(MONTHS_ES[Number(value) - 1])}, todos los años`;
  if (mode === "month") {
    const [year, month] = value.split("-").map(Number);
    return `${capitalize(MONTHS_ES[month - 1])} de ${year}`;
  }
  return longDate(value);
}

export function CalendarField({
  id,
  name,
  label,
  mode,
  value,
  onChange,
  kicker,
  note,
  help,
  min,
}: {
  id: string;
  /** Nombre del campo oculto que viaja en el form. */
  name?: string;
  label: string;
  mode: CalendarMode;
  /** "10" en modo day, "2026-09" en month, "2026-09-07" en date. */
  value: string;
  onChange: (value: string) => void;
  /** Título del encabezado verde del panel. */
  kicker: string;
  /** La línea que explica qué significa elegir esto. */
  note: string;
  /** Ayuda debajo del botón, en la pantalla. */
  help?: string;
  /** Solo modo month: el primer mes elegible, "2026-10". */
  min?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>

      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-touch w-full items-center justify-between gap-2 rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink transition-colors duration-150 ease-sd hover:bg-surface-sunken"
      >
        <span className={value ? "text-ink" : "text-muted"}>
          {describeCalendarValue(mode, value)}
        </span>
        <CalendarIcon />
      </button>

      {help && <p className="help mt-1.5">{help}</p>}

      {open && (
        <CalendarSheet
          mode={mode}
          value={value}
          kicker={kicker}
          note={note}
          min={min}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function CalendarSheet({
  mode,
  value,
  kicker,
  note,
  min,
  onPick,
  onClose,
}: {
  mode: CalendarMode;
  value: string;
  kicker: string;
  note: string;
  min?: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const today = new Date();

  // El panel arranca mostrando el mes de lo ya elegido; si no hay nada, el de hoy.
  const [cursor, setCursor] = useState(() => {
    if (mode === "month" && value) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    if (mode === "date" && value) {
      const d = new Date(`${value}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  // Escape cierra: es un diálogo modal y quedarse encerrado en él sería peor
  // que no tenerlo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMonthGrid = mode === "month" || mode === "monthOfYear";

  function shift(dir: number) {
    setCursor((c) => {
      if (isMonthGrid) return { ...c, year: c.year + dir };
      const d = new Date(c.year, c.month + dir, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function pickToday() {
    if (mode === "day") onPick(String(today.getDate()));
    else if (mode === "monthOfYear") onPick(String(today.getMonth() + 1));
    else if (mode === "month")
      onPick(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    else onPick(iso(today));
  }

  // Un mes sin año no tiene de qué navegar: el encabezado dice qué se elige.
  const header = mode === "monthOfYear"
    ? "Un mes del año"
    : isMonthGrid
    ? String(cursor.year)
    : `${capitalize(MONTHS_ES[cursor.month])} ${cursor.year}`;

  const preview = describeCalendarValue(mode, value);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 animate-banner-in bg-[rgba(18,33,29,.5)]"
        data-motion
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={kicker}
        data-motion
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] animate-card-in overflow-hidden rounded-t-[22px] border border-[rgba(14,58,49,.1)] bg-surface pb-3 shadow-[0_-26px_54px_-20px_rgba(14,58,49,.45)]"
      >
        <div className="flex justify-center pt-[9px]">
          <span className="h-1 w-[34px] rounded-pill bg-[#DDE4DD]" aria-hidden />
        </div>

        {/* El encabezado dice qué se está eligiendo y qué consecuencia tiene. */}
        <div
          className="relative mx-[10px] mt-[9px] overflow-hidden rounded-[14px] px-[14px] py-3 text-white"
          style={{ background: "linear-gradient(160deg,#0E3A31,#134A3E)" }}
        >
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/60">
            {kicker}
          </div>
          <div className="mt-1 text-[16px] font-semibold tracking-[-0.02em]">{preview}</div>
          <p className="mt-[3px] text-[11px] leading-[1.4] text-white/70">{note}</p>
        </div>

        <div className="flex items-center justify-between gap-[10px] px-4 pb-1.5 pt-[10px]">
          {mode === "monthOfYear" ? (
            <span className="w-[34px]" aria-hidden />
          ) : (
            <ArrowButton label="Anterior" onClick={() => shift(-1)}>
              ‹
            </ArrowButton>
          )}
          <div className="flex-1 text-center text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
            {header}
          </div>
          {mode === "monthOfYear" ? (
            <span className="w-[34px]" aria-hidden />
          ) : (
            <ArrowButton label="Siguiente" onClick={() => shift(1)}>
              ›
            </ArrowButton>
          )}
        </div>

        {isMonthGrid ? (
          <MonthGrid mode={mode} cursor={cursor} value={value} min={min} onPick={onPick} />
        ) : (
          <DayGrid cursor={cursor} mode={mode} value={value} today={today} onPick={onPick} />
        )}

        <div className="mt-2 flex gap-2 border-t border-border-row px-4 pt-3">
          <button
            type="button"
            onClick={pickToday}
            className="min-h-touch flex-1 rounded-pill border border-border bg-surface-sunken px-4 text-card text-pine transition-colors duration-150 ease-sd hover:bg-surface"
          >
            {isMonthGrid ? "Este mes" : "Hoy"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch flex-1 rounded-pill bg-teal px-4 text-card text-white transition-colors duration-150 ease-sd hover:bg-teal-hover"
          >
            Listo
          </button>
        </div>
      </div>
    </>
  );
}

function DayGrid({
  cursor,
  mode,
  value,
  today,
  onPick,
}: {
  cursor: { year: number; month: number };
  mode: CalendarMode;
  value: string;
  today: Date;
  onPick: (value: string) => void;
}) {
  // Lunes primero: `getDay()` devuelve domingo=0, así que se rota.
  const lead = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const todayIso = iso(today);

  return (
    <div className="px-3">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {DOW_ES.map((d) => (
          <div key={d} className="py-1 text-center font-mono text-[9.5px] text-muted">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}

        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const cellIso = iso(new Date(cursor.year, cursor.month, day));
          const selected = mode === "day" ? Number(value) === day : value === cellIso;
          const isToday = cellIso === todayIso;

          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(mode === "day" ? String(day) : cellIso)}
              className="flex aspect-square items-center justify-center rounded-pill border font-mono text-[13px] transition-colors duration-150 ease-sd"
              style={{
                backgroundColor: selected ? "#0E3A31" : isToday ? "#E0F4E9" : "transparent",
                color: selected ? "#97DCBA" : "#12211D",
                borderColor: selected ? "#0E3A31" : isToday ? "#8FBCA6" : "transparent",
                borderStyle: isToday && !selected ? "dashed" : "solid",
                fontWeight: selected || isToday ? 600 : 400,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  mode,
  cursor,
  value,
  min,
  onPick,
}: {
  mode: CalendarMode;
  cursor: { year: number; month: number };
  value: string;
  min?: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3">
      {MONTHS_ES.map((label, i) => {
        const period =
          mode === "monthOfYear"
            ? String(i + 1)
            : `${cursor.year}-${String(i + 1).padStart(2, "0")}`;
        const selected = value === period;
        // Un puente no se devuelve antes de pedirlo: los meses previos al
        // mínimo se ven, pero no se pueden elegir.
        const disabled = mode === "month" && Boolean(min) && period < min!;

        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onPick(period)}
            className="min-h-touch rounded-surface border px-2 text-[12.5px] font-semibold capitalize transition-colors duration-150 ease-sd disabled:opacity-35"
            style={{
              backgroundColor: selected ? "#0E3A31" : "#F3F6F2",
              color: selected ? "#97DCBA" : "#12211D",
              borderColor: selected ? "#0E3A31" : "#DEE3DD",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-border bg-surface text-[15px] text-pine transition-colors duration-150 ease-sd hover:bg-surface-sunken"
    >
      {children}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="13" height="12" rx="2.5" stroke="#5C6B65" strokeWidth="1.4" />
      <path d="M2.5 7.5h13M6 2.5v2M12 2.5v2" stroke="#5C6B65" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
