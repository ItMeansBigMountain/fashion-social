import { createHmac, timingSafeEqual } from "node:crypto";

export type Vote = "like" | "dislike";
export type VoteSnapshot = { likes: number; dislikes: number; vote: Vote | null };
export type VoteResult = VoteSnapshot & { changed: boolean };

type Window = { startedAt: number; count: number };

function signature(voterId: string, secret: string) {
  return createHmac("sha256", secret).update(voterId).digest("base64url");
}

export function signVoterId(voterId: string, secret: string) {
  return `${voterId}.${signature(voterId, secret)}`;
}

export function verifyVoterToken(token: string, secret: string) {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const voterId = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(voterId, secret));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  return voterId;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (current.count >= this.limit) {
      return { allowed: false, retryAfterMs: this.windowMs - (now - current.startedAt) };
    }
    current.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
}

export class VoteStore {
  private readonly totals = new Map<string, { likes: number; dislikes: number }>();
  private readonly votes = new Map<string, Vote>();

  get(productId: string, voterId: string): VoteSnapshot {
    const totals = this.totals.get(productId) ?? { likes: 0, dislikes: 0 };
    return { ...totals, vote: this.votes.get(`${productId}:${voterId}`) ?? null };
  }

  cast(productId: string, voterId: string, vote: Vote): VoteResult {
    const key = `${productId}:${voterId}`;
    const previous = this.votes.get(key);
    if (previous === vote) return { ...this.get(productId, voterId), changed: false };

    const totals = this.totals.get(productId) ?? { likes: 0, dislikes: 0 };
    if (previous === "like") totals.likes -= 1;
    if (previous === "dislike") totals.dislikes -= 1;
    if (vote === "like") totals.likes += 1;
    if (vote === "dislike") totals.dislikes += 1;

    this.totals.set(productId, totals);
    this.votes.set(key, vote);
    return { ...totals, vote, changed: true };
  }
}
