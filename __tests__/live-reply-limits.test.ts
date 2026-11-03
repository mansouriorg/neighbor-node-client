import { expect, test } from "vitest";

test("the running server has one counter with the default numbers", async () => {
  const live = await import("@/lib/live-reply-limits");
  const now = new Date(2026, 9, 25, 12, 0, 0);
  let allowed = 0;
  for (let index = 0; index < 25; index += 1) {
    if (live.replyLimits.take("someone", now).ok) allowed += 1;
  }
  expect(allowed).toBe(10);
  const again = await import("@/lib/live-reply-limits");
  expect(again.replyLimits).toBe(live.replyLimits);
});
