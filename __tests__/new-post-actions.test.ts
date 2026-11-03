import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { savePost } from "@/app/board/new/actions";

// The action reads the headers of the request. A test has no request, so this
// stand-in gives it a plain set of headers.
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.7" : null),
  }),
}));

// These tests only send posts that fail the checks, so nothing is ever written.
// Saving itself is tested in save-post.test.ts, in a folder made for the test.

const source = readFileSync(
  join(process.cwd(), "app/board/new/actions.ts"),
  "utf8",
);

test("the file starts with the use server mark, so Next runs it on the server", () => {
  const firstLine = source.split("\n")[0];
  expect(firstLine).toBe('"use server";');
});

test("the file exports only async functions, which a use server file requires", () => {
  const exports = source
    .split("\n")
    .filter((line) => line.startsWith("export "));
  expect(exports.length).toBeGreaterThan(0);
  for (const line of exports) {
    expect(line.startsWith("export async function ")).toBe(true);
  }
});

test("a request with no post in it comes back as a refusal, not an error", async () => {
  const result = await savePost({});
  expect(result.status).toBe("invalid");
  if (result.status === "invalid") {
    expect(Object.keys(result.errors).length).toBe(4);
  }
});

test("junk comes back as a refusal too", async () => {
  for (const input of [null, "junk", 42, []]) {
    const result = await savePost(input);
    expect(result.status).toBe("invalid");
  }
});
