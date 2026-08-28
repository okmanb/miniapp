import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Stripe reenvía eventos si no le devolvés 200 rápido, y puede
// reenviar el MISMO evento más de una vez -> por eso guardamos
// webhook_events y chequeamos duplicados (idempotencia).
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Firma de webhook inválida:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotencia: si ya procesamos este event.id, salimos.
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from("webhook_events").insert({
    id: event.id,
    provider: "stripe",
    type: event.type,
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId && session.subscription) {
        await supabase.from("subscriptions").upsert({
          user_id: userId,
          provider: "stripe",
          external_id: session.subscription as string,
          status: "active",
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: sub.status })
        .eq("external_id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
