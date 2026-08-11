type StripeLikeEvent = { id?: unknown; type?: unknown; data?: { object?: Record<string, unknown> } };
export type WebhookDecision =
  | { action: "ignore"; eventId: string }
  | { action: "complete"; eventId: string; sessionId: string; paymentIntentId: string | null; cartId: string; email: string }
  | { action: "expire"; eventId: string; sessionId: string; cartId: string | null }
  | { action: "refund"; eventId: string; paymentIntentId: string }
  | { action: "marketplaceRefund"; eventId: string; refundId: string; paymentIntentId: string; status: "succeeded" | "failed"; requestId: string | null }
  | { action: "creatorPayout"; eventId: string; transferId: string; payoutId: string; status: "paid" | "failed" };
const text = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;

export function classifyStripeEvent(event: StripeLikeEvent): WebhookDecision {
  const eventId = text(event.id);
  if (!eventId) throw new Error("Stripe event ID is required");
  const object = event.data?.object ?? {};
  if (event.type === "checkout.session.completed") {
    if (object.payment_status !== "paid") return { action: "ignore", eventId };
    const sessionId = text(object.id);
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, unknown> : {};
    const cartId = text(metadata.cartId);
    const details = typeof object.customer_details === "object" && object.customer_details ? object.customer_details as Record<string, unknown> : {};
    const email = text(details.email);
    if (!sessionId || !cartId || !email) throw new Error("Paid checkout is missing required metadata or customer email");
    return { action: "complete", eventId, sessionId, paymentIntentId: text(object.payment_intent), cartId, email };
  }
  if (event.type === "checkout.session.expired") {
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, unknown> : {};
    return { action: "expire", eventId, sessionId: text(object.id) ?? "unknown", cartId: text(metadata.cartId) };
  }
  if (event.type === "charge.refunded") {
    const paymentIntentId = text(object.payment_intent);
    if (!paymentIntentId) throw new Error("Refund event is missing payment intent");
    return { action: "refund", eventId, paymentIntentId };
  }
  if (event.type === "refund.created" || event.type === "refund.updated") {
    if (object.status !== "succeeded" && object.status !== "failed") return { action: "ignore", eventId };
    const refundId = text(object.id), paymentIntentId = text(object.payment_intent);
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, unknown> : {};
    if (!refundId || !paymentIntentId) throw new Error("Marketplace refund event is missing identity");
    return { action: "marketplaceRefund", eventId, refundId, paymentIntentId, status: object.status, requestId: text(metadata.refund_request_id) };
  }
  if (event.type === "transfer.created" || event.type === "transfer.reversed") {
    const transferId=text(object.id),metadata=typeof object.metadata==="object"&&object.metadata?object.metadata as Record<string,unknown>:{};
    const payoutId=text(metadata.creator_payout_id);
    if(!transferId||!payoutId)throw new Error("Creator payout transfer is missing identity");
    return{action:"creatorPayout",eventId,transferId,payoutId,status:event.type==="transfer.created"?"paid":"failed"};
  }
  return { action: "ignore", eventId };
}
