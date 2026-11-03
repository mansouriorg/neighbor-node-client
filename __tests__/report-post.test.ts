import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost, removeOwnPost, reportsKeptPerPost } from "@/lib/post-store";
import { reportPostFromInput } from "@/lib/report-post";
import { reportReasonIds } from "@/lib/report-reasons";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("report-post-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const later = new Date(2026, 9, 26, 9, 30, 0);

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string = sofa.title) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

// Runs something that logs an error, and keeps the log out of the test output.
async function quietly<T>(run: () => Promise<T>) {
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    return { value: await run(), logged };
  } finally {
    console.error = original;
  }
}

test("a report about a saved post is saved, with the reason and the time", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  expect(await reportPostFromInput(id, "scam", file, later)).toEqual({ status: "reported" });
  expect((await rawPosts(file))[0].reports).toEqual([
    { reason: "scam", at: later.toISOString() },
  ]);
});

test("every reason of the list is accepted", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  for (const reason of reportReasonIds) {
    expect(await reportPostFromInput(id, reason, file, later)).toEqual({ status: "reported" });
  }
  const saved = (await rawPosts(file))[0].reports.map((report: { reason: string }) => report.reason);
  expect(saved).toEqual([...reportReasonIds]);
});

test("a post that has enough reports says so, and nothing more is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  for (let count = 0; count < reportsKeptPerPost; count += 1) {
    expect(await reportPostFromInput(id, "spam", file, later)).toEqual({ status: "reported" });
  }
  expect(await reportPostFromInput(id, "spam", file, later)).toEqual({ status: "enough" });
  expect((await rawPosts(file))[0].reports.length).toBe(reportsKeptPerPost);
});

test("an unknown post, a sample post and a post that was taken down are not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect(await reportPostFromInput("post-nothing", "spam", file, later)).toEqual({ status: "not-found" });
  expect(await reportPostFromInput("sample-1", "spam", file, later)).toEqual({ status: "not-found" });
  await removeOwnPost(id, key, file, later);
  expect(await reportPostFromInput(id, "spam", file, later)).toEqual({ status: "not-found" });
});

test("an id of the wrong shape is not found, before the file is opened", async () => {
  // The "file" is a folder. Opening it would fail, and the answer would be "failed".
  const folder = await makeFolder();
  const wrongIds: unknown[] = [
    undefined,
    null,
    42,
    {},
    ["post-a"],
    "",
    "sample-1",
    "post-",
    `post-${"a".repeat(65)}`,
    "post-a b",
    "../post-a",
  ];
  for (const id of wrongIds) {
    expect(await reportPostFromInput(id, "spam", folder, later)).toEqual({ status: "not-found" });
  }
});

test("a reason that is not on the list is invalid, before the file is opened", async () => {
  const folder = await makeFolder();
  const wrongReasons: unknown[] = [
    undefined,
    null,
    3,
    {},
    ["spam"],
    "",
    "Spam",
    "spam ",
    "rude",
    "__proto__",
    "constructor",
  ];
  for (const reason of wrongReasons) {
    expect(await reportPostFromInput("post-a", reason, folder, later)).toEqual({ status: "invalid" });
  }
});

test("the id is judged first when both are wrong", async () => {
  const folder = await makeFolder();
  expect(await reportPostFromInput("nope", "nope", folder, later)).toEqual({ status: "not-found" });
});

test("a damaged file gives 'failed', is logged for the person who runs the server, and is never replaced", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ not json", "utf8");
  const { value, logged } = await quietly(() => reportPostFromInput("post-a", "spam", file, later));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
  expect(String(logged[0][0])).toContain("Saving a report failed");
  expect(await readFile(file, "utf8")).toBe("{ not json");
});

test("a folder in place of the file also gives 'failed'", async () => {
  const folder = await makeFolder();
  const { value, logged } = await quietly(() => reportPostFromInput("post-a", "spam", folder, later));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
});

test("the answer is plain data with one field, and holds no file path or error", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const answer = await reportPostFromInput(id, "other", file, later);
  expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  expect(Object.keys(answer)).toEqual(["status"]);
});
