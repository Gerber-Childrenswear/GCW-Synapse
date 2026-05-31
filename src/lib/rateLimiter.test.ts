import test from "node:test";
import assert from "node:assert/strict";
import { FixedWindowRateLimiter } from "./rateLimiter";

test("rate limiter allows up to max within a window", () => {
  let clock = 1000;
  const limiter = new FixedWindowRateLimiter({ windowMs: 1000, max: 3, now: () => clock });

  assert.equal(limiter.check("ip").allowed, true);
  assert.equal(limiter.check("ip").allowed, true);
  const third = limiter.check("ip");
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const fourth = limiter.check("ip");
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);
});

test("rate limiter resets after the window elapses", () => {
  let clock = 1000;
  const limiter = new FixedWindowRateLimiter({ windowMs: 1000, max: 1, now: () => clock });

  assert.equal(limiter.check("ip").allowed, true);
  assert.equal(limiter.check("ip").allowed, false);

  clock += 1000;
  assert.equal(limiter.check("ip").allowed, true);
});

test("rate limiter isolates keys", () => {
  let clock = 1000;
  const limiter = new FixedWindowRateLimiter({ windowMs: 1000, max: 1, now: () => clock });

  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("b").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
});

test("rate limiter prune drops expired entries", () => {
  let clock = 1000;
  const limiter = new FixedWindowRateLimiter({ windowMs: 1000, max: 5, now: () => clock });

  limiter.check("ip");
  clock += 2000;
  limiter.prune();

  // After prune the key is fresh again with full allowance.
  const result = limiter.check("ip");
  assert.equal(result.remaining, 4);
});
