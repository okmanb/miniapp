import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

// MercadoPago manda notificaciones tipo { type, data: { id } } y hay
// que ir a buscar el recurso completo con ese id.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createAdminClient();

  const eventId = `mp_${body.type}_${body.data?.id}`;
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await supabase.from("webhook_events").insert({
    id: eventId,
    provider: "mercadopago",
    type: body.type,
  });

  if (body.type === "subscription_preapproval" && body.data?.id) {
    const preApproval = new PreApproval(client);
    const result = await preApproval.get({ id: body.data.id });

    const status = result.status === "authorized" ? "active" : result.status;

    await supabase.from("subscriptions").upsert({
      user_id: result.external_reference,
      provider: "mercadopago",
      external_id: result.id,
      status,
    });
  }

  return NextResponse.json({ received: true });
}
