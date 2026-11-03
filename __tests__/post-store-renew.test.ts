import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { EditPostFields } from "@/lib/edit-post";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReply,
  addReport,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  removeOwnPost,
  renewOwnPost,
  updateOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("renew-store-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const day = 24 * 60 * 60 * 1000;
const noon = new Date(2026, 9, 25, 12, 0, 0);
const wrongKey = "f".repeat(64);

// The moment that is this many days after the post of the test was written.
function daysAfter(days: number, hours: number = 0): Date {
  return new Date(noon.getTime() + days * day + hours * 60 * 60 * 1000);
}

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string, at: Date = noon) {
  const result = await addPost({ ...sofa, title }, file, at);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawText(file: string) {
  return readFile(file, "utf8");
}

async function rawPosts(file: string) {
  return JSON.parse(await rawText(file)).posts;
}

// A post as an older version wrote it: it has no fingerprint, so no key fits it.
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

test("keeping up a post that is just written changes nothing: the file is not written, and the answer says 30 days", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const before = await rawText(file);
  const result = await renewOwnPost(id, key, file, daysAfter(0, 5));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect(await rawText(file)).toBe(before);
});

test("after a day, keeping the post up saves the time, and the 30 days start again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const seen = await readOwnPost(id, key, file, daysAfter(10));
  if (seen.ok) expect(seen.post.keep).toEqual({ state: "shown", daysLeft: 20 });
  const result = await renewOwnPost(id, key, file, daysAfter(10));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(10).toISOString());
  const again = await readOwnPost(id, key, file, daysAfter(15));
  if (again.ok) expect(again.post.keep).toEqual({ state: "shown", daysLeft: 25 });
});

test("the last day counts too: with one day left the post can still be kept up", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const result = await renewOwnPost(id, key, file, daysAfter(29, 5));
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(29, 5).toISOString());
});

test("a post that is older than 30 days is reported as hidden, and keeping it up makes it shown for 30 days", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const seen = await readOwnPost(id, key, file, daysAfter(45));
  expect(seen.ok).toBe(true);
  if (seen.ok) expect(seen.post.keep).toEqual({ state: "hidden" });
  const result = await renewOwnPost(id, key, file, daysAfter(45));
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(45).toISOString());
});

test("a post that is done is never hidden, and keeping it up writes nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPostStatus(id, key, "done", file, daysAfter(2));
  const before = await rawText(file);
  const result = await renewOwnPost(id, key, file, daysAfter(60));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "done" });
  expect(await rawText(file)).toBe(before);
});

test("a second press soon after the first writes nothing more", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await renewOwnPost(id, key, file, daysAfter(10));
  const before = await rawText(file);
  const result = await renewOwnPost(id, key, file, daysAfter(10, 6));
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect(await rawText(file)).toBe(before);
});

test("a wrong key, an unknown post, an old post without a fingerprint and a post that was taken down all get the same answer, and the file is not touched", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await removeOwnPost(second.id, second.key, file, daysAfter(1));
  const entries = await rawPosts(file);
  await writeFile(file, JSON.stringify({ version: 1, posts: [...entries, oldEntry("post-old")] }, null, 2) + "\n", "utf8");
  const before = await rawText(file);
  const refused = { ok: false, reason: "not-allowed" };
  expect(await renewOwnPost(first.id, wrongKey, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPost("post-nobody", first.key, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPost("post-old", first.key, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPost(second.id, second.key, file, daysAfter(40))).toEqual(refused);
  expect(await rawText(file)).toBe(before);
});

test("only the one post changes: the other posts, the order, the texts, the status, the reports and the replies stay as they are", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here", daysAfter(1));
  await addReport(first.id, "spam", file, daysAfter(2));
  await addReply(first.id, { message: "I can help on Saturday.", name: "Maria" }, file, daysAfter(2));
  await updateOwnPostStatus(first.id, first.key, "in-progress", file, daysAfter(3));
  const before = await rawPosts(file);
  await renewOwnPost(first.id, first.key, file, daysAfter(20));
  const after = await rawPosts(file);
  expect(after.map((post: { id: string }) => post.id)).toEqual([first.id, second.id]);
  expect(after[0]).toEqual({ ...before[0], renewedAt: daysAfter(20).toISOString() });
  expect(after[1]).toEqual(before[1]);
  expect(Object.keys(after[0])).toEqual([...Object.keys(before[0]), "renewedAt"]);
});

test("keeping a post up is not an edit: the label Edited does not appear", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const result = await renewOwnPost(id, key, file, daysAfter(10));
  if (result.ok) expect("editedLabel" in result.post).toBe(false);
  expect((await rawPosts(file))[0].editedAt).toBe(undefined);
  const shown = await readPosts(file, daysAfter(10));
  expect("editedLabel" in shown[0]).toBe(false);
});

test("every answer for the author says how long the post stays: reading, a new status and an edit", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const read = await readOwnPost(id, key, file, daysAfter(10));
  if (read.ok) expect(read.post.keep).toEqual({ state: "shown", daysLeft: 20 });
  const fields: EditPostFields = { title: "Help moving a sofa and a table", details: sofa.details, area: sofa.area };
  const edited = await updateOwnPost(id, key, fields, file, daysAfter(12));
  if (edited.ok) expect(edited.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  const changed = await updateOwnPostStatus(id, key, "done", file, daysAfter(13));
  if (changed.ok) expect(changed.post.keep).toEqual({ state: "done" });
});

test("an edit starts the 30 days again without writing renewedAt", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const fields: EditPostFields = { title: "Help moving a sofa and a table", details: sofa.details, area: sofa.area };
  await updateOwnPost(id, key, fields, file, daysAfter(20));
  const read = await readOwnPost(id, key, file, daysAfter(35));
  if (read.ok) expect(read.post.keep).toEqual({ state: "shown", daysLeft: 15 });
  expect((await rawPosts(file))[0].renewedAt).toBe(undefined);
});

test("what everyone reads has no keep field, and a saved post has none either", async () => {
  const file = join(await makeFolder(), "posts.json");
  const added = await addPost(sofa, file, noon);
  expect(added.ok).toBe(true);
  if (added.ok) expect("keep" in added.post).toBe(false);
  const shown = await readPosts(file, daysAfter(5));
  expect(shown.length).toBe(1);
  expect("keep" in shown[0]).toBe(false);
});

test("a time that is kept is read back by the other functions and kept by them", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await renewOwnPost(id, key, file, daysAfter(10));
  await updateOwnPostStatus(id, key, "in-progress", file, daysAfter(11));
  await addReport(id, "other", file, daysAfter(12));
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(10).toISOString());
});

test("keeping up two posts at the same moment loses neither", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await Promise.all([
    renewOwnPost(first.id, first.key, file, daysAfter(10)),
    renewOwnPost(second.id, second.key, file, daysAfter(10)),
  ]);
  const after = await rawPosts(file);
  expect(after[0].renewedAt).toBe(daysAfter(10).toISOString());
  expect(after[1].renewedAt).toBe(daysAfter(10).toISOString());
});

test("the file accepts a real date in renewedAt and refuses anything else", () => {
  const entry = {
    id: "post-a",
    kind: "help",
    title: "An older post here",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt: "2026-01-01T10:00:00.000Z",
  };
  function parse(renewedAt: unknown) {
    return parseStoredPosts(JSON.stringify({ version: 1, posts: [{ ...entry, renewedAt }] }));
  }
  expect(parse("2026-02-01T10:00:00.000Z")[0].renewedAt).toBe("2026-02-01T10:00:00.000Z");
  expect(parse(undefined)[0].renewedAt).toBe(undefined);
  for (const bad of ["soon", 5, null, {}, ["2026-02-01T10:00:00.000Z"], true]) {
    expect(() => parse(bad)).toThrow("not in the right shape");
  }
});
