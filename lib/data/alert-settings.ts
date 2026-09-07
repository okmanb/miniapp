/**
 * Preferencias de aviso: cuándo, por dónde y sobre qué deudas.
 *
 * Van por usuario y no por escenario: la preferencia es de la persona, y
 * cambiar de escenario no debería cambiar cómo le avisamos.
 *
 * Una advertencia honesta: hoy la app no manda nada. Estas preferencias
 * deciden la ventana con la que se agrupan los vencimientos —eso sí cambia lo
 * que ves— y quedan guardadas para cuando haya avisos de verdad. La pantalla
 * lo dice en vez de simular que ya salen.
 */

export type AlertChannel = "push" | "email" | "whatsapp";

export interface AlertSettings {
  /** Días de anticipación. 0 = el mismo día. */
  leadDays: number;
  channels: AlertChannel[];
  scope: "todas" | "algunas";
  onlyDebtIds: string[];
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  leadDays: 3,
  channels: ["push"],
  scope: "todas",
  onlyDebtIds: [],
};

export const LEAD_DAY_OPTIONS = [
  { value: 0, label: "Ese día" },
  { value: 1, label: "1 día" },
  { value: 3, label: "3 días" },
  { value: 7, label: "7 días" },
];

export const CHANNEL_OPTIONS: { value: AlertChannel; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export const ALERT_SETTINGS_COLUMNS = "lead_days, channels, scope, only_debt_ids";

export function toAlertSettings(row: unknown): AlertSettings {
  if (!row || typeof row !== "object") return DEFAULT_ALERT_SETTINGS;
  const r = row as Record<string, unknown>;
  return {
    leadDays: typeof r.lead_days === "number" ? r.lead_days : DEFAULT_ALERT_SETTINGS.leadDays,
    channels: Array.isArray(r.channels) && r.channels.length > 0
      ? (r.channels as AlertChannel[])
      : DEFAULT_ALERT_SETTINGS.channels,
    scope: r.scope === "algunas" ? "algunas" : "todas",
    onlyDebtIds: Array.isArray(r.only_debt_ids) ? (r.only_debt_ids as string[]) : [],
  };
}

const CHANNEL_NAMES: Record<AlertChannel, string> = {
  push: "push",
  email: "email",
  whatsapp: "WhatsApp",
};

/** "Te avisamos 3 días antes por push, sobre todas tus deudas." */
export function describeAlertSettings(settings: AlertSettings, debtCount: number): string {
  const when =
    settings.leadDays === 0
      ? "el mismo día del vencimiento"
      : `${settings.leadDays} ${settings.leadDays === 1 ? "día" : "días"} antes`;

  const names = settings.channels.map((c) => CHANNEL_NAMES[c] ?? c);
  const via =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;

  const about =
    settings.scope === "todas"
      ? "todas tus deudas"
      : debtCount === 1
        ? "1 deuda que elegiste"
        : `${debtCount} deudas que elegiste`;

  return `Te avisamos ${when} por ${via}, sobre ${about}.`;
}
