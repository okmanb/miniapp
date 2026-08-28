import Stripe from "stripe";
import type { SubscriptionResult, SubscriptionStatus } from "./index";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function createSubscription(params: {
  userId: string;
  email: string;
  planId: string;
}): Promise<SubscriptionResult> {
  // Checkout Session en modo suscripción. El priceId viene de tu
  // dashboard de Stripe (Product > Pricing).
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.email,
    line_items: [
      {
        price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
    metadata: { userId: params.userId },
  });

  return {
    provider: "stripe",
    externalId: session.id,
    checkoutUrl: session.url ?? undefined,
    status: "incomplete",
  };
}

export async function cancelSubscription(subscriptionId: string) {
  await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionStatus> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return mapStripeStatus(sub.status);
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "incomplete";
  }
}

export { stripe };
