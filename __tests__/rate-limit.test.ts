import { expect, test } from "vitest";
import {
  createRateLimiter,
  type RateLimiter,
  type TakeResult,
} from "@/lib/rate-limit";

const start = 1000000;

// A moment, given as the number of milliseconds after the start.
function at(offset: number): Date {
  return new Date(start + offset);
}

// Two places in every 1000 milliseconds.
function small(maxKeys: number = 100): RateLimiter {
  return createRateLimiter({ limit: 2, windowMs: 1000, maxKeys });
}

function waitOf(result: TakeResult): number {
  return result.ok ? -1 : result.retryAfterMs;
}

test("allows places up to the limit, then refuses and says how long to wait", () => {
  const limiter = small();
  expect(limiter.take("a", at(0)).ok).toBe(true);
  expect(limiter.take("a", at(100)).ok).toBe(true);
  const refused = limiter.take("a", at(200));
  expect(refused.ok).toBe(false);
  expect(waitOf(refused)).toBe(800);
});

test("a place comes back when the oldest one is a full window old", () => {
  const limiter = small();
  limiter.take("a", at(0));
  limiter.take("a", at(200));
  const almost = limiter.take("a", at(999));
  expect(almost.ok).toBe(false);
  expect(waitOf(almost)).toBe(1);
  expect(limiter.take("a", at(1000)).ok).toBe(true);
});

test("asking again while blocked does not make the wait longer", () => {
  const limiter = small();
  limiter.take("a", at(0));
  limiter.take("a", at(100));
  for (const moment of [200, 300, 400, 500, 600]) {
    expect(limiter.take("a", at(moment)).ok).toBe(false);
  }
  expect(limiter.take("a", at(1000)).ok).toBe(true);
});

test("each key is counted on its own", () => {
  const limiter = small();
  limiter.take("a", at(0));
  limiter.take("a", at(0));
  expect(limiter.take("a", at(1)).ok).toBe(false);
  expect(limiter.take("b", at(1)).ok).toBe(true);
});

test("a refund gives the place back", () => {
  const limiter = small();
  limiter.take("a", at(0));
  const second = limiter.take("a", at(10));
  expect(limiter.take("a", at(20)).ok).toBe(false);
  if (second.ok) second.permit.refund();
  expect(limiter.take("a", at(30)).ok).toBe(true);
});

test("a refund works once only, so calling it twice cannot free another place", () => {
  const limiter = small();
  const first = limiter.take("a", at(0));
  limiter.take("a", at(0));
  if (first.ok) {
    first.permit.refund();
    first.permit.refund();
  }
  expect(limiter.take("a", at(5)).ok).toBe(true);
  expect(limiter.take("a", at(6)).ok).toBe(false);
});

test("refunding a place that is already a full window old changes nothing", () => {
  const limiter = small();
  const old = limiter.take("a", at(0));
  expect(limiter.take("a", at(2000)).ok).toBe(true);
  if (old.ok) old.permit.refund();
  expect(limiter.take("a", at(2001)).ok).toBe(true);
  expect(limiter.take("a", at(2002)).ok).toBe(false);
});

test("a refund for a key that was forgotten does nothing and does not fail", () => {
  const limiter = small(1);
  const first = limiter.take("a", at(0));
  limiter.take("b", at(1));
  expect(limiter.remembered()).toBe(1);
  if (first.ok) first.permit.refund();
  expect(limiter.remembered()).toBe(1);
});

test("when the memory is full, keys with nothing left to count are forgotten first", () => {
  const limiter = small(2);
  limiter.take("a", at(0));
  limiter.take("b", at(900));
  limiter.take("c", at(1500));
  expect(limiter.remembered()).toBe(2);
  // b was kept, so it still remembers its place from 900.
  expect(limiter.take("b", at(1500)).ok).toBe(true);
  expect(limiter.take("b", at(1501)).ok).toBe(false);
});

test("when the memory is full, every key with nothing left to count is let go at once", () => {
  const limiter = small(3);
  limiter.take("a", at(0));
  limiter.take("b", at(10));
  limiter.take("c", at(20));
  limiter.take("d", at(1500));
  expect(limiter.remembered()).toBe(1);
});

test("when every key is fresh, the one not used for the longest time is forgotten", () => {
  const limiter = small(2);
  limiter.take("a", at(0));
  limiter.take("b", at(1));
  limiter.take("c", at(2));
  expect(limiter.remembered()).toBe(2);
  // a was forgotten, so it starts again from zero and gets two new places.
  expect(limiter.take("a", at(3)).ok).toBe(true);
  expect(limiter.take("a", at(4)).ok).toBe(true);
});

test("a key that keeps asking while blocked is not forgotten before quiet keys", () => {
  const limiter = small(2);
  limiter.take("a", at(0));
  limiter.take("a", at(1));
  limiter.take("b", at(2));
  expect(limiter.take("a", at(3)).ok).toBe(false);
  limiter.take("c", at(4));
  expect(limiter.remembered()).toBe(2);
  // b was forgotten, not a, so a is still blocked.
  expect(limiter.take("a", at(5)).ok).toBe(false);
});

test("never remembers more keys than allowed, however many different keys come", () => {
  const limiter = small(50);
  for (let index = 0; index < 500; index += 1) {
    limiter.take(`visitor-${index}`, at(index));
    expect(limiter.remembered()).toBeLessThan(51);
  }
  expect(limiter.remembered()).toBe(50);
});

test("a blocked key that keeps asking does not use more memory", () => {
  const limiter = small();
  limiter.take("a", at(0));
  limiter.take("a", at(1));
  for (let index = 0; index < 1000; index += 1) {
    limiter.take("a", at(2 + index % 100));
  }
  expect(limiter.remembered()).toBe(1);
});

test("odd key names are ordinary keys", () => {
  const limiter = small();
  limiter.take("__proto__", at(0));
  limiter.take("__proto__", at(1));
  expect(limiter.take("__proto__", at(2)).ok).toBe(false);
  expect(limiter.take("constructor", at(2)).ok).toBe(true);
  expect(limiter.take("", at(2)).ok).toBe(true);
});

test("the wait is never longer than the window, even when the clock jumped back", () => {
  const limiter = small();
  limiter.take("a", at(10000));
  limiter.take("a", at(10000));
  const refused = limiter.take("a", at(0));
  expect(refused.ok).toBe(false);
  expect(waitOf(refused)).toBe(1000);
});

test("the wait is worked out from the oldest place, also when moments arrive out of order", () => {
  const limiter = small();
  limiter.take("a", at(500));
  limiter.take("a", at(100));
  expect(waitOf(limiter.take("a", at(200)))).toBe(900);
});

test("wrong settings are refused with a clear message", () => {
  const wrong = [
    { limit: 0, windowMs: 1000, maxKeys: 10 },
    { limit: 1.5, windowMs: 1000, maxKeys: 10 },
    { limit: Number.NaN, windowMs: 1000, maxKeys: 10 },
    { limit: 2, windowMs: 0, maxKeys: 10 },
    { limit: 2, windowMs: Number.POSITIVE_INFINITY, maxKeys: 10 },
    { limit: 2, windowMs: 1000, maxKeys: 0 },
    { limit: 2, windowMs: 1000, maxKeys: -5 },
  ];
  for (const options of wrong) {
    expect(() => createRateLimiter(options)).toThrow(
      "must be a whole number of at least 1",
    );
  }
});
