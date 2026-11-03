import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

// The module is loaded inside the test, after the variables are set, because it
// reads them once, when it is loaded.
test("the running server takes its numbers from POSTS_PER_HOUR and POSTS_PER_HOUR_SITE", async () => {
  vi.stubEnv("POSTS_PER_HOUR", "7");
  vi.stubEnv("POSTS_PER_HOUR_SITE", "70");
  vi.resetModules();
  const live = await import("@/lib/live-post-limits");
  expect(live.postLimitSettings).toEqual({ perVisitor: 7, perSite: 70 });
  let allowed = 0;
  const now = new Date(2026, 9, 25, 12, 0, 0);
  for (let index = 0; index < 10; index += 1) {
    if (live.postLimits.take("someone", now).ok) allowed += 1;
  }
  expect(allowed).toBe(7);
});
