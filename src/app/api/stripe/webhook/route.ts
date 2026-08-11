import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { processPaidCheckoutDb, processRefundDb } from "@/lib/postgres-store";
import { classifyStripeEvent } from "@/lib/webhook-service";
import { finalizeMarketplaceRefundDb, finalizeCreatorPayoutDb } from "@/lib/creator-marketplace-store";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 }); }
  try {
    const decision = classifyStripeEvent(event as unknown as Parameters<typeof classifyStripeEvent>[0]);
    if (decision.action === "complete") {
      const session = event.data.object as Stripe.Checkout.Session;
      const source = session as unknown as { collected_information?: { shipping_details?: { name?: string; address?: Record<string,string | null> } }; shipping_details?: { name?: string; address?: Record<string,string | null> } };
      const shipping = source.collected_information?.shipping_details ?? source.shipping_details;
      const address = shipping?.address;
      if (!shipping?.name || !address?.line1 || !address.city || !address.postal_code || !address.country) throw new Error("Stripe session is missing shipping address");
      const orderId = await processPaidCheckoutDb({
        ...decision,
        shippingCents: session.total_details?.amount_shipping ?? 0,
        taxCents: session.total_details?.amount_tax ?? 0,
        totalCents: session.amount_total ?? 0,
        address: { name: shipping.name, line1: address.line1, line2: address.line2 ?? undefined, city: address.city, state: address.state ?? "", postalCode: address.postal_code, country: address.country },
      });
      return NextResponse.json({ received: true, orderId });
    }
    if (decision.action === "refund") return NextResponse.json({ received: true, orderId: await processRefundDb(decision.eventId, decision.paymentIntentId) });
    if (decision.action === "marketplaceRefund") return NextResponse.json({ received: true, refund: await finalizeMarketplaceRefundDb(decision.eventId,decision.refundId,decision.paymentIntentId,decision.status,decision.requestId) });
    if (decision.action === "creatorPayout") return NextResponse.json({ received: true, payout: await finalizeCreatorPayoutDb(decision.eventId,decision.transferId,decision.payoutId,decision.status) });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
