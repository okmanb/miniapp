import { MercadoPagoConfig, PreApproval } from "mercadopago";
import type { SubscriptionResult, SubscriptionStatus } from "./index";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function createSubscription(params: {
  userId: string;
  email: string;
  planId: string;
}): Promise<SubscriptionResult> {
  // PreApproval = suscripción recurrente en MercadoPago.
  // planId acá referencia un "preapproval_plan" creado antes en tu
  // cuenta de MercadoPago (monto, frecuencia, moneda ARS).
  const preApproval = new PreApproval(client);

  const result = await preApproval.create({
    body: {
      preapproval_plan_id: params.planId,
      payer_email: params.email,
      external_reference: params.userId,
      back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      status: "pending",
    },
  });

  return {
    provider: "mercadopago",
    externalId: result.id!,
    checkoutUrl: result.init_point ?? undefined,
    status: "incomplete",
  };
}

export async function cancelSubscription(preApprovalId: string) {
  const preApproval = new PreApproval(client);
  await preApproval.update({
    id: preApprovalId,
    body: { status: "cancelled" },
  });
}

export async function getSubscriptionStatus(
  preApprovalId: string
): Promise<SubscriptionStatus> {
  const preApproval = new PreApproval(client);
  const result = await preApproval.get({ id: preApprovalId });
  return mapMPStatus(result.status);
}

function mapMPStatus(status?: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    default:
      return "incomplete";
  }
}
