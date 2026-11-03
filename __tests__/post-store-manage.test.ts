import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey, hashManageKey } from "@/lib/manage-key";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("manage-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string = sofa.title) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

// A post as an older version wrote it: it has no fingerprint.
function oldEntry(id: string) {
  return {
    id,
    kind: "help",
    title: "An older post here",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    // Five days before the day of these tests: the 30-day rule would hide a post older than that.
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

test("a saved post comes with a key, and every post gets its own", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  expect(first.key.length).toBe(64);
  expect(second.key.length).toBe(64);
  expect(first.key).not.toBe(second.key);
});

test("the file keeps the fingerprint of the key and never the key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { key } = await save(file);
  const text = await readFile(file, "utf8");
  expect(text.includes(key)).toBe(false);
  expect((await rawPosts(file))[0].manageKeyHash).toBe(hashManageKey(key));
});

test("the posts that the pages read carry neither the key nor the fingerprint", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { key } = await save(file);
  const shown = JSON.stringify(await readPosts(file, noon));
  expect(shown.includes("manageKeyHash")).toBe(false);
  expect(shown.includes(hashManageKey(key))).toBe(false);
  expect(shown.includes(key)).toBe(false);
});

test("the right key opens its own post and no other", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const middle = await save(file, "The second post here");
  await save(file, "The third post here");
  const found = await readOwnPost(middle.id, middle.key, file, noon);
  const shown = await readPosts(file, noon);
  expect(found).toEqual({
    ok: true,
    // The author also gets how long the post stays, which the board does not.
    post: { ...shown.find((post) => post.id === middle.id), keep: { state: "shown", daysLeft: 30 } },
    reports: { total: 0, byReason: [] },
  });
});

test("a wrong key, the key of another post and an unknown id open nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const refused = { ok: false, reason: "not-allowed" };
  expect(await readOwnPost(first.id, createManageKey(), file, noon)).toEqual(refused);
  expect(await readOwnPost(first.id, second.key, file, noon)).toEqual(refused);
  expect(await readOwnPost("post-nothing", first.key, file, noon)).toEqual(refused);
});

test("the fingerprint that anyone can read in the file does not open the post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const fingerprint = (await rawPosts(file))[0].manageKeyHash;
  const refused = { ok: false, reason: "not-allowed" };
  expect(await readOwnPost(id, fingerprint, file, noon)).toEqual(refused);
  expect(await updateOwnPostStatus(id, fingerprint, "done", file, noon)).toEqual(refused);
});

test("a post from before private links has no fingerprint, so no key opens it and it stays as it was", async () => {
  const file = join(await makeFolder(), "posts.json");
  const text = JSON.stringify({ version: 1, posts: [oldEntry("post-old")] });
  await writeFile(file, text, "utf8");
  const key = createManageKey();
  const refused = { ok: false, reason: "not-allowed" };
  expect(await readOwnPost("post-old", key, file, noon)).toEqual(refused);
  expect(await updateOwnPostStatus("post-old", key, "done", file, noon)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(text);
  expect((await readPosts(file, noon)).length).toBe(1);
});

test("changing the status changes that post and nothing else", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const middle = await save(file, "The second post here");
  await save(file, "The third post here");
  const before = await rawPosts(file);
  const changed = await updateOwnPostStatus(middle.id, middle.key, "done", file, noon);
  expect(changed.ok).toBe(true);
  if (changed.ok) expect(changed.post.status).toBe("done");
  const after = await rawPosts(file);
  expect(after.length).toBe(3);
  expect(after[0]).toEqual(before[0]);
  expect(after[2]).toEqual(before[2]);
  expect(after[1]).toEqual({ ...before[1], status: "done" });
});

test("a field that a later version added is kept when the status changes", async () => {
  const file = join(await makeFolder(), "posts.json");
  const key = createManageKey();
  const entry = {
    ...oldEntry("post-new"),
    manageKeyHash: hashManageKey(key),
    note: "added later",
  };
  await writeFile(file, JSON.stringify({ version: 1, posts: [entry] }), "utf8");
  await updateOwnPostStatus("post-new", key, "in-progress", file, noon);
  expect((await rawPosts(file))[0]).toEqual({ ...entry, status: "in-progress" });
});

test("the status can go round: open, in progress, done, open", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  for (const status of ["in-progress", "done", "open"] as const) {
    await updateOwnPostStatus(id, key, status, file, noon);
    expect((await readPosts(file, noon))[0].status).toBe(status);
  }
});

test("the same status again changes nothing, and a wrong key changes nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const text = await readFile(file, "utf8");
  expect((await updateOwnPostStatus(id, key, "open", file, noon)).ok).toBe(true);
  expect(await readFile(file, "utf8")).toBe(text);
  const refused = await updateOwnPostStatus(id, createManageKey(), "done", file, noon);
  expect(refused).toEqual({ ok: false, reason: "not-allowed" });
  expect(await readFile(file, "utf8")).toBe(text);
});

test("a status that does not exist is refused and the file stays as it was", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const text = await readFile(file, "utf8");
  await expect(updateOwnPostStatus(id, key, "waiting" as never, file, noon)).rejects.toThrow(
    "status that does not exist",
  );
  expect(await readFile(file, "utf8")).toBe(text);
});

test("changes made at the same moment do not overwrite each other", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await Promise.all([
    updateOwnPostStatus(first.id, first.key, "done", file, noon),
    addPost({ ...sofa, title: "A third post here" }, file, noon),
    addPost({ ...sofa, title: "A fourth post here" }, file, noon),
    updateOwnPostStatus(second.id, second.key, "in-progress", file, noon),
    addPost({ ...sofa, title: "A fifth post here" }, file, noon),
  ]);
  const posts = await rawPosts(file);
  expect(posts.length).toBe(5);
  expect(posts.find((post: { id: string }) => post.id === first.id).status).toBe("done");
  expect(posts.find((post: { id: string }) => post.id === second.id).status).toBe("in-progress");
});

test("a damaged file is reported and never replaced, and the next change still works", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const good = await readFile(file, "utf8");
  await writeFile(file, "{ not json", "utf8");
  await expect(updateOwnPostStatus(id, key, "done", file, noon)).rejects.toThrow(
    "Nothing was changed",
  );
  expect(await readFile(file, "utf8")).toBe("{ not json");
  await writeFile(file, good, "utf8");
  expect((await updateOwnPostStatus(id, key, "done", file, noon)).ok).toBe(true);
});

test("no temporary file is left behind", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const { id, key } = await save(file);
  await updateOwnPostStatus(id, key, "done", file, noon);
  expect(await readdir(folder)).toEqual(["posts.json"]);
});

test("the fingerprint in the file is checked", () => {
  const key = createManageKey();
  function parse(manageKeyHash: unknown) {
    const entry = { ...oldEntry("post-1"), manageKeyHash };
    return parseStoredPosts(JSON.stringify({ version: 1, posts: [entry] }));
  }
  expect(parse(hashManageKey(key)).length).toBe(1);
  for (const wrong of [5, "", "short", hashManageKey(key).toUpperCase(), "g".repeat(64), null]) {
    expect(() => parse(wrong)).toThrow("Post number 1");
  }
  const withNone = JSON.stringify({ version: 1, posts: [oldEntry("post-1")] });
  expect(parseStoredPosts(withNone).length).toBe(1);
});
