import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, signVoterId, verifyVoterToken, VoteStore } from "./vote-service";

describe("signed voter identity", () => {
  it("accepts a token signed with the configured secret", () => {
    const token = signVoterId("voter-123", "secret-one");
    expect(verifyVoterToken(token, "secret-one")).toBe("voter-123");
  });

  it("rejects tampered IDs, signatures, and the wrong secret", () => {
    const token = signVoterId("voter-123", "secret-one");
    expect(verifyVoterToken(token.replace("voter-123", "attacker"), "secret-one")).toBeNull();
    expect(verifyVoterToken(`${token}x`, "secret-one")).toBeNull();
    expect(verifyVoterToken(token, "secret-two")).toBeNull();
  });
});

describe("FixedWindowRateLimiter", () => {
  it("blocks requests beyond the configured window limit", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);

    expect(limiter.consume("client", 0).allowed).toBe(true);
    expect(limiter.consume("client", 100).allowed).toBe(true);
    const blocked = limiter.consume("client", 200);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
  });

  it("allows a client again when the fixed window expires", () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);

    expect(limiter.consume("client", 0).allowed).toBe(true);
    expect(limiter.consume("client", 999).allowed).toBe(false);
    expect(limiter.consume("client", 1_000).allowed).toBe(true);
  });
});

describe("VoteStore", () => {
  it("counts a first like once and treats the same vote as idempotent", () => {
    const store = new VoteStore();

    expect(store.cast("product", "voter", "like")).toEqual({ likes: 1, dislikes: 0, vote: "like", changed: true });
    expect(store.cast("product", "voter", "like")).toEqual({ likes: 1, dislikes: 0, vote: "like", changed: false });
  });

  it("reverses the old count when a voter changes sides", () => {
    const store = new VoteStore();

    store.cast("product", "voter", "like");
    expect(store.cast("product", "voter", "dislike")).toEqual({ likes: 0, dislikes: 1, vote: "dislike", changed: true });
    expect(store.get("product", "voter")).toEqual({ likes: 0, dislikes: 1, vote: "dislike" });
  });

  it("keeps products and voters isolated", () => {
    const store = new VoteStore();

    store.cast("one", "alice", "like");
    store.cast("one", "bob", "dislike");
    store.cast("two", "alice", "like");

    expect(store.get("one", "alice")).toEqual({ likes: 1, dislikes: 1, vote: "like" });
    expect(store.get("one", "bob")).toEqual({ likes: 1, dislikes: 1, vote: "dislike" });
    expect(store.get("two", "alice")).toEqual({ likes: 1, dislikes: 0, vote: "like" });
  });
});
