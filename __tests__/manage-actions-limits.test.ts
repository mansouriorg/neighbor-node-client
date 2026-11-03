import { beforeEach, expect, test, vi } from "vitest";
import {
  changePostStatus,
  checkManageLink,
  removePost,
} from "@/app/board/[id]/manage/actions";

// The real actions read the headers of the request, ask the logic and use one
// shared counter. Here the headers and the logic are stand-ins that the test
// controls, and the counter allows 2 wrong tries for each visitor. No file is
// read or written. The counter itself is the real one and lives as long as this
// file.
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

// Writes down the name of the call and its first arguments (the id, the key and
// for a change the status), but not the file and the time, which come after them.
function reply(name: string, args: unknown[], count: number) {
  state.sent.push([name, ...args.slice(0, count)]);
  if (state.broken) throw new Error("the stand-in is broken");
  return state.answer;
}

vi.mock("@/lib/manage-post", () => ({
  checkOwnPostFromInput: async (...args: unknown[]) => reply("check", args, 2),
  changeOwnPostStatusFromInput: async (...args: unknown[]) => reply("change", args, 3),
  removeOwnPostFromInput: async (...args: unknown[]) => reply("remove", args, 2),
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

test("the third wrong try of the same address in ten minutes is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  expect(await checkManageLink("post-1", key)).toEqual({ status: "not-allowed" });
  expect(await checkManageLink("post-1", key)).toEqual({ status: "not-allowed" });
  const third = await checkManageLink("post-1", key);
  expect(third).toEqual({ status: "limited", minutes: 10 });
  expect(state.sent.length).toBe(2);
});

test("another address is counted apart", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  await checkManageLink("post-1", key);
  await checkManageLink("post-1", key);
  expect((await checkManageLink("post-1", key)).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.20" };
  expect((await checkManageLink("post-1", key)).status).toBe("not-allowed");
});

test("the last address of a list is the visitor, the first ones can be made up", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.3" };
  await checkManageLink("post-1", key);
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.3" };
  await checkManageLink("post-1", key);
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.3" };
  expect((await checkManageLink("post-1", key)).status).toBe("limited");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  await checkManageLink("post-1", key);
  await checkManageLink("post-1", key);
  expect((await checkManageLink("post-1", key)).status).toBe("limited");
});

test("tries that fit give their place back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  state.answer = { status: "ok" };
  for (let index = 0; index < 6; index += 1) {
    expect((await checkManageLink("post-1", key)).status).toBe("ok");
  }
  state.answer = { status: "removed" };
  expect((await removePost("post-1", key)).status).toBe("removed");
  state.answer = { status: "not-allowed" };
  expect((await checkManageLink("post-1", key)).status).toBe("not-allowed");
  expect((await checkManageLink("post-1", key)).status).toBe("not-allowed");
  expect((await checkManageLink("post-1", key)).status).toBe("limited");
});

test("a try that fails on our side gives its place back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.5" };
  state.answer = { status: "failed" };
  for (let index = 0; index < 6; index += 1) {
    expect((await checkManageLink("post-1", key)).status).toBe("failed");
  }
  state.answer = { status: "not-allowed" };
  expect((await checkManageLink("post-1", key)).status).toBe("not-allowed");
});

test("if the logic throws, the place is given back and the error goes on", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.6" };
  state.broken = true;
  for (let index = 0; index < 4; index += 1) {
    await expect(checkManageLink("post-1", key)).rejects.toThrow("the stand-in is broken");
  }
  state.broken = false;
  expect((await checkManageLink("post-1", key)).status).toBe("not-allowed");
});

test("the three actions share one counter, and a limited try reaches none of them", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.7" };
  await checkManageLink("post-1", key);
  await changePostStatus("post-1", key, "done");
  expect((await removePost("post-1", key)).status).toBe("limited");
  expect((await changePostStatus("post-1", key, "done")).status).toBe("limited");
  expect(state.sent.map((entry) => entry[0])).toEqual(["check", "change"]);
});

test("the id, the key and the status are handed on unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.8" };
  state.answer = { status: "ok" };
  await checkManageLink("post-1", key);
  await changePostStatus("post-2", key, "in-progress");
  await removePost("post-3", key);
  expect(state.sent).toEqual([
    ["check", "post-1", key],
    ["change", "post-2", key, "in-progress"],
    ["remove", "post-3", key],
  ]);
});

test("the answer to the browser is plain data", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.9" };
  await checkManageLink("post-1", key);
  await checkManageLink("post-1", key);
  const refused = await checkManageLink("post-1", key);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
