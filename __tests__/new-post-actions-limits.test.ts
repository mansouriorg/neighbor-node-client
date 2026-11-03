import { beforeEach, expect, test, vi } from "vitest";
import { savePost } from "@/app/board/new/actions";
import type { SavePostResult } from "@/lib/save-post";

// The real action reads the headers of the request, saves to a file and uses
// one shared counter. Here the headers and the saving are stand-ins that the
// test controls, and the counter allows 2 posts for each visitor, so no file
// is written. The counter itself is the real one and lives as long as this file.
const savedPost = {
  id: "post-1",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
} as const;

const state = {
  headers: {} as Record<string, string>,
  sent: [] as unknown[],
  answer: { status: "saved", post: savedPost, manageKey: "a".repeat(64) } as SavePostResult,
};

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      const value = state.headers[name];
      return typeof value === "string" ? value : null;
    },
  }),
}));

vi.mock("@/lib/save-post", () => ({
  savePostFromInput: async (input: unknown) => {
    state.sent.push(input);
    return state.answer;
  },
}));

vi.mock("@/lib/live-post-limits", async () => {
  const { createPostLimits } = await import("@/lib/post-limits");
  return { postLimits: createPostLimits({ perVisitor: 2, perSite: 100 }) };
});

beforeEach(() => {
  state.headers = {};
  state.sent = [];
  state.answer = { status: "saved", post: savedPost, manageKey: "a".repeat(64) };
});

const good = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

test("the third post of the same address in an hour is refused, and never reaches the saving", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("saved");
  const third = await savePost(good);
  expect(third).toEqual({ status: "limited", minutes: 60 });
  expect(state.sent.length).toBe(2);
});

test("another address is counted apart", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.20" };
  expect((await savePost(good)).status).toBe("saved");
});

test("the last address of a list is the visitor, the first ones can be made up", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.3" };
  expect((await savePost(good)).status).toBe("saved");
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.3" };
  expect((await savePost(good)).status).toBe("saved");
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.3" };
  expect((await savePost(good)).status).toBe("limited");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("limited");
});

test("posts that the saving refuses give their place back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  state.answer = { status: "invalid", errors: {} };
  for (let index = 0; index < 5; index += 1) {
    expect((await savePost(good)).status).toBe("invalid");
  }
  state.answer = { status: "saved", post: savedPost, manageKey: "a".repeat(64) };
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("saved");
  expect((await savePost(good)).status).toBe("limited");
});

test("the post is handed on unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.5" };
  await savePost(good);
  expect(state.sent).toEqual([good]);
});

test("the answer to the browser is plain data", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.6" };
  await savePost(good);
  await savePost(good);
  const refused = await savePost(good);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
