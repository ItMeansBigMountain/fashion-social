import { randomBytes } from "node:crypto";

declare global { var fashionSocialRuntimeSecret: string | undefined; }
export function cartCookieSecret() {
  return process.env.VOTE_COOKIE_SECRET ?? (globalThis.fashionSocialRuntimeSecret ??= randomBytes(32).toString("hex"));
}
