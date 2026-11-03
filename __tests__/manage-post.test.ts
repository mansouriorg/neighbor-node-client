import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey, hashManageKey } from "@/lib/manage-key";
import {
  changeOwnPostStatusFromInput,
  checkOwnPostFromInput,
} from "@/lib/manage-post";
import { readPosts } from "@/lib/post-store";
import { savePostFromInput } from "@/lib/save-post";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("manage-post-");

const noon = new Date(2026, 9, 25, 12, 0, 0);

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

test("saving sends back a key, and the key opens the post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  expect(key.length).toBe(64);
  const answer = await checkOwnPostFromInput(id, key, file, noon);
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") {
    expect(answer.post.id).toBe(id);
    expect(answer.post.title).toBe("Help moving a sofa");
    expect(answer.post.status).toBe("open");
  }
});

test("the answer is plain data, and holds no fingerprint and no key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const answer = await checkOwnPostFromInput(id, key, file, noon);
  expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  expect(Object.keys(answer).sort()).toEqual(["post", "reports", "status"]);
  const text = JSON.stringify(answer);
  expect(text.includes(key)).toBe(false);
  expect(text.includes(hashManageKey(key))).toBe(false);
});

test("a wrong key and an unknown id get the same answer", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const refused = { status: "not-allowed" };
  expect(await checkOwnPostFromInput(id, createManageKey(), file, noon)).toEqual(refused);
  expect(await checkOwnPostFromInput("post-nothing", key, file, noon)).toEqual(refused);
  expect(await changeOwnPostStatusFromInput(id, createManageKey(), "done", file, noon)).toEqual(refused);
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
    expect(await checkOwnPostFromInput(id, key, unreadable, noon)).toEqual({ status: "not-allowed" });
  }
  for (const wrong of keys) {
    expect(await checkOwnPostFromInput("post-1", wrong, unreadable, noon)).toEqual({ status: "not-allowed" });
    expect(await changeOwnPostStatusFromInput("post-1", wrong, "done", unreadable, noon)).toEqual({ status: "not-allowed" });
  }
  // The same file really cannot be read, so the answers above skipped it.
  const opened = await quietly(() => checkOwnPostFromInput("post-1", key, unreadable, noon));
  expect(opened.value).toEqual({ status: "failed" });
});

test("a sample post cannot be managed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const answer = await checkOwnPostFromInput("sample-1", createManageKey(), file, noon);
  expect(answer).toEqual({ status: "not-allowed" });
});

test("the author can change the status, and the board then shows it", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const answer = await changeOwnPostStatusFromInput(id, key, "done", file, noon);
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect(answer.post.status).toBe("done");
  expect((await readPosts(file, noon))[0].status).toBe("done");
});

test("a status that does not exist is refused and nothing changes", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  for (const status of ["waiting", "", "DONE", 5, null, undefined]) {
    const answer = await changeOwnPostStatusFromInput(id, key, status, file, noon);
    expect(answer).toEqual({ status: "not-allowed" });
  }
  expect((await readPosts(file, noon))[0].status).toBe("open");
});

test("a damaged file gives a plain failure, is not replaced, and the log never holds the key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await writeFile(file, "{ not json", "utf8");
  const checked = await quietly(() => checkOwnPostFromInput(id, key, file, noon));
  const changed = await quietly(() => changeOwnPostStatusFromInput(id, key, "done", file, noon));
  expect(checked.value).toEqual({ status: "failed" });
  expect(changed.value).toEqual({ status: "failed" });
  expect(checked.logged.length).toBe(1);
  expect(changed.logged.length).toBe(1);
  const log = [...checked.logged, ...changed.logged].map((args) => args.map(String).join(" ")).join("\n");
  expect(log.includes(key)).toBe(false);
  expect(log).toContain("Nothing was changed");
});

test("a post from before private links cannot be managed with any key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const old = {
    id: "post-old",
    ...good,
    status: "open",
    // Five days before the day of these tests: the 30-day rule would hide a post older than that.
    createdAt: "2026-10-20T10:00:00.000Z",
  };
  await writeFile(file, JSON.stringify({ version: 1, posts: [old] }), "utf8");
  const key = createManageKey();
  expect(await checkOwnPostFromInput("post-old", key, file, noon)).toEqual({ status: "not-allowed" });
  expect(await changeOwnPostStatusFromInput("post-old", key, "done", file, noon)).toEqual({ status: "not-allowed" });
  expect((await readPosts(file, noon))[0].status).toBe("open");
});
