import { expect, test } from "vitest";

test("the running server has one counter for edits with the default numbers", async () => {
  const live = await import("@/lib/live-edit-limits");
  const now = new Date(2026, 9, 25, 12, 0, 0);
  let allowed = 0;
  for (let index = 0; index < 15; index += 1) {
    if (live.editLimits.take("someone", now).ok) allowed += 1;
  }
  expect(allowed).toBe(10);
  const again = await import("@/lib/live-edit-limits");
  expect(again.editLimits).toBe(live.editLimits);
});
