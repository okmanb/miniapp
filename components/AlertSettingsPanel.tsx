"use client";

import { useState, useTransition } from "react";
import { saveAlertSettings } from "@/app/dashboard/alerts/actions";
import {
  CHANNEL_OPTIONS,
  LEAD_DAY_OPTIONS,
  describeAlertSettings,
  type AlertChannel,
  type AlertSettings,
} from "@/lib/data/alert-settings";
import { formatMoney } from "@/lib/calc/money";
import { Amount, Spinner } from "./ui";

export interface UpcomingNotice {
  debtId: string;
  debtName: string;
  /** "07-sep" */
  dueLabel: string;
  amount: number;
  /** Cuándo saldría el aviso: "ahora", "hoy", "05-sep". */
  noticeLabel: string;
  /** Si con esta anticipación el aviso ya tendría que haber salido. */
  late: boolean;
}

export interface AlertDebtOption {
  id: string;
  name: string;
}

/**
 * Preferencias de aviso.
 *
 * Guarda al tocar, sin botón de confirmar: son cuatro interruptores y uno de
 * ellos —la anticipación— cambia en el acto cómo se agrupan los vencimientos
 * de la lista de abajo. Un "guardar" ahí obligaría a confirmar algo cuyo
 * efecto ya se está viendo.
 */
export function AlertSettingsPanel({
  initial,
  debts,
  upcoming,
}: {
  initial: AlertSettings;
  debts: AlertDebtOption[];
  upcoming: UpcomingNotice[];
}) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: AlertSettings) {
    const previous = settings;
    setSettings(next);
    startTransition(async () => {
      setError(null);
      const result = await saveAlertSettings(next);
      if (!result.ok) {
        setSettings(previous);
        setError(result.message);
      }
    });
  }

  function toggleChannel(channel: AlertChannel) {
    const has = settings.channels.includes(channel);
    if (has && settings.channels.length === 1) {
      setError("Dejá al menos un canal activo.");
      return;
    }
    save({
      ...settings,
      channels: has
        ? settings.channels.filter((c) => c !== channel)
        : [...settings.channels, channel],
    });
  }

  function toggleDebt(id: string) {
    const has = settings.onlyDebtIds.includes(id);
    if (has && settings.onlyDebtIds.length === 1) {
      setError("Elegí al menos una deuda.");
      return;
    }
    save({
      ...settings,
      onlyDebtIds: has
        ? settings.onlyDebtIds.filter((d) => d !== id)
        : [...settings.onlyDebtIds, id],
    });
  }

  const scopedCount =
    settings.scope === "todas" ? debts.length : settings.onlyDebtIds.length;

  return (
    <section className="mt-6">
      <h2 className="text-label uppercase text-muted">Ajustes</h2>

      <details className="group mt-2 rounded-surface-lg border border-border bg-surface px-4 py-3">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-card text-ink">
          Cómo te avisamos
          <span
            className="transition-transform duration-200 ease-sd group-open:rotate-180"
            aria-hidden
          >
            ⌄
          </span>
        </summary>

        <fieldset className="mt-3">
          <legend className="text-label uppercase text-muted">Cuándo</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEAD_DAY_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                active={settings.leadDays === option.value}
                onClick={() => save({ ...settings, leadDays: option.value })}
              >
                {option.label}
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-label uppercase text-muted">Por dónde</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                active={settings.channels.includes(option.value)}
                onClick={() => toggleChannel(option.value)}
              >
                {option.label}
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-label uppercase text-muted">Sobre qué deudas</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Choice
              active={settings.scope === "todas"}
              onClick={() => save({ ...settings, scope: "todas" })}
            >
              Todas
            </Choice>
            <Choice
              active={settings.scope === "algunas"}
              onClick={() =>
                save({
                  ...settings,
                  scope: "algunas",
                  onlyDebtIds: settings.onlyDebtIds.length
                    ? settings.onlyDebtIds
                    : debts.map((d) => d.id),
                })
              }
            >
              Elegir cuáles
            </Choice>
          </div>

          {settings.scope === "algunas" && (
            <ul className="mt-2 space-y-1">
              {debts.map((debt) => (
                <li key={debt.id}>
                  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-[12.5px] text-ink">
                    <input
                      type="checkbox"
                      checked={settings.onlyDebtIds.includes(debt.id)}
                      onChange={() => toggleDebt(debt.id)}
                      className="h-4 w-4 accent-[#0E3A31]"
                    />
                    <span className="truncate">{debt.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <p className="help mt-4 flex items-center gap-2">
          {pending && <Spinner className="text-pine" />}
          {describeAlertSettings(settings, scopedCount)}
        </p>

        {/*
          La app todavía no manda nada. Decirlo acá es la diferencia entre una
          preferencia y una promesa: los interruptores cambian con qué ventana
          se agrupan los vencimientos de abajo, y quedan guardados para cuando
          los avisos salgan de verdad.
        */}
        <p className="mt-2 rounded-surface border border-gold-border bg-[#FCF4E7] px-3 py-2 text-[11px] text-gold-ink">
          Todavía no mandamos avisos: esto queda guardado y decide con qué
          ventana se agrupan los vencimientos de esta pantalla.
        </p>

        {error && (
          <p role="alert" className="mt-2 text-[11.5px] text-brick-ink">
            {error}
          </p>
        )}

        {upcoming.length > 0 && (
          <div className="mt-4 border-t border-border-row pt-3">
            <div className="text-label uppercase text-muted">Los próximos avisos</div>
            <ul className="mt-2 space-y-2">
              {upcoming.map((notice) => (
                <li key={notice.debtId} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10.5px] uppercase text-muted">
                      {notice.noticeLabel}
                      {notice.late && " · con atraso"}
                    </div>
                    <div className="truncate text-[12.5px] text-ink">{notice.debtName}</div>
                    <div className="text-[11px] text-muted">vence {notice.dueLabel}</div>
                  </div>
                  <Amount className="shrink-0 text-[13px] text-ink">
                    {formatMoney(notice.amount)}
                  </Amount>
                </li>
              ))}
            </ul>

            {upcoming.some((n) => n.late) && (
              <p className="help mt-2">
                Con {settings.leadDays === 0 ? "aviso el mismo día" : `${settings.leadDays} ${settings.leadDays === 1 ? "día" : "días"} de anticipación`}, estos avisos ya
                deberían haber salido: el vencimiento está más cerca que eso.
              </p>
            )}
          </div>
        )}
      </details>
    </section>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="min-h-touch rounded-pill border px-[14px] py-2 text-[12px] font-semibold transition-colors duration-150 ease-sd"
      style={{
        backgroundColor: active ? "#0E3A31" : "#FFFFFF",
        borderColor: active ? "#0E3A31" : "#DEE3DD",
        color: active ? "#FFFFFF" : "#5C6B65",
      }}
    >
      {children}
    </button>
  );
}
