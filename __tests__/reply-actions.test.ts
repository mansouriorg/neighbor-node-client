import { beforeEach, expect, test, vi } from "vitest";
import * as actions from "@/app/board/[id]/reply-actions";

const { replyToPost } = actions;

// The real action reads the headers of the request, asks the logic and uses one
// shared counter. Here the headers and the logic are stand-ins that the test
// controls, and the counter allows 2 replies for each visitor. No file is read
// or written. The counter itself is the real one and lives as long as this file.
const state = {
  headers: {} as Record<string, string>,
  sent: [] as unknown[][],
  answer: { status: "sent" } as { status: string },
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

// Writes down the id and the input, but not the file and the time, which come
// after them.
vi.mock("@/lib/reply-post", () => ({
  replyToPostFromInput: async (...args: unknown[]) => {
    state.sent.push(args.slice(0, 2));
    if (state.broken) throw new Error("the stand-in is broken");
    return state.answer;
  },
}));

vi.mock("@/lib/live-reply-limits", async () => {
  const { createReplyLimits } = await import("@/lib/reply-limits");
  return { replyLimits: createReplyLimits({ replies: 2, windowMinutes: 60 }) };
});

beforeEach(() => {
  state.headers = {};
  state.sent = [];
  state.answer = { status: "sent" };
  state.broken = false;
});

const hello = { message: "I can help on Saturday." };

test("the module exports exactly the one action", () => {
  expect(Object.keys(actions)).toEqual(["replyToPost"]);
});

test("the id and the input are handed on unchanged, and the answer comes back unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  const result = await replyToPost("post-1", hello);
  expect(result).toEqual({ status: "sent" });
  expect(state.sent).toEqual([["post-1", hello]]);
});

test("odd input is handed on as it is, because the logic behind checks it", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  state.answer = { status: "not-found" };
  await replyToPost(undefined, { not: "a reply" });
  expect(state.sent[0][0]).toBe(undefined);
  expect(state.sent[0][1]).toEqual({ not: "a reply" });
});

test("the third reply of the same address in an hour is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.3" };
  expect(await replyToPost("post-1", hello)).toEqual({ status: "sent" });
  expect(await replyToPost("post-1", hello)).toEqual({ status: "sent" });
  expect(await replyToPost("post-1", hello)).toEqual({ status: "limited", minutes: 60 });
  expect(state.sent.length).toBe(2);
});

test("another address is counted apart", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  await replyToPost("post-1", hello);
  await replyToPost("post-1", hello);
  expect((await replyToPost("post-1", hello)).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.40" };
  expect((await replyToPost("post-1", hello)).status).toBe("sent");
});

test("the last address of a list is the visitor, the first ones can be made up", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.5" };
  await replyToPost("post-1", hello);
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.5" };
  await replyToPost("post-1", hello);
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.5" };
  expect((await replyToPost("post-1", hello)).status).toBe("limited");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  await replyToPost("post-1", hello);
  await replyToPost("post-1", hello);
  expect((await replyToPost("post-1", hello)).status).toBe("limited");
});

test("every answer of the logic except a failure keeps its place", async () => {
  const kept = ["sent", "enough", "closed", "not-found", "invalid"];
  for (const [index, status] of kept.entries()) {
    state.headers = { "x-forwarded-for": `198.51.100.${100 + index}` };
    state.answer = { status };
    expect((await replyToPost("post-1", hello)).status).toBe(status);
    expect((await replyToPost("post-1", hello)).status).toBe(status);
    expect((await replyToPost("post-1", hello)).status).toBe("limited");
  }
});

test("a try that fails on our side gives its place back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.6" };
  state.answer = { status: "failed" };
  for (let index = 0; index < 6; index += 1) {
    expect((await replyToPost("post-1", hello)).status).toBe("failed");
  }
  state.answer = { status: "sent" };
  expect((await replyToPost("post-1", hello)).status).toBe("sent");
});

test("if the logic throws, the place is given back and the error goes on", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.7" };
  state.broken = true;
  for (let index = 0; index < 4; index += 1) {
    await expect(replyToPost("post-1", hello)).rejects.toThrow("the stand-in is broken");
  }
  state.broken = false;
  expect((await replyToPost("post-1", hello)).status).toBe("sent");
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.8" };
  await replyToPost("post-1", hello);
  await replyToPost("post-1", hello);
  const refused = await replyToPost("post-1", hello);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
