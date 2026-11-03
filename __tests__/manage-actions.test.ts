import { beforeEach, expect, test, vi } from "vitest";
import * as actions from "@/app/board/[id]/manage/actions";
import * as live from "@/lib/live-manage-limits";

// The real logic is tested in manage-limits.test.ts and writes real files. Here
// it is a stand-in, so the test only looks at what the three actions hand on:
// the id, the key, who the visitor is, and the shared counter. The headers of
// the request are a stand-in too.
const mocks = { check: vi.fn(), change: vi.fn(), remove: vi.fn() };
const state = { headers: {} as Record<string, string> };

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      const value = state.headers[name];
      return typeof value === "string" ? value : null;
    },
  }),
}));

vi.mock("@/lib/live-manage-limits", () => ({
  manageLimits: { name: "the counter of the running server" },
}));

vi.mock("@/lib/manage-limits", () => ({
  checkOwnPostWithinLimits: (...args: unknown[]) => mocks.check(...args),
  changeOwnPostStatusWithinLimits: (...args: unknown[]) => mocks.change(...args),
  removeOwnPostWithinLimits: (...args: unknown[]) => mocks.remove(...args),
}));

beforeEach(() => {
  mocks.check.mockReset();
  mocks.change.mockReset();
  mocks.remove.mockReset();
  state.headers = { "x-forwarded-for": "198.51.100.1" };
});

test("the module exports exactly the three actions", () => {
  expect(Object.keys(actions).sort()).toEqual([
    "changePostStatus",
    "checkManageLink",
    "removePost",
  ]);
});

test("checking hands on the id, the key, the visitor and the shared counter, and sends the answer back unchanged", async () => {
  const answer = { status: "not-allowed" };
  mocks.check.mockResolvedValue(answer);
  const result = await actions.checkManageLink("post-1", "some key");
  expect(result).toBe(answer);
  expect(mocks.check).toHaveBeenCalledTimes(1);
  expect(mocks.check).toHaveBeenCalledWith("post-1", "some key", "198.51.100.1", live.manageLimits);
  expect(mocks.check.mock.calls[0][3]).toBe(live.manageLimits);
});

test("changing hands on the id, the key, the status, the visitor and the shared counter, and sends the answer back unchanged", async () => {
  const answer = { status: "failed" };
  mocks.change.mockResolvedValue(answer);
  const result = await actions.changePostStatus("post-1", "some key", "in-progress");
  expect(result).toBe(answer);
  expect(mocks.change).toHaveBeenCalledTimes(1);
  expect(mocks.change).toHaveBeenCalledWith("post-1", "some key", "in-progress", "198.51.100.1", live.manageLimits);
  expect(mocks.change.mock.calls[0][4]).toBe(live.manageLimits);
});

test("taking down hands on the id, the key, the visitor and the shared counter, and sends the answer back unchanged", async () => {
  const answer = { status: "removed" };
  mocks.remove.mockResolvedValue(answer);
  const result = await actions.removePost("post-1", "some key");
  expect(result).toBe(answer);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.remove).toHaveBeenCalledWith("post-1", "some key", "198.51.100.1", live.manageLimits);
  expect(mocks.remove.mock.calls[0][3]).toBe(live.manageLimits);
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.change).not.toHaveBeenCalled();
});

test("a limited answer is sent back unchanged too", async () => {
  const answer = { status: "limited", minutes: 7 };
  mocks.check.mockResolvedValue(answer);
  mocks.change.mockResolvedValue(answer);
  mocks.remove.mockResolvedValue(answer);
  expect(await actions.checkManageLink("post-1", "some key")).toBe(answer);
  expect(await actions.changePostStatus("post-1", "some key", "done")).toBe(answer);
  expect(await actions.removePost("post-1", "some key")).toBe(answer);
});

test("the visitor is the last address of the list, and without a header it is one shared name", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.9" };
  await actions.checkManageLink("post-1", "some key");
  state.headers = {};
  await actions.checkManageLink("post-1", "some key");
  expect(mocks.check.mock.calls[0][2]).toBe("198.51.100.9");
  expect(mocks.check.mock.calls[1][2]).toBe("unknown");
});

test("odd input is handed on as it is, because the logic behind checks it", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  mocks.remove.mockResolvedValue({ status: "not-allowed" });
  await actions.checkManageLink(undefined, { not: "a key" });
  await actions.removePost({ not: "an id" }, undefined);
  expect(mocks.check.mock.calls[0][0]).toBe(undefined);
  expect(mocks.check.mock.calls[0][1]).toEqual({ not: "a key" });
  expect(mocks.remove.mock.calls[0][0]).toEqual({ not: "an id" });
  expect(mocks.remove.mock.calls[0][1]).toBe(undefined);
});
