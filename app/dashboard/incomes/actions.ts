"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import { currentPeriod } from "@/lib/calc/dates";
import type { IncomeState } from "./form-state";

export type IncomeResult = { ok: false; message: string };

/**
 * Agregar un ingreso.
 *
 * El tipo decide en qué meses entra, y por eso no es una etiqueta:
 *  - mensual: todos los meses (eligible_months vacío).
 *  - aguinaldo: junio y diciembre.
 *  - bono: el mes que se elija.
 *
 * El sueldo puede venir en dos partes con montos distintos; se cargan como dos
 * ingresos mensuales separados, no como uno con el total, para poder cambiar
 * uno sin tocar el otro.
 */
export async function createIncome(
  _prev: IncomeState,
  formData: FormData
): Promise<IncomeState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Tenés que iniciar sesión." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { message: "Poné un nombre para reconocerlo." };

  const amount = parseArgNumber(String(formData.get("amount") ?? ""));
  if (amount === null || amount <= 0) return { message: "Escribí un monto válido." };

  const kind = String(formData.get("kind") ?? "mensual");

  let eligibleMonths: number[] = [];
  if (kind === "aguinaldo") {
    eligibleMonths = [6, 12];
  } else if (kind === "bono") {
    const month = Number(formData.get("bonus_month") ?? 0);
    if (!month || month < 1 || month > 12) {
      return { message: "Elegí en qué mes entra el bono." };
    }
    eligibleMonths = [month];
  }

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!scenario) return { message: "No hay un escenario activo." };

  const { error } = await supabase.from("incomes").insert({
    user_id: auth.user.id,
    scenario_id: scenario.id,
    description,
    amount,
    kind,
    eligible_months: eligibleMonths,
    period: currentPeriod(),
  });

  if (error) return { message: "No pudimos guardar el ingreso." };

  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/incomes");
  redirect("/dashboard/incomes");
}


/**
 * Cambiar el monto de un ingreso: son dos cosas distintas y la app no puede
 * adivinar cuál.
 *
 * - "siempre": el monto viejo nunca fue cierto. Se corrige la fila y listo.
 *   Es para un error de carga.
 * - "desde_ahora": te aumentaron. Se cierra el registro viejo con el mes en
 *   que dejó de valer y se abre uno nuevo desde este mes. El histórico NO se
 *   reescribe, porque el sueldo realmente era el otro antes.
 *
 * Es la regla 3 del rescate —"todo ajuste que sube de acá en más se aplica
 * desde el mes correspondiente en adelante"— y la misma que la regla 4 de
 * `PRODUCT-RULES.md` para el monto de un gasto fijo. Los dos meses se tocan
 * sin pisarse: `incomeAppliesTo` deja de contar el viejo en `ended_period` y
 * empieza a contar el nuevo en su `period`, que es el mismo mes.
 *
 * Si el ingreso se cargó ESTE mes no hay historial que conservar, así que
 * cerrar y reabrir dejaría una fila muerta —`period` igual a `ended_period`,
 * un registro que no cuenta en ningún mes— y un "terminó en septiembre" que no
 * pasó. En ese caso se corrige, aunque el formulario pida lo otro.
 */
export async function updateIncomeAmount(formData: FormData): Promise<IncomeResult | never> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const id = String(formData.get("id") ?? "");
  const amount = parseArgNumber(String(formData.get("amount") ?? ""));

  if (!id) return { ok: false, message: "Falta el ingreso a editar." };
  if (amount === null || amount <= 0) return { ok: false, message: "Escribí un monto válido." };

  const { data: income } = await supabase.from("incomes").select("*").eq("id", id).maybeSingle();
  if (!income) return { ok: false, message: "No encontramos ese ingreso." };

  const period = currentPeriod();
  const desdeAhora =
    String(formData.get("scope") ?? "siempre") === "desde_ahora" && income.period < period;

  if (!desdeAhora) {
    const { error } = await supabase.from("incomes").update({ amount }).eq("id", id);
    if (error) return { ok: false, message: "No pudimos guardar el cambio." };
  } else {
    const { error: closeError } = await supabase
      .from("incomes")
      .update({ ended_period: period })
      .eq("id", id);
    if (closeError) return { ok: false, message: "No pudimos cerrar el registro anterior." };

    const { error: insertError } = await supabase.from("incomes").insert({
      user_id: auth.user.id,
      scenario_id: income.scenario_id,
      description: income.description,
      amount,
      kind: income.kind,
      eligible_months: income.eligible_months,
      period,
    });

    if (insertError) {
      // Sin reemplazo abierto, el ingreso desaparecería de la proyección.
      await supabase.from("incomes").update({ ended_period: null }).eq("id", id);
      return { ok: false, message: "No pudimos crear el registro nuevo; no se cambió nada." };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/incomes");
  redirect("/dashboard/incomes");
}

/**
 * Este ingreso ya no entra.
 *
 * No se borra, por lo mismo que no se borra un gasto fijo terminado: los meses
 * que ya pasaron contaron con esa plata y eso sigue siendo cierto. Se cierra
 * desde este mes y desaparece de la lista de ingresos activos.
 *
 * Un ingreso cargado este mes es el único caso en que cerrar no alcanza: la
 * fila quedaría contando cero meses, que es lo mismo que no haberla cargado.
 * Ahí se borra de verdad, que es lo que la persona quiso decir.
 *
 * Termina en la lista y no en esta misma pantalla. Es lo que hacen las otras
 * acciones de la app, y acá además es obligatorio: cuando el ingreso se borra,
 * quedarse sería quedarse en la pantalla de algo que ya no existe — un 404,
 * visto en el navegador antes de que esto redirigiera.
 */
export async function endIncome(id: string): Promise<IncomeResult | never> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tenés que iniciar sesión." };

  const { data: income } = await supabase
    .from("incomes")
    .select("period")
    .eq("id", id)
    .maybeSingle();

  if (!income) return { ok: false, message: "No encontramos ese ingreso." };

  const period = currentPeriod();

  const { error } =
    income.period < period
      ? await supabase.from("incomes").update({ ended_period: period }).eq("id", id)
      : await supabase.from("incomes").delete().eq("id", id);

  if (error) return { ok: false, message: "No pudimos darlo de baja." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/incomes");
  redirect("/dashboard/incomes");
}
