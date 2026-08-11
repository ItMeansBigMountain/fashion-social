import { NextRequest, NextResponse } from "next/server";
import { cartIdentity, parseCartItems } from "@/lib/cart-service";
import { buildCartQuote } from "@/lib/commerce";
import { getCartDb, listCatalogDb, saveCartDb } from "@/lib/postgres-store";
import { signVoterId } from "@/lib/vote-service";
import { cartCookieSecret } from "@/lib/server-secrets";

const COOKIE = "fashion_cart";
const secret = cartCookieSecret();
function identity(request: NextRequest) {
  const { id } = cartIdentity(request.cookies.get(COOKIE)?.value, secret);
  return { id, token: signVoterId(id, secret) };
}
function withCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
export async function GET(request: NextRequest) {
  try {
    const { id, token } = identity(request);
    const cart = await getCartDb(id);
    const quote = cart?.items.length ? buildCartQuote(await listCatalogDb(), cart.items) : null;
    return withCookie(NextResponse.json({ cart: cart ?? { id, items: [] }, quote }), token);
  } catch { return NextResponse.json({ error: "Cart is temporarily unavailable." }, { status: 503 }); }
}
export async function PUT(request: NextRequest) {
  try {
    const items = parseCartItems(await request.json());
    const { id, token } = identity(request);
    const quote = items.length ? buildCartQuote(await listCatalogDb(), items) : null;
    const cart = await saveCartDb(id, items);
    return withCookie(NextResponse.json({ cart, quote }), token);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cart could not be saved." }, { status: 400 });
  }
}
