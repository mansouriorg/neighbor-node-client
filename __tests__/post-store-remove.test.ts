import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadBoardPosts, loadPost } from "@/lib/board-posts";
import { createManageKey, hashManageKey } from "@/lib/manage-key";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  removeOwnPost,
  savedPostsLimit,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("remove-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const later = new Date(2026, 9, 26, 9, 30, 0);
const refused = { ok: false, reason: "not-allowed" };

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string) {
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
    createdAt: "2026-01-01T10:00:00.000Z",
  };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

test("a post taken down is gone from what the pages read, and the others stay in their order", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const middle = await save(file, "The second post here");
  await save(file, "The third post here");
  const removed = await removeOwnPost(middle.id, middle.key, file, later);
  expect(removed.ok).toBe(true);
  if (removed.ok) expect(removed.post.id).toBe(middle.id);
  const shown = await readPosts(file, later);
  expect(shown.map((post) => post.title)).toEqual([
    "The third post here",
    "The first post here",
  ]);
});

test("the entry stays in the file with the time it was taken down, and nothing else changes", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const middle = await save(file, "The second post here");
  await save(file, "The third post here");
  const before = await rawPosts(file);
  await removeOwnPost(middle.id, middle.key, file, later);
  const after = await rawPosts(file);
  expect(after.length).toBe(3);
  expect(after[0]).toEqual(before[0]);
  expect(after[2]).toEqual(before[2]);
  expect(after[1]).toEqual({ ...before[1], removedAt: later.toISOString() });
  expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
});

test("after that the old key opens nothing, changes nothing and takes nothing down again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await removeOwnPost(id, key, file, later);
  const text = await readFile(file, "utf8");
  expect(await readOwnPost(id, key, file, later)).toEqual(refused);
  expect(await updateOwnPostStatus(id, key, "done", file, later)).toEqual(refused);
  expect(await removeOwnPost(id, key, file, later)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(text);
});

test("a wrong key, the key of another post, an unknown id and a fingerprint take nothing down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const text = await readFile(file, "utf8");
  const fingerprint = (await rawPosts(file))[0].manageKeyHash;
  expect(await removeOwnPost(first.id, createManageKey(), file, later)).toEqual(refused);
  expect(await removeOwnPost(first.id, second.key, file, later)).toEqual(refused);
  expect(await removeOwnPost("post-nothing", first.key, file, later)).toEqual(refused);
  expect(await removeOwnPost(first.id, fingerprint, file, later)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(text);
  expect((await readPosts(file, later)).length).toBe(2);
});

test("a post from before private links cannot be taken down, and the file stays as it was", async () => {
  const file = join(await makeFolder(), "posts.json");
  const text = JSON.stringify({ version: 1, posts: [oldEntry("post-old")] });
  await writeFile(file, text, "utf8");
  expect(await removeOwnPost("post-old", createManageKey(), file, later)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(text);
});

test("a field that a later version added is kept when a post is taken down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const key = createManageKey();
  const entry = {
    ...oldEntry("post-new"),
    manageKeyHash: hashManageKey(key),
    note: "added later",
  };
  await writeFile(file, JSON.stringify({ version: 1, posts: [entry] }), "utf8");
  await removeOwnPost("post-new", key, file, later);
  expect((await rawPosts(file))[0]).toEqual({ ...entry, removedAt: later.toISOString() });
});

test("taking down at the same moment as saves and changes loses nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await Promise.all([
    removeOwnPost(first.id, first.key, file, later),
    addPost({ ...sofa, title: "A third post here" }, file, noon),
    updateOwnPostStatus(second.id, second.key, "done", file, later),
    addPost({ ...sofa, title: "A fourth post here" }, file, noon),
  ]);
  const posts = await rawPosts(file);
  expect(posts.length).toBe(4);
  expect(posts.find((post: { id: string }) => post.id === first.id).removedAt).toBe(later.toISOString());
  expect(posts.find((post: { id: string }) => post.id === second.id).status).toBe("done");
  expect((await readPosts(file, later)).length).toBe(3);
});

test("the board and the page of a post no longer show a post that was taken down", async () => {
  const file = join(await makeFolder(), "posts.json");
  const gone = await save(file, "The first post here");
  const kept = await save(file, "The second post here");
  expect((await loadBoardPosts(file, later)).savedCount).toBe(2);
  expect((await loadPost(gone.id, file, later))?.title).toBe("The first post here");
  await removeOwnPost(gone.id, gone.key, file, later);
  const board = await loadBoardPosts(file, later);
  expect(board.savedCount).toBe(1);
  expect(board.posts.some((post) => post.id === gone.id)).toBe(false);
  expect(board.posts.some((post) => post.id === kept.id)).toBe(true);
  expect(await loadPost(gone.id, file, later)).toBeUndefined();
  expect((await loadPost(kept.id, file, later))?.title).toBe("The second post here");
});

test("a post that was taken down still counts toward the limit of saved posts", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const entries = await rawPosts(file);
  for (let number = 1; number < savedPostsLimit; number += 1) {
    entries.push({ ...oldEntry(`post-filler-${number}`) });
  }
  await writeFile(file, JSON.stringify({ version: 1, posts: entries }), "utf8");
  expect(await addPost(sofa, file, noon)).toEqual({ ok: false, reason: "full" });
  await removeOwnPost(id, key, file, later);
  expect(await addPost(sofa, file, noon)).toEqual({ ok: false, reason: "full" });
  expect((await rawPosts(file)).length).toBe(savedPostsLimit);
});

test("a damaged file is reported and never replaced, and the next try still works", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const good = await readFile(file, "utf8");
  await writeFile(file, "{ not json", "utf8");
  await expect(removeOwnPost(id, key, file, later)).rejects.toThrow("Nothing was changed");
  expect(await readFile(file, "utf8")).toBe("{ not json");
  await writeFile(file, good, "utf8");
  expect((await removeOwnPost(id, key, file, later)).ok).toBe(true);
});

test("no temporary file is left behind", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const { id, key } = await save(file, "The first post here");
  await removeOwnPost(id, key, file, later);
  expect(await readdir(folder)).toEqual(["posts.json"]);
});

test("the time of the take-down in the file is checked", () => {
  function parse(removedAt: unknown) {
    const entry = { ...oldEntry("post-1"), removedAt };
    return parseStoredPosts(JSON.stringify({ version: 1, posts: [entry] }));
  }
  expect(parse("2026-10-26T09:30:00.000Z").length).toBe(1);
  for (const wrong of [5, "", "not a date", null, true]) {
    expect(() => parse(wrong)).toThrow("Post number 1");
  }
  const withNone = JSON.stringify({ version: 1, posts: [oldEntry("post-1")] });
  expect(parseStoredPosts(withNone).length).toBe(1);
});
