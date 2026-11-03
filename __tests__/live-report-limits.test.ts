import { expect, test } from "vitest";

test("the running server has one counter with the default numbers", async () => {
  const live = await import("@/lib/live-report-limits");
  const now = new Date(2026, 9, 25, 12, 0, 0);
  let allowed = 0;
  for (let index = 0; index < 12; index += 1) {
    if (live.reportLimits.take("someone", now).ok) allowed += 1;
  }
  expect(allowed).toBe(5);
  const again = await import("@/lib/live-report-limits");
  expect(again.reportLimits).toBe(live.reportLimits);
});
