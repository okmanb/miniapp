"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { closeStatement } from "@/lib/calc/statement";
import { parseArgNumber } from "@/app/dashboard/debts/validation";
import type { StatementState } from "./form-state";

/** Lo que manda el formulario cuando el PDF detectó compras en cuotas. */
interface ParsedInstallmentInput {
  cupon: string;
  description: string | null;
  firstPeriod: string;
  totalInstallments: number;
  installmentAmount: number;
  tna: number;
}

/**
 * Cargar el resumen del mes de una tarjeta.
 *
 * Dos reglas de PRODUCT-RULES.md se juegan acá:
 *
 * Regla 6 — si ya hay gastos cargados a mano a esta tarjeta y el resumen trae
 * consumos nuevos, hay que avisar del doble conteo ANTES de guardar. El aviso
 * no es cosmético: los consumos del resumen ya incluyen esos gastos, así que
 * sumarlos otra vez infla el saldo. Por eso el primer envío no guarda: vuelve
 * con la lista y pide confirmar.
 *
 * Regla 3 — al confirmar, los gastos abiertos de esa tarjeta se ARCHIVAN, no
 * se borran. El resumen ya los trae adentro del saldo, así que dejan de sumar,
 * pero siguen consultables y se pueden recuperar si el resumen no los incluía.
 * Los fijos archivados siguen repitiéndose en la proyección.
 */
export async function saveStatement(
  _prev: StatementState,
  formData: FormData
): Promise<StatementState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: "Tenés que iniciar sesión." };

  let debtId = String(formData.get("debt_id") ?? "");
  const period = String(formData.get("period") ?? "");
  const confirmed = formData.get("confirmed") === "1";

  if (!debtId) return { message: "Elegí a qué tarjeta corresponde el resumen." };
  if (!/^\d{4}-\d{2}$/.test(period)) return { message: "Elegí el mes del resumen." };

  /*
   * La tarjeta puede no existir todavía: este resumen la crea.
   *
   * Es el camino más común —"tengo el PDF de una tarjeta que no cargué"— y
   * antes obligaba a pasar por el alta, guardar, y volver acá con el mismo
   * archivo. El resumen trae los cuatro datos que pedía el alta.
   *
   * El saldo que se guarda es el ANTERIOR. El cierre lo escribe el mismo
   * camino que cualquier otro resumen, unas líneas más abajo.
   */
  if (debtId === "nueva") {
    const name = String(formData.get("new_card_name") ?? "").trim();
    if (!name) return { message: "Poné el nombre de la tarjeta nueva." };

    const previous = parseArgNumber(String(formData.get("new_card_previous_balance") ?? "")) ?? 0;
    if (previous < 0) return { message: "El saldo anterior no puede ser negativo." };

    const rate = parseArgNumber(String(formData.get("new_card_annual_rate") ?? ""));
    /*
     * La mensual que declaró el resumen, en decimal. Se guarda porque el motor
     * la prefiere sobre la anual cuando está: el banco convierte con 30/365 y
     * nosotros con /12, así que derivarla da 1,4% de más todos los meses.
     */
    const monthlyRaw = Number(formData.get("new_card_monthly_rate"));
    const monthlyRate =
      Number.isFinite(monthlyRaw) && monthlyRaw > 0 && monthlyRaw < 100 ? monthlyRaw / 100 : null;
    if (rate !== null && (rate < 0 || rate > 1000)) {
      return { message: "Esa tasa parece un error de tipeo. Es la anual, en porcentaje." };
    }

    const dayRaw = String(formData.get("new_card_due_day") ?? "").trim();
    const dueDay = dayRaw ? Number(dayRaw) : null;
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      return { message: "El día de vencimiento va de 1 a 31." };
    }

    const { data: scenario } = await supabase
      .from("scenarios")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (!scenario) {
      return { message: "No hay un escenario activo donde guardar la tarjeta." };
    }

    const { data: created, error: debtError } = await supabase
      .from("debts")
      .insert({
        user_id: auth.user.id,
        scenario_id: scenario.id,
        name,
        kind: "tarjeta",
        base_balance: previous,
        base_balance_at: new Date().toISOString().slice(0, 10),
        annual_interest_rate: rate,
        tem: monthlyRate,
        due_day: dueDay,
        status: "al_dia",
      })
      .select("id")
      .single();

    if (debtError || !created) return { message: "No pudimos crear la tarjeta." };

    debtId = created.id;
  }

  const newCharges = parseArgNumber(String(formData.get("new_charges") ?? "")) ?? 0;
  const minimumPayment = parseArgNumber(String(formData.get("minimum_payment") ?? ""));
  const amountPaid = parseArgNumber(String(formData.get("amount_paid") ?? "")) ?? 0;

  /*
   * Los dolares del resumen. Entran al saldo solo si estan los DOS: el total en
   * dolares y la cotizacion a la que se pagaron. El PDF trae el primero y no el
   * segundo, porque se pagan a la cotizacion del cierre.
   *
   * Con uno solo no se convierte nada. Inventar el que falta —tomar una
   * cotizacion nuestra, o suponer que el total en dolares ya vino en pesos—
   * meteria plata que nadie confirmo adentro de un saldo que la app presenta
   * como derivado de datos del banco.
   */
  /*
   * Cuando se pago. El resumen de agosto se paga en septiembre, asi que el mes
   * del pago no es el del resumen — y el mes del pago es el que mira todo lo
   * que pregunta "que pagaste este mes".
   *
   * Sale del vencimiento del PDF; sin el, hoy, que es cuando se esta cargando.
   * Es el mismo criterio que `createPayment`.
   */
  const paidOnRaw = String(formData.get("paid_on") ?? "").trim();
  const paidOn = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paidOnRaw)
    ? paidOnRaw
    : new Date().toISOString().slice(0, 10);

  const usdBalance = parseArgNumber(String(formData.get("usd_balance") ?? "")) ?? 0;
  const usdRate = parseArgNumber(String(formData.get("usd_rate") ?? ""));

  if (usdBalance < 0) return { message: "El total en dólares no puede ser negativo." };
  if (usdRate !== null && usdRate < 0) return { message: "La cotización no puede ser negativa." };

  const usdCharges = usdRate !== null && usdRate > 0 ? Math.round(usdBalance * usdRate) : 0;

  const { data: debt } = await supabase
    .from("debts")
    .select("id, scenario_id, base_balance, annual_interest_rate, tem")
    .eq("id", debtId)
    .maybeSingle();

  if (!debt) return { message: "No encontramos esa tarjeta." };

  // Gastos abiertos cargados a mano a esta tarjeta.
  const { data: openExpenses } = await supabase
    .from("expenses")
    .select("id, description, amount")
    .eq("debt_id", debtId)
    .eq("is_archived", false);

  const duplicates = (openExpenses ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
  }));

  // Regla 6: avisar antes de guardar, una sola vez.
  if (!confirmed && duplicates.length > 0 && newCharges > 0) {
    return {
      message:
        "Este resumen trae consumos nuevos y esta tarjeta ya tiene gastos cargados a mano. Es probable que sean los mismos.",
      pendingDuplicates: duplicates,
    };
  }

  /*
   * Volver a guardar el mismo resumen tiene que CORREGIRLO, no aplicarle el
   * mes otra vez. Por eso, si ya existe, su saldo anterior sale de lo que
   * guardó y no de base_balance — que a esta altura ya es el cierre que dejó
   * él mismo, y usarlo cobraría el interés dos veces.
   */
  const { data: existing } = await supabase
    .from("card_statements")
    .select("id, previous_balance")
    .eq("debt_id", debtId)
    .eq("period", period)
    .maybeSingle();

  /*
   * Los pagos que todavía restan. Lo que la tarjeta debía al cerrar el mes
   * anterior es el saldo base menos ellos: base_balance guarda el cierre sin
   * los pagos descontados, y la resta la hace `deriveBalance`.
   */
  const { data: livePayments } = await supabase
    .from("debt_payments")
    .select("id, amount")
    .eq("debt_id", debtId)
    .eq("is_absorbed", false);

  const livePaid = (livePayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const previousBalance = existing
    ? Number(existing.previous_balance)
    : Math.max(0, Number(debt.base_balance) - livePaid);

  const close = closeStatement({
    previousBalance,
    annualRate: debt.annual_interest_rate,
    newCharges,
    minimumPayment: minimumPayment ?? 0,
    amountPaid,
    usdCharges,
  });

  const { data: inserted, error } = await supabase
    .from("card_statements")
    .upsert(
      {
        user_id: auth.user.id,
        scenario_id: debt.scenario_id,
        debt_id: debtId,
        period,
        previous_balance: previousBalance,
        interest_charged: close.interest,
        new_charges: newCharges,
        // Lo que el banco dice que debés al cerrar, con el pago ya descontado.
        // Difiere a propósito de base_balance, que lo guarda sin descontar.
        total_due: close.newBalance,
        minimum_payment: minimumPayment,
        amount_paid: amountPaid,
        // Las dos cifras y no solo el resultado: el equivalente en pesos ya
        // quedo adentro del cierre, asi que sin la cotizacion no habria forma
        // de explicar de donde salio.
        usd_balance: usdBalance,
        usd_rate: usdRate,
        source: "manual",
      },
      { onConflict: "debt_id,period" }
    )
    .select("id")
    .single();

  if (error) return { message: "No pudimos guardar el resumen." };

  /*
   * El saldo base pasa a ser el cierre ANTES de restar lo pagado. Es el único
   * lugar donde se escribe un saldo, y se escribe un dato del banco.
   *
   * Antes acá se guardaba el cierre neto y el pago desaparecía adentro: no
   * quedaba fila en `debt_payments`, así que el Historial de pagos no lo
   * mostraba y quien lo registraba de nuevo a mano se lo descontaba dos veces.
   * Ahora el pago se guarda como pago, unas líneas más abajo, y el saldo que
   * ve la app sigue siendo el mismo porque `deriveBalance` lo resta.
   */
  const { error: balanceError } = await supabase
    .from("debts")
    .update({
      base_balance: close.grossBalance,
      base_balance_at: new Date().toISOString().slice(0, 10),
    })
    .eq("id", debtId);

  if (balanceError) return { message: "Guardamos el resumen pero no pudimos actualizar el saldo." };

  /*
   * Regla 3, aplicada a los pagos: el resumen ABSORBE lo que ya trae adentro.
   *
   * Todo pago vivo hasta acá está metido en el saldo anterior de este resumen,
   * así que dejar de restarlo no es perderlo — es no contarlo dos veces. Igual
   * que con los gastos, no se borra: sigue en el historial.
   *
   * Solo al crear el resumen. Al corregirlo, el saldo anterior salió de lo que
   * él ya tenía guardado y esos pagos ya se absorbieron en su momento.
   */
  if (!existing && livePayments && livePayments.length > 0) {
    await supabase
      .from("debt_payments")
      .update({ is_absorbed: true, absorbed_by_statement_id: inserted.id })
      .in(
        "id",
        livePayments.map((p) => p.id)
      );
  }

  /*
   * Y el pago de este resumen, que es lo que la persona escribió en "cuánto
   * pagaste". Se borra y se reescribe en vez de actualizarse: así corregir el
   * resumen corrige el pago, bajarlo a cero lo elimina, y volver a guardar no
   * deja dos.
   */
  await supabase.from("debt_payments").delete().eq("statement_id", inserted.id);

  if (amountPaid > 0) {
    const { error: paymentError } = await supabase.from("debt_payments").insert({
      user_id: auth.user.id,
      scenario_id: debt.scenario_id,
      debt_id: debtId,
      // El mes en que se pago, no el del resumen.
      period: paidOn.slice(0, 7),
      paid_on: paidOn,
      amount: amountPaid,
      // Variable a propósito: 'minimo_estimado' tiene un único por deuda y mes,
      // y el pago del resumen no puede chocar con el atajo de pagar el mínimo.
      kind: "pago_variable",
      note: `Pago del resumen de ${period}`,
      statement_id: inserted.id,
      is_absorbed: false,
    });

    if (paymentError) {
      return { message: "Guardamos el resumen pero no pudimos registrar el pago." };
    }
  }

  // Cuotas que trajo el PDF. Se guardan con upsert por (debt_id, cupon):
  // cargar dos meses seguidos el mismo resumen no tiene que duplicarlas, y
  // el cupón es el identificador que el banco le da a cada compra.
  const installmentsRaw = String(formData.get("installments") ?? "");
  if (installmentsRaw) {
    try {
      const plans = JSON.parse(installmentsRaw) as ParsedInstallmentInput[];
      if (Array.isArray(plans) && plans.length > 0) {
        await supabase.from("card_installment_plans").upsert(
          plans.map((plan) => ({
            user_id: auth.user.id,
            scenario_id: debt.scenario_id,
            debt_id: debtId,
            cupon: plan.cupon,
            description: plan.description,
            first_period: plan.firstPeriod,
            total_installments: plan.totalInstallments,
            installment_amount: plan.installmentAmount,
            tna: plan.tna,
            is_active: true,
          })),
          { onConflict: "debt_id,cupon" }
        );
      }
    } catch {
      // Que las cuotas no se puedan leer no invalida el resumen: los números
      // principales ya se guardaron y son los que mueven el saldo.
    }
  }

  // Regla 3: archivar, no borrar.
  if (duplicates.length > 0) {
    await supabase
      .from("expenses")
      .update({ is_archived: true, archived_by_statement_id: inserted.id })
      .eq("debt_id", debtId)
      .eq("is_archived", false);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cashflow");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/payments");

  /*
   * Cuántos gastos se archivaron viaja en la URL porque el aviso tiene que
   * aparecer DESPUÉS del redirect: archivar un gasto lo saca de la vista sin
   * decir nada, y que el saldo deje de contarlo es justo la consecuencia que
   * no se ve. La pantalla de destino lo consume y limpia la query.
   */
  const archived = duplicates.length > 0 ? duplicates.length : 0;
  redirect(
    archived > 0
      ? `/dashboard/debts/${debtId}?archivados=${archived}`
      : `/dashboard/debts/${debtId}`
  );
}
