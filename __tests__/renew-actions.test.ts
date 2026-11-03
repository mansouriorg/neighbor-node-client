import { beforeEach, expect, test, vi } from "vitest";
import * as actions from "@/app/board/[id]/manage/renew-actions";

const { renewPost } = actions;

// The real action reads the headers of the request, asks the logic and uses the
// shared counter of the private page. Here the headers and the logic are
// stand-ins that the test controls, and the counter allows 2 wrong tries for
// each visitor. No file is read or written.
const state = {
  headers: {} as Record<string, string>,
  sent: [] as unknown[][],
  answer: { status: "not-allowed" } as { status: string },
  broken: false,
};

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      const value = state.headers[name];
      return typeof value === "string" ? value : null;
    },
  }),
}));

// Writes down the id and the key, but not the file and the time, which come
// after them.
vi.mock("@/lib/renew-own-post", () => ({
  renewOwnPostFromInput: async (...args: unknown[]) => {
    state.sent.push(args.slice(0, 2));
    if (state.broken) throw new Error("the stand-in is broken");
    return state.answer;
  },
}));

vi.mock("@/lib/live-manage-limits", async () => {
  const { createManageLimits } = await import("@/lib/manage-limits");
  return { manageLimits: createManageLimits({ wrongTries: 2, windowMinutes: 10 }) };
});

beforeEach(() => {
  state.headers = {};
  state.sent = [];
  state.answer = { status: "not-allowed" };
  state.broken = false;
});

const key = "a".repeat(64);

test("the module exports exactly the one action", () => {
  expect(Object.keys(actions)).toEqual(["renewPost"]);
});

test("the id and the key are handed on unchanged, and the answer comes back unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  state.answer = { status: "ok" };
  expect(await renewPost("post-1", key)).toEqual({ status: "ok" });
  expect(state.sent).toEqual([["post-1", key]]);
});

test("odd input is handed on as it is, because the logic behind checks it", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  await renewPost(undefined, 5);
  expect(state.sent[0][0]).toBe(undefined);
  expect(state.sent[0][1]).toBe(5);
});

test("the third wrong try of the same address in ten minutes is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.3" };
  expect(await renewPost("post-1", key)).toEqual({ status: "not-allowed" });
  expect(await renewPost("post-1", key)).toEqual({ status: "not-allowed" });
  expect(await renewPost("post-1", key)).toEqual({ status: "limited", minutes: 10 });
  expect(state.sent.length).toBe(2);
});

test("tries with the right key and tries that fail on our side give their places back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  state.answer = { status: "ok" };
  for (let index = 0; index < 8; index += 1) {
    expect((await renewPost("post-1", key)).status).toBe("ok");
  }
  state.answer = { status: "failed" };
  for (let index = 0; index < 8; index += 1) {
    expect((await renewPost("post-1", key)).status).toBe("failed");
  }
  state.answer = { status: "ok" };
  expect((await renewPost("post-1", key)).status).toBe("ok");
});

test("another address is counted apart, and the last address of a list is the visitor", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.5" };
  await renewPost("post-1", key);
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.5" };
  await renewPost("post-1", key);
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.5" };
  expect((await renewPost("post-1", key)).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.50" };
  expect((await renewPost("post-1", key)).status).toBe("not-allowed");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  await renewPost("post-1", key);
  await renewPost("post-1", key);
  expect((await renewPost("post-1", key)).status).toBe("limited");
});

test("if the logic throws, the place is given back and the error goes on", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.6" };
  state.broken = true;
  for (let index = 0; index < 5; index += 1) {
    await expect(renewPost("post-1", key)).rejects.toThrow("the stand-in is broken");
  }
  state.broken = false;
  state.answer = { status: "ok" };
  expect((await renewPost("post-1", key)).status).toBe("ok");
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.7" };
  await renewPost("post-1", key);
  await renewPost("post-1", key);
  const refused = await renewPost("post-1", key);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
