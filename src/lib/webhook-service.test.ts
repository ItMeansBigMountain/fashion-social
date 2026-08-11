import { describe, expect, it } from "vitest";
import { classifyStripeEvent } from "./webhook-service";

describe("classifyStripeEvent", () => {
  it("extracts a paid checkout with its signed server cart reference", () => {
    expect(classifyStripeEvent({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", customer_details: { email: "buyer@example.com" }, metadata: { cartId: "2f4a0cb9-28a5-4e39-99c3-0d87cf888888" } } } })).toEqual({ action: "complete", eventId: "evt_1", sessionId: "cs_1", paymentIntentId: "pi_1", cartId: "2f4a0cb9-28a5-4e39-99c3-0d87cf888888", email: "buyer@example.com" });
  });
  it("ignores unpaid checkout completion and unsupported events", () => {
    expect(classifyStripeEvent({ id: "evt_2", type: "checkout.session.completed", data: { object: { payment_status: "unpaid" } } })).toEqual({ action: "ignore", eventId: "evt_2" });
    expect(classifyStripeEvent({ id: "evt_3", type: "customer.created", data: { object: {} } })).toEqual({ action: "ignore", eventId: "evt_3" });
  });
  it("classifies expiration and refunds", () => {
    expect(classifyStripeEvent({ id: "evt_4", type: "checkout.session.expired", data: { object: { id: "cs_2", metadata: { cartId: "cart-2" } } } })).toMatchObject({ action: "expire", sessionId: "cs_2", cartId: "cart-2" });
    expect(classifyStripeEvent({ id: "evt_5", type: "charge.refunded", data: { object: { payment_intent: "pi_2" } } })).toMatchObject({ action: "refund", paymentIntentId: "pi_2" });
    expect(classifyStripeEvent({ id: "evt_7", type: "refund.updated", data: { object: { id: "re_1", payment_intent: "pi_2", status: "succeeded", metadata: { refund_request_id: "4cb597c7-bdbc-4c9a-b5ef-e256cdcc5c39" } } } })).toEqual({ action: "marketplaceRefund", eventId: "evt_7", refundId: "re_1", paymentIntentId: "pi_2", status: "succeeded", requestId: "4cb597c7-bdbc-4c9a-b5ef-e256cdcc5c39" });
    expect(classifyStripeEvent({ id: "evt_8", type: "transfer.created", data: { object: { id: "tr_1", metadata: { creator_payout_id: "4cb597c7-bdbc-4c9a-b5ef-e256cdcc5c39" } } } })).toEqual({ action: "creatorPayout", eventId: "evt_8", transferId: "tr_1", payoutId: "4cb597c7-bdbc-4c9a-b5ef-e256cdcc5c39", status: "paid" });
  });
  it("rejects a paid checkout missing required identity", () => {
    expect(() => classifyStripeEvent({ id: "evt_6", type: "checkout.session.completed", data: { object: { id: "cs_3", payment_status: "paid", metadata: {} } } })).toThrow("metadata");
  });
});
