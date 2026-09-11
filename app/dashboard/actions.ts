"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod } from "@/lib/calc/dates";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Atajo del dashboard: registrar el pago mínimo de una deuda.
 *
 * La regla de integridad "un mínimo por deuda por mes" no se chequea acá con
 * un SELECT previo: la garantiza el índice único parcial
 * debt_payments_one_minimum_idx. Chequear primero y después insertar deja una
 * ventana entre las dos consultas donde dos toques seguidos entran los dos —
 * que es exactamente el atajo aplicándose dos veces sin que se note. Se
 * intenta insertar y se traduce el 23505 de Postgres a un mensaje.
 *
 * El monto no se recibe del formulario: se lee del último resumen. Un monto
 * que llega del cliente es un monto que se puede alterar, y este atajo dice
 * "el mínimo", no "lo que diga el botón".
 */
export async function payMinimum(debtId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("id, scenario_id, name")
    .eq("id", debtId)
    .maybeSingle();

  if (debtError) return { ok: false, message: "No pudimos leer la deuda." };
  if (!debt) return { ok: false, message: "Esa deuda no existe en este escenario." };

  const { data: statement } = await supabase
    .from("card_statements")
    .select("minimum_payment")
    .eq("debt_id", debtId)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();

  const minimum = statement?.minimum_payment != null ? Number(statement.minimum_payment) : null;
  if (minimum == null || minimum <= 0) {
    return {
      ok: false,
      message: `No sabemos cuál es el mínimo de ${debt.name}: cargá un resumen primero.`,
    };
  }

  const { error } = await supabase.from("debt_payments").insert({
    user_id: auth.user.id,
    scenario_id: debt.scenario_id,
    debt_id: debtId,
    period: currentPeriod(),
    paid_on: new Date().toISOString().slice(0, 10),
    amount: minimum,
    kind: "minimo_estimado",
    note: "Registrado con el atajo del dashboard.",
  });

  if (error) {
    // 23505 = violación de índice único: ya hay un mínimo este mes.
    if (error.code === "23505") {
      return {
        ok: false,
        message: `El mínimo de ${debt.name} ya estaba registrado este mes.`,
      };
    }
    return { ok: false, message: "No pudimos registrar el pago." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
