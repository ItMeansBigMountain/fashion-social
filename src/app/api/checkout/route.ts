import { NextResponse } from "next/server";
import Stripe from "stripe";
import { findProduct } from "@/lib/products";

export async function POST(request: Request) {
  try {
    const { productId, size } = await request.json();
    const product = typeof productId === "string" ? findProduct(productId) : undefined;
    if (!product || typeof size !== "string" || !product.sizes.includes(size)) {
      return NextResponse.json({ error: "That product or size is unavailable." }, { status: 400 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Checkout is in preview mode. Add STRIPE_SECRET_KEY in Vercel to accept test or live payments." }, { status: 503 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#shop`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: product.price * 100,
          product_data: { name: product.name, description: `${product.color} · Size ${size}`, images: [product.image], metadata: { productId: product.id, size } },
        },
      }],
      metadata: { productId: product.id, size },
    });
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Checkout could not be started. Please try again." }, { status: 500 });
  }
}
