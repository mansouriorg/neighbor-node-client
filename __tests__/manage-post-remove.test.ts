import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey, hashManageKey } from "@/lib/manage-key";
import {
  changeOwnPostStatusFromInput,
  checkOwnPostFromInput,
  removeOwnPostFromInput,
} from "@/lib/manage-post";
import { readPosts } from "@/lib/post-store";
import { savePostFromInput } from "@/lib/save-post";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("manage-remove-");

const noon = new Date(2026, 9, 25, 12, 0, 0);
const later = new Date(2026, 9, 26, 9, 30, 0);

const good = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

// Saves a post through the same path the form uses, and gives back what the
// author gets: the id and the secret key.
async function saveGood(file: string) {
  const result = await savePostFromInput(good, file, noon);
  if (result.status === "saved") {
    return { id: result.post.id, key: result.manageKey };
  }
  throw new Error("The test post was not saved.");
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

test("the author takes the post down, and the answer is plain data without the post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const answer = await removeOwnPostFromInput(id, key, file, later);
  expect(answer).toEqual({ status: "removed" });
  expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  expect((await readPosts(file, later)).length).toBe(0);
});

test("after that the same link is refused for a check, a change and a second take-down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await removeOwnPostFromInput(id, key, file, later);
  const refused = { status: "not-allowed" };
  expect(await checkOwnPostFromInput(id, key, file, later)).toEqual(refused);
  expect(await changeOwnPostStatusFromInput(id, key, "done", file, later)).toEqual(refused);
  expect(await removeOwnPostFromInput(id, key, file, later)).toEqual(refused);
});

test("a wrong key and an unknown id get the same answer, and the post stays", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const refused = { status: "not-allowed" };
  expect(await removeOwnPostFromInput(id, createManageKey(), file, later)).toEqual(refused);
  expect(await removeOwnPostFromInput("post-nothing", key, file, later)).toEqual(refused);
  expect((await readPosts(file, later)).length).toBe(1);
});

test("input of the wrong shape is refused before the file is opened", async () => {
  const folder = await makeFolder();
  // A file cannot live inside a file, so reading this path always fails.
  await writeFile(join(folder, "blocker"), "x", "utf8");
  const unreadable = join(folder, "blocker", "posts.json");
  const key = createManageKey();
  const ids = [undefined, null, 5, {}, "", "post-", "sample-1", "post-a b", "post-../x", "post-" + "a".repeat(65)];
  const keys = [undefined, 5, "", "short", key + "a", key.slice(1)];
  for (const id of ids) {
    expect(await removeOwnPostFromInput(id, key, unreadable, later)).toEqual({ status: "not-allowed" });
  }
  for (const wrong of keys) {
    expect(await removeOwnPostFromInput("post-1", wrong, unreadable, later)).toEqual({ status: "not-allowed" });
  }
  // The same file really cannot be read, so the answers above skipped it.
  const opened = await quietly(() => removeOwnPostFromInput("post-1", key, unreadable, later));
  expect(opened.value).toEqual({ status: "failed" });
});

test("a sample post and a post from before private links cannot be taken down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const old = { id: "post-old", ...good, status: "open", createdAt: "2026-01-01T10:00:00.000Z" };
  const text = JSON.stringify({ version: 1, posts: [old] });
  await writeFile(file, text, "utf8");
  const key = createManageKey();
  expect(await removeOwnPostFromInput("sample-1", key, file, later)).toEqual({ status: "not-allowed" });
  expect(await removeOwnPostFromInput("post-old", key, file, later)).toEqual({ status: "not-allowed" });
  expect(await readFile(file, "utf8")).toBe(text);
});

test("the fingerprint of a key does not take a post down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const answer = await removeOwnPostFromInput(id, hashManageKey(key), file, later);
  expect(answer).toEqual({ status: "not-allowed" });
  expect((await readPosts(file, later)).length).toBe(1);
});

test("a damaged file gives a plain failure, is not replaced, and the log never holds the key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await writeFile(file, "{ not json", "utf8");
  const result = await quietly(() => removeOwnPostFromInput(id, key, file, later));
  expect(result.value).toEqual({ status: "failed" });
  expect(result.logged.length).toBe(1);
  const log = result.logged[0].map(String).join(" ");
  expect(log.includes(key)).toBe(false);
  expect(log).toContain("Nothing was changed");
  expect(await readFile(file, "utf8")).toBe("{ not json");
});
