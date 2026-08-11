import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { products } from "@/lib/products";
import { FixedWindowRateLimiter, signVoterId, verifyVoterToken, VoteStore, type Vote } from "@/lib/vote-service";

const VOTER_COOKIE = "wornly_voter";
const globalState = globalThis as typeof globalThis & {
  wornlyVotes?: VoteStore;
  wornlyVoterLimiter?: FixedWindowRateLimiter;
  wornlyIpLimiter?: FixedWindowRateLimiter;
  wornlyItemLimiter?: FixedWindowRateLimiter;
  wornlyVoteSecret?: string;
};
const voteStore = globalState.wornlyVotes ??= new VoteStore();
const voterLimiter = globalState.wornlyVoterLimiter ??= new FixedWindowRateLimiter(30, 60_000);
const ipLimiter = globalState.wornlyIpLimiter ??= new FixedWindowRateLimiter(120, 60_000);
const itemLimiter = globalState.wornlyItemLimiter ??= new FixedWindowRateLimiter(1, 3_000);
const voteSecret = process.env.VOTE_COOKIE_SECRET ?? (globalState.wornlyVoteSecret ??= randomBytes(32).toString("hex"));

function identity(request: NextRequest) {
  const token = request.cookies.get(VOTER_COOKIE)?.value;
  const existing = token ? verifyVoterToken(token, voteSecret) : null;
  return { voterId: existing ?? crypto.randomUUID(), isNew: !existing };
}

function clientAddress(request: NextRequest) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function withVoterCookie(response: NextResponse, voterId: string, isNew: boolean) {
  if (isNew) response.cookies.set(VOTER_COOKIE, signVoterId(voterId, voteSecret), { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  return response;
}

export function GET(request: NextRequest) {
  const { voterId, isNew } = identity(request);
  const votes = Object.fromEntries(products.map((product) => [product.id, voteStore.get(product.id, voterId)]));
  return withVoterCookie(NextResponse.json({ votes }), voterId, isNew);
}

export async function POST(request: NextRequest) {
  const { voterId, isNew } = identity(request);
  const voterRate = voterLimiter.consume(voterId);
  const ipRate = ipLimiter.consume(clientAddress(request));
  if (!voterRate.allowed || !ipRate.allowed) {
    const retryAfterMs = Math.max(voterRate.retryAfterMs, ipRate.retryAfterMs);
    const response = NextResponse.json({ error: "Too many votes. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });
    return withVoterCookie(response, voterId, isNew);
  }

  try {
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId : "";
    const vote: Vote | null = body.vote === "like" || body.vote === "dislike" ? body.vote : null;
    if (!products.some((product) => product.id === productId) || !vote) {
      return withVoterCookie(NextResponse.json({ error: "Invalid product or vote." }, { status: 400 }), voterId, isNew);
    }

    const itemRate = itemLimiter.consume(`${voterId}:${productId}`);
    if (!itemRate.allowed) {
      const response = NextResponse.json({ error: "Please wait a few seconds before voting on this item again." }, { status: 429, headers: { "Retry-After": String(Math.ceil(itemRate.retryAfterMs / 1000)) } });
      return withVoterCookie(response, voterId, isNew);
    }

    return withVoterCookie(NextResponse.json(voteStore.cast(productId, voterId, vote)), voterId, isNew);
  } catch {
    return withVoterCookie(NextResponse.json({ error: "The vote could not be processed." }, { status: 400 }), voterId, isNew);
  }
}
