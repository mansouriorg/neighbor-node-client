import { beforeEach, expect, test, vi } from "vitest";
import * as actions from "@/app/board/[id]/actions";

const { reportPost } = actions;

// The real action reads the headers of the request, asks the logic and uses one
// shared counter. Here the headers and the logic are stand-ins that the test
// controls, and the counter allows 2 reports for each visitor. No file is read
// or written. The counter itself is the real one and lives as long as this file.
const state = {
  headers: {} as Record<string, string>,
  sent: [] as unknown[][],
  answer: { status: "reported" } as { status: string },
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

// Writes down the id and the reason, but not the file and the time, which come
// after them.
vi.mock("@/lib/report-post", () => ({
  reportPostFromInput: async (...args: unknown[]) => {
    state.sent.push(args.slice(0, 2));
    if (state.broken) throw new Error("the stand-in is broken");
    return state.answer;
  },
}));

vi.mock("@/lib/live-report-limits", async () => {
  const { createReportLimits } = await import("@/lib/report-limits");
  return { reportLimits: createReportLimits({ reports: 2, windowMinutes: 60 }) };
});

beforeEach(() => {
  state.headers = {};
  state.sent = [];
  state.answer = { status: "reported" };
  state.broken = false;
});

test("the module exports exactly the one action", () => {
  expect(Object.keys(actions)).toEqual(["reportPost"]);
});

test("the id and the reason are handed on unchanged, and the answer comes back unchanged", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.1" };
  const result = await reportPost("post-1", "scam");
  expect(result).toEqual({ status: "reported" });
  expect(state.sent).toEqual([["post-1", "scam"]]);
});

test("odd input is handed on as it is, because the logic behind checks it", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.2" };
  state.answer = { status: "not-found" };
  await reportPost(undefined, { not: "a reason" });
  expect(state.sent[0][0]).toBe(undefined);
  expect(state.sent[0][1]).toEqual({ not: "a reason" });
});

test("the third report of the same address in an hour is limited, and never reaches the logic", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.3" };
  expect(await reportPost("post-1", "spam")).toEqual({ status: "reported" });
  expect(await reportPost("post-1", "spam")).toEqual({ status: "reported" });
  expect(await reportPost("post-1", "spam")).toEqual({ status: "limited", minutes: 60 });
  expect(state.sent.length).toBe(2);
});

test("another address is counted apart", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.4" };
  await reportPost("post-1", "spam");
  await reportPost("post-1", "spam");
  expect((await reportPost("post-1", "spam")).status).toBe("limited");
  state.headers = { "x-forwarded-for": "198.51.100.40" };
  expect((await reportPost("post-1", "spam")).status).toBe("reported");
});

test("the last address of a list is the visitor, the first ones can be made up", async () => {
  state.headers = { "x-forwarded-for": "6.6.6.6, 198.51.100.5" };
  await reportPost("post-1", "spam");
  state.headers = { "x-forwarded-for": "7.7.7.7, 198.51.100.5" };
  await reportPost("post-1", "spam");
  state.headers = { "x-forwarded-for": "8.8.8.8, 198.51.100.5" };
  expect((await reportPost("post-1", "spam")).status).toBe("limited");
});

test("with no address header, all visitors count as one", async () => {
  state.headers = {};
  await reportPost("post-1", "spam");
  await reportPost("post-1", "spam");
  expect((await reportPost("post-1", "spam")).status).toBe("limited");
});

test("every answer of the logic except a failure keeps its place", async () => {
  const kept = ["reported", "enough", "not-found", "invalid"];
  for (const [index, status] of kept.entries()) {
    state.headers = { "x-forwarded-for": `198.51.100.${100 + index}` };
    state.answer = { status };
    expect((await reportPost("post-1", "spam")).status).toBe(status);
    expect((await reportPost("post-1", "spam")).status).toBe(status);
    expect((await reportPost("post-1", "spam")).status).toBe("limited");
  }
});

test("a try that fails on our side gives its place back", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.6" };
  state.answer = { status: "failed" };
  for (let index = 0; index < 6; index += 1) {
    expect((await reportPost("post-1", "spam")).status).toBe("failed");
  }
  state.answer = { status: "reported" };
  expect((await reportPost("post-1", "spam")).status).toBe("reported");
});

test("if the logic throws, the place is given back and the error goes on", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.7" };
  state.broken = true;
  for (let index = 0; index < 4; index += 1) {
    await expect(reportPost("post-1", "spam")).rejects.toThrow("the stand-in is broken");
  }
  state.broken = false;
  expect((await reportPost("post-1", "spam")).status).toBe("reported");
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  state.headers = { "x-forwarded-for": "198.51.100.8" };
  await reportPost("post-1", "spam");
  await reportPost("post-1", "spam");
  const refused = await reportPost("post-1", "spam");
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
