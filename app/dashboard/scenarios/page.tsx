import { createClient } from "@/lib/supabase/server";
import { getActiveScenario } from "@/lib/scenarios";
import { createScenario, deleteScenario, setActiveScenario } from "./actions";
import { CheckIcon, ClipboardIcon } from "@/lib/icons";
import Link from "next/link";

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [active, { data: scenarios }] = await Promise.all([
    getActiveScenario(supabase, user.id),
    supabase.from("scenarios").select("*").order("is_base", { ascending: false }).order("created_at"),
  ]);

  return (
    <main style={{ maxWidth: 560, margin: "60px auto", padding: "0 24px" }}>
      <p>
        <Link href="/dashboard">← Volver al dashboard</Link>
      </p>
      <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ClipboardIcon width={26} height={26} />
        Escenarios
      </h1>
      <p style={{ color: "var(--on-surface-variant)" }}>
        El mismo set de deudas, pero con decisiones distintas — comparalos sin que se pisen entre
        sí. El activo es el que ves en el dashboard y en el flujo de caja.
      </p>

      {searchParams.error && <p style={{ color: "var(--on-error-container)", fontSize: 14 }}>{searchParams.error}</p>}

      <section style={{ marginTop: 24 }}>
        {(scenarios ?? []).map((scenario) => {
          const isActive = scenario.id === active.id;
          return (
            <div
              key={scenario.id}
              className="paper-card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                background: isActive
                  ? "linear-gradient(135deg, var(--secondary-container) 0%, rgba(255,255,255,0.65) 60%)"
                  : undefined,
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  {scenario.name}
                  {scenario.is_base && <span style={{ color: "var(--on-surface-variant)", fontSize: 12, fontWeight: 500 }}> · plan base</span>}
                  {isActive && (
                    <span
                      className="status-pill"
                      style={{
                        background: "var(--secondary-container)",
                        color: "var(--on-secondary-container)",
                        padding: "3px 10px",
                        fontSize: 11,
                      }}
                    >
                      <CheckIcon width={11} height={11} /> activo
                    </span>
                  )}
                </p>
                {scenario.notes && (
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--on-surface-variant)" }}>{scenario.notes}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!isActive && (
                  <form action={setActiveScenario}>
                    <input type="hidden" name="scenario_id" value={scenario.id} />
                    <input type="hidden" name="return_to" value="/dashboard/scenarios" />
                    <button type="submit" style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
                      Activar
                    </button>
                  </form>
                )}
                {!scenario.is_base && (
                  <form action={deleteScenario}>
                    <input type="hidden" name="scenario_id" value={scenario.id} />
                    <button
                      type="submit"
                      style={{ background: "none", border: "none", color: "var(--led-red)", cursor: "pointer", fontSize: 13 }}
                    >
                      Borrar
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <hr className="ticket-divider" />

      <section style={{ marginTop: 32 }}>
        <h2>+ Nuevo escenario</h2>
        <form action={createScenario} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
          <label>
            Nombre
            <input
              type="text"
              name="name"
              required
              placeholder="ej: Plan de contingencia"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Notas (opcional)
            <input
              type="text"
              name="notes"
              placeholder="ej: Visa en $0, dos préstamos puente"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Arrancar copiando las deudas de
            <select name="clone_from" defaultValue={active.id} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
              <option value="">Vacío, sin copiar nada</option>
              {(scenarios ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
            Crear escenario
          </button>
        </form>
      </section>
    </main>
  );
}
