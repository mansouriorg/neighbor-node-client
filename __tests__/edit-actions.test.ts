import { beforeEach, expect, test, vi } from "vitest";
import * as actions from "@/app/board/[id]/manage/edit-actions";

const { editPost } = actions;

// The real action reads the headers of the request, asks the logic and uses the
// shared counter of the private page and the counter of edits. Here the headers
// and the logic are stand-ins that the test controls, the counter of the
// private page allows 2 wrong tries for each visitor, and the counter of edits
// allows 3 edits. No file is read or written.
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

// Writes down the id, the key and the input, but not the file and the time,
// which come after them.
vi.mock("@/lib/edit-own-post", () => ({
  editOwnPostFromInput: async (...args: unknown[]) => {
    state.sent.push(args.slice(0, 3));
    if (state.broken) throw new Error("the stand-in is broken");
    return state.answer;
  },
}));

vi.mock("@/lib/live-manage-limits", async () => {
  const { createManageLimits } = await import("@/lib/manage-limits");
  return { manageLimits: createManageLimits({ wrongTries: 2, windowMinutes: 10 }) };
});

vi.mock("@/lib/live-edit-limits", async () => {
  const { createEditLimits } = await import("@/lib/edit-own-post-limits");
  return { editLimits: createEditLimits({ edits: 3, windowMinutes: 60 }) };
});

beforeEach(() => {
  state.headers = {};
  state.sent = [];
  state.answer = { status: "not-allowed" };
  state.broken = false;
});

const key = "a".repeat(64);
const words = { title: "Help moving a sofa", details: "Saturday morning, two people.", area: "Olive Street" };

test("the module exports exactly the one action", () => {
  expect(Object.keys(actions)).toEqual(["editPost"]);
});

test("the id, the key and the input are handed on unchanged, and the answer comes back unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  state.answer = { status: "ok" };
  expect(await editPost("post-1", key, words)).toEqual({ status: "ok" });
  expect(state.sent).toEqual([["post-1", key, words]]);
});

test("odd input is handed on as it is, because the logic behind checks it", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  state.answer = { status: "invalid" };
  await editPost(undefined, 5, { not: "a post" });
  expect(state.sent[0][0]).toBe(undefined);
  expect(state.sent[0][1]).toBe(5);
  expect(state.sent[0][2]).toEqual({ not: "a post" });
});

test("the third wrong try of the same address in ten minutes is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.3" };
  expect(await editPost("post-1", key, words)).toEqual({ status: "not-allowed" });
  expect(await editPost("post-1", key, words)).toEqual({ status: "not-allowed" });
  expect(await editPost("post-1", key, words)).toEqual({ status: "limited", minutes: 10 });
  expect(state.sent.length).toBe(2);
});

test("the fourth edit of the same address in an hour is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  state.answer = { status: "ok" };
  for (let index = 0; index < 3; index += 1) {
    expect((await editPost("post-1", key, words)).status).toBe("ok");
  }
  expect(await editPost("post-1", key, words)).toEqual({ status: "limited", minutes: 60 });
  expect(state.sent.length).toBe(3);
});

test("texts that do not pass and tries that fail on our side give their places back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.5" };
  state.answer = { status: "invalid" };
  for (let index = 0; index < 8; index += 1) {
    expect((await editPost("post-1", key, words)).status).toBe("invalid");
  }
  state.answer = { status: "failed" };
  for (let index = 0; index < 8; index += 1) {
    expect((await editPost("post-1", key, words)).status).toBe("failed");
  }
  state.answer = { status: "ok" };
  expect((await editPost("post-1", key, words)).status).toBe("ok");
});

test("another address is counted apart, and the last address of a list is the visitor", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.6" };
  await editPost("post-1", key, words);
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.6" };
  await editPost("post-1", key, words);
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.6" };
  expect((await editPost("post-1", key, words)).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.60" };
  expect((await editPost("post-1", key, words)).status).toBe("not-allowed");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  await editPost("post-1", key, words);
  await editPost("post-1", key, words);
  expect((await editPost("post-1", key, words)).status).toBe("limited");
});

test("if the logic throws, the places are given back and the error goes on", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.7" };
  state.broken = true;
  for (let index = 0; index < 5; index += 1) {
    await expect(editPost("post-1", key, words)).rejects.toThrow("the stand-in is broken");
  }
  state.broken = false;
  state.answer = { status: "ok" };
  expect((await editPost("post-1", key, words)).status).toBe("ok");
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.8" };
  await editPost("post-1", key, words);
  await editPost("post-1", key, words);
  const refused = await editPost("post-1", key, words);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
