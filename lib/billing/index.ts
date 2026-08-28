/**
 * Capa única de billing. Cada mini app importa ESTO, nunca Stripe o
 * MercadoPago directamente. Así el "motor de pagos" se escribe una
 * sola vez y se reusa en cada producto de la fábrica.
 */

import * as stripeProvider from "./stripe";
import * as mercadopagoProvider from "./mercadopago";

export type Provider = "stripe" | "mercadopago";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface SubscriptionResult {
  provider: Provider;
  externalId: string; // id de suscripción en Stripe/MercadoPago
  checkoutUrl?: string; // a donde redirigir al usuario para pagar
  status: SubscriptionStatus;
}

// Elegí el proveedor según el país del usuario.
// Regla simple para empezar: Argentina -> MercadoPago, resto -> Stripe.
export function providerForCountry(countryCode: string): Provider {
  return countryCode === "AR" ? "mercadopago" : "stripe";
}

export async function createSubscription(params: {
  userId: string;
  email: string;
  countryCode: string;
  planId: string;
}): Promise<SubscriptionResult> {
  const provider = providerForCountry(params.countryCode);
  if (provider === "stripe") {
    return stripeProvider.createSubscription(params);
  }
  return mercadopagoProvider.createSubscription(params);
}

export async function cancelSubscription(
  provider: Provider,
  externalId: string
): Promise<void> {
  if (provider === "stripe") {
    return stripeProvider.cancelSubscription(externalId);
  }
  return mercadopagoProvider.cancelSubscription(externalId);
}

export async function getSubscriptionStatus(
  provider: Provider,
  externalId: string
): Promise<SubscriptionStatus> {
  if (provider === "stripe") {
    return stripeProvider.getSubscriptionStatus(externalId);
  }
  return mercadopagoProvider.getSubscriptionStatus(externalId);
}
