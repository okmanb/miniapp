import { createClient } from "@/lib/supabase/server";
import { PaymentsHistory } from "@/components/PaymentsHistory";

export const dynamic = "force-dynamic";

/**
 * Historial de pagos (pantalla 15).
 *
 * Solo de las deudas vivas. Borrar una deuda la archiva —sus pagos y resúmenes
 * son historial real y no se tiran— pero seguir listándolos acá deja una
 * pantalla que suma plata de deudas que la app ya no muestra en ningún otro
 * lado, y los dos totales de arriba contaban esa plata. Archivada la deuda,
 * sus pagos se van con ella; si se desarchiva, vuelven solos, porque no se
 * borró nada.
 */
export default async function PaymentsHistoryPage() {
  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data } = scenario
    ? await supabase
        .from("debt_payments")
        .select("id, amount, period, paid_on, kind, statement_id, debts(name, is_active)")
        .eq("scenario_id", scenario.id)
        .order("period", { ascending: false })
        .order("paid_on", { ascending: false })
    : { data: [] };

  /*
   * El filtro va acá y no en la consulta a propósito. Filtrar por una columna
   * de la tabla embebida es sintaxis de PostgREST que no se puede probar sin
   * sesión, y si estuviera mal la pantalla reventaría recién en producción.
   * Son pocas filas: un `.filter` hace lo mismo y no puede fallar.
   */
  const rows = (data ?? [])
    .filter((p: any) => p.debts?.is_active)
    .map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      period: p.period,
      paidOn: p.paid_on as string | null,
      kind: p.kind as string,
      debtName: p.debts?.name ?? "—",
      fromStatement: p.statement_id != null,
    }));

  return <PaymentsHistory rows={rows} />;
}
