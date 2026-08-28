import { createClient } from "@/lib/supabase/server";
import { getActiveScenario } from "@/lib/scenarios";
import { refreshAlerts, resolveAlert } from "./actions";
import { AlertTriangleIcon, BellIcon, DotIcon, RefreshIcon } from "@/lib/icons";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  saldo_creciente: "Saldo creciente",
  doble_conteo: "Posible doble conteo",
  mes_no_reflejado: "Mes no reflejado",
  gasto_no_capturado: "Gasto no capturado",
  vencimiento_hoy: "Vencimiento próximo",
  tasa_mas_cara: "Tasa más cara",
};

// El azul terciario queda exclusivo para datos estimados (La Regla del
// Azul Único) — "info" es la severidad más baja, no una estimación, así
// que va en gris neutro en vez de reutilizar ese color.
const SEVERITY_META: Record<string, { label: string; color: string; bg: string; Icon: typeof DotIcon }> = {
  critico: { label: "Crítico", color: "var(--on-error-container)", bg: "var(--error-container)", Icon: AlertTriangleIcon },
  atencion: { label: "Atención", color: "var(--on-primary-container)", bg: "var(--primary-container-pale)", Icon: AlertTriangleIcon },
  info: { label: "Info", color: "var(--on-surface-variant)", bg: "var(--surface-container-high)", Icon: DotIcon },
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const scenario = await getActiveScenario(supabase, user.id);

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("scenario_id", scenario.id)
    .eq("resolved", false)
    .order("severity");

  const order = { critico: 0, atencion: 1, info: 2 } as Record<string, number>;
  const sorted = [...(alerts ?? [])].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return (
    <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BellIcon width={26} height={26} />
        Alertas
      </h1>
      <p style={{ color: "var(--on-surface-variant)" }}>
        Escenario: {scenario.name}. Solo se calculan solas saldo creciente, vencimientos próximos y
        tasa más cara — el resto (doble conteo, gasto no capturado, mes no reflejado) hay que
        detectarlas a ojo por ahora.
      </p>

      {searchParams.error && <p style={{ color: "var(--on-error-container)", fontSize: 14 }}>{searchParams.error}</p>}

      {sorted.length > 0 && (
        <p style={{ marginTop: 20 }}>
          <span
            className={`stamp-total ${sorted.some((a) => a.severity === "critico") ? "stamp-total--negative" : "stamp-total--positive"}`}
          >
            {sorted.length} ALERTA{sorted.length > 1 ? "S" : ""} ACTIVA{sorted.length > 1 ? "S" : ""}
          </span>
        </p>
      )}

      <form action={refreshAlerts} style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{ padding: "8px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
        >
          <RefreshIcon width={14} height={14} />
          Recalcular alertas
        </button>
      </form>

      <hr className="ticket-divider" />

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <p style={{ color: "var(--on-surface-variant)" }}>
            Sin alertas activas. Tocá "Recalcular alertas" después de cargar o actualizar tus
            deudas.
          </p>
        )}

        {sorted.map((alert) => {
          const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.info;
          return (
            <div
              key={alert.id}
              className="paper-card"
              style={{
                background: `linear-gradient(135deg, ${meta.bg} 0%, rgba(255,255,255,0.7) 55%)`,
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    background: meta.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <meta.Icon width={15} height={15} style={{ color: meta.color }} />
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: meta.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {meta.label} · {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{alert.message}</p>
                </div>
              </div>
              <form action={resolveAlert} style={{ flexShrink: 0 }}>
                <input type="hidden" name="id" value={alert.id} />
                <button type="submit" style={{ background: "none", border: "none", color: "var(--on-surface-variant)", cursor: "pointer", fontSize: 13 }}>
                  Resolver
                </button>
              </form>
            </div>
          );
        })}
      </section>
    </main>
  );
}
