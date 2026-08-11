import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cartIdentity } from "@/lib/cart-service";
import { buildCheckoutConfig } from "@/lib/checkout-service";
import { buildCartQuote } from "@/lib/commerce";
import { getCartDb, listCatalogDb } from "@/lib/postgres-store";
import { cartCookieSecret } from "@/lib/server-secrets";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("fashion_cart")?.value;
    const identity = cartIdentity(token, cartCookieSecret());
    if (identity.fresh) return NextResponse.json({ error: "Your cart session is invalid. Please reopen your cart." }, { status: 400 });
    const cart = await getCartDb(identity.id);
    if (!cart?.items.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    const quote = buildCartQuote(await listCatalogDb(), cart.items);
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Checkout is ready for Stripe test mode. Add STRIPE_SECRET_KEY to accept payment.", quote }, { status: 503 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create(buildCheckoutConfig(quote, cart.id, origin));
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error && /stock|unavailable|quantity/i.test(error.message) ? error.message : "Checkout could not be started. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
