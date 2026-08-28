"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_SCENARIO_COOKIE_NAME } from "@/lib/scenarios";

export async function updateStartingBalance(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenarioId = formData.get("scenario_id") as string;
  const amount = Number(formData.get("starting_cash_balance"));

  if (Number.isNaN(amount)) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent("Ingresá un saldo válido.")}`);
  }

  const { error } = await supabase
    .from("scenarios")
    .update({ starting_cash_balance: amount })
    .eq("id", scenarioId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/cashflow?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/cashflow");
  redirect("/dashboard/cashflow");
}

export async function setActiveScenario(formData: FormData) {
  const scenarioId = formData.get("scenario_id") as string;
  const returnTo = (formData.get("return_to") as string) || "/dashboard";

  cookies().set(ACTIVE_SCENARIO_COOKIE_NAME, scenarioId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/scenarios");
  redirect(returnTo);
}

// Copia deudas + su cronograma de un escenario a otro, recién
// creado — es lo que permite "arrancar el plan de contingencia
// desde donde está hoy el plan base" en vez de cargar todo de cero.
// Los padres (tarjetas) se clonan antes que sus hijas (Plan V) para
// poder remapear parent_debt_id al id nuevo.
async function cloneScenarioData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fromScenarioId: string,
  toScenarioId: string
) {
  const { data: sourceDebts } = await supabase.from("debts").select("*").eq("scenario_id", fromScenarioId);
  if (!sourceDebts || sourceDebts.length === 0) return;

  const idMap = new Map<string, string>();
  const parents = sourceDebts.filter((d) => !d.parent_debt_id);
  const children = sourceDebts.filter((d) => d.parent_debt_id);

  for (const debt of [...parents, ...children]) {
    const { id, created_at, updated_at, scenario_id, parent_debt_id, ...rest } = debt;

    const { data: cloned, error } = await supabase
      .from("debts")
      .insert({
        ...rest,
        user_id: userId,
        scenario_id: toScenarioId,
        parent_debt_id: parent_debt_id ? idMap.get(parent_debt_id) ?? null : null,
      })
      .select()
      .single();

    if (error || !cloned) continue;
    idMap.set(id, cloned.id);

    const { data: entries } = await supabase.from("debt_schedule_entries").select("*").eq("debt_id", id);
    if (entries && entries.length > 0) {
      await supabase.from("debt_schedule_entries").insert(
        entries.map((e) => ({
          debt_id: cloned.id,
          month: e.month,
          amount: e.amount,
          kind: e.kind,
          is_estimate: e.is_estimate,
          note: e.note,
        }))
      );
    }
  }
}

export async function createScenario(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const cloneFromId = (formData.get("clone_from") as string) || null;

  if (!name) {
    redirect(`/dashboard/scenarios?error=${encodeURIComponent("Ponele un nombre al escenario.")}`);
  }

  const sourceScenario = cloneFromId
    ? (await supabase.from("scenarios").select("starting_cash_balance").eq("id", cloneFromId).maybeSingle()).data
    : null;

  const { data: scenario, error } = await supabase
    .from("scenarios")
    .insert({
      user_id: user.id,
      name,
      notes,
      is_base: false,
      starting_cash_balance: sourceScenario?.starting_cash_balance ?? 0,
    })
    .select()
    .single();

  if (error || !scenario) {
    redirect(
      `/dashboard/scenarios?error=${encodeURIComponent(error?.message ?? "Error creando el escenario.")}`
    );
  }

  if (cloneFromId) {
    await cloneScenarioData(supabase, user.id, cloneFromId, scenario!.id);
  }

  revalidatePath("/dashboard/scenarios");
  redirect("/dashboard/scenarios");
}

export async function deleteScenario(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenarioId = formData.get("scenario_id") as string;

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("is_base")
    .eq("id", scenarioId)
    .eq("user_id", user.id)
    .single();

  if (scenario?.is_base) {
    redirect(`/dashboard/scenarios?error=${encodeURIComponent("No se puede borrar el plan base.")}`);
  }

  const { error } = await supabase.from("scenarios").delete().eq("id", scenarioId).eq("user_id", user.id);

  if (error) {
    redirect(`/dashboard/scenarios?error=${encodeURIComponent(error.message)}`);
  }

  // Si el escenario borrado era el activo, la cookie queda apuntando
  // a un id que ya no existe — getActiveScenario cae al base solo
  // porque el select no encuentra la fila, así que no hace falta
  // borrar la cookie a mano acá.
  revalidatePath("/dashboard/scenarios");
  redirect("/dashboard/scenarios");
}
