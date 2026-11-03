import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { EditPostFields } from "@/lib/edit-post";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReply,
  addReport,
  readOwnPost,
  readOwnReplies,
  readPosts,
  removeOwnPost,
  renewOwnPost,
  savedPostsLimit,
  updateOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

// A post that nothing happened to for 30 days is hidden from the board (see
// lib/post-age.ts). These tests check what hiding does in the store: who still
// sees such a post, and who does not.
const makeFolder = useTempFolders("hidden-store-");

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

async function titlesOnTheBoard(file: string, now: Date): Promise<string[]> {
  const posts = await readPosts(file, now);
  return posts.map((post) => post.title);
}

const fields: EditPostFields = {
  title: "Help moving a sofa and a table",
  details: sofa.details,
  area: sofa.area,
};

// A post as an older version wrote it: it has no fingerprint, no edit time.
function oldEntry(id: string, createdAt: string) {
  return {
    id,
    kind: "help",
    title: "An older post here",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt,
  };
}

test("a post is on the board on day 29, and gone from it from day 30", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const lastMinute = new Date(daysAfter(30).getTime() - 60 * 1000);
  expect(await titlesOnTheBoard(file, daysAfter(0))).toEqual(["The first post here"]);
  expect(await titlesOnTheBoard(file, daysAfter(29, 23))).toEqual(["The first post here"]);
  expect(await titlesOnTheBoard(file, lastMinute)).toEqual(["The first post here"]);
  expect(await titlesOnTheBoard(file, daysAfter(30))).toEqual([]);
  expect(await titlesOnTheBoard(file, daysAfter(400))).toEqual([]);
});

test("hiding deletes nothing and writes nothing: the file is the same after reading", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const before = await rawText(file);
  expect(await readPosts(file, daysAfter(40))).toEqual([]);
  expect(await rawText(file)).toBe(before);
  const back = await readPosts(file, daysAfter(40), { includeHidden: true });
  expect(back.length).toBe(1);
  expect(await rawText(file)).toBe(before);
});

test("a post that is done is never hidden, however old it is", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPostStatus(id, key, "done", file, daysAfter(1));
  const posts = await readPosts(file, daysAfter(400));
  expect(posts.length).toBe(1);
  expect(posts[0].status).toBe("done");
});

test("without the option, no post carries keep, so the board and the post page are the same as before", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const posts = await readPosts(file, daysAfter(5));
  expect(posts[0].keep).toBe(undefined);
  const same = await readPosts(file, daysAfter(5), { includeHidden: false });
  expect(same[0].keep).toBe(undefined);
  expect(same).toEqual(posts);
});

test("with includeHidden, a hidden post comes back and says it is hidden, and a shown post says how long it stays", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const shown = await readPosts(file, daysAfter(10), { includeHidden: true });
  expect(shown[0].keep).toEqual({ state: "shown", daysLeft: 20 });
  const hidden = await readPosts(file, daysAfter(40), { includeHidden: true });
  expect(hidden.length).toBe(1);
  expect(hidden[0].title).toBe("The first post here");
  expect(hidden[0].keep).toEqual({ state: "hidden" });
});

test("a post that was taken down is left out, also with includeHidden", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  await save(file, "The second post here");
  await removeOwnPost(first.id, first.key, file, daysAfter(1));
  const all = await readPosts(file, daysAfter(2), { includeHidden: true });
  expect(all.map((post) => post.title)).toEqual(["The second post here"]);
  const later = await readPosts(file, daysAfter(60), { includeHidden: true });
  expect(later.map((post) => post.title)).toEqual(["The second post here"]);
});

test("an edit counts as news: the post stays 30 more days from the edit", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, fields, file, daysAfter(20));
  expect(await titlesOnTheBoard(file, daysAfter(40))).toEqual(["Help moving a sofa and a table"]);
  expect(await titlesOnTheBoard(file, daysAfter(50))).toEqual([]);
});

test("keeping the post up counts as news, too", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await renewOwnPost(id, key, file, daysAfter(25));
  expect(await titlesOnTheBoard(file, daysAfter(54))).toEqual(["The first post here"]);
  expect(await titlesOnTheBoard(file, daysAfter(55))).toEqual([]);
});

test("a status change alone is not news: an open post that becomes in progress is still hidden on day 30", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPostStatus(id, key, "in-progress", file, daysAfter(20));
  expect(await titlesOnTheBoard(file, daysAfter(31))).toEqual([]);
});

test("marking a hidden post as done puts it back on the board, as done", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  expect(await readPosts(file, daysAfter(40))).toEqual([]);
  const result = await updateOwnPostStatus(id, key, "done", file, daysAfter(40));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "done" });
  const posts = await readPosts(file, daysAfter(40));
  expect(posts.length).toBe(1);
  expect(posts[0].status).toBe("done");
});

test("changing a hidden post to in progress keeps it hidden, and the answer says so", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const result = await updateOwnPostStatus(id, key, "in-progress", file, daysAfter(40));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.post.status).toBe("in-progress");
    expect(result.post.keep).toEqual({ state: "hidden" });
  }
  expect(await readPosts(file, daysAfter(40))).toEqual([]);
});

test("opening an old post that was done again hides it at once", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPostStatus(id, key, "done", file, daysAfter(1));
  expect((await readPosts(file, daysAfter(40))).length).toBe(1);
  const result = await updateOwnPostStatus(id, key, "open", file, daysAfter(40));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "hidden" });
  expect(await readPosts(file, daysAfter(40))).toEqual([]);
});

test("the order of the board is the same without the hidden posts", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "Post written on day 0", daysAfter(0));
  await save(file, "Post written on day 20", daysAfter(20));
  await save(file, "Post written on day 29", daysAfter(29));
  expect(await titlesOnTheBoard(file, daysAfter(29, 1))).toEqual([
    "Post written on day 29",
    "Post written on day 20",
    "Post written on day 0",
  ]);
  expect(await titlesOnTheBoard(file, daysAfter(40))).toEqual([
    "Post written on day 29",
    "Post written on day 20",
  ]);
  expect(await titlesOnTheBoard(file, daysAfter(60))).toEqual([]);
});

test("a post from before private links is hidden by its date, and an old file is read as before", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entries = [oldEntry("post-new", "2026-10-20T10:00:00.000Z"), oldEntry("post-old", "2026-01-01T10:00:00.000Z")];
  await writeFile(file, JSON.stringify({ version: 1, posts: entries }), "utf8");
  const board = await readPosts(file, noon);
  expect(board.map((post) => post.id)).toEqual(["post-new"]);
  const all = await readPosts(file, noon, { includeHidden: true });
  expect(all.map((post) => post.id)).toEqual(["post-new", "post-old"]);
  expect(all[1].keep).toEqual({ state: "hidden" });
});

test("a hidden post takes no report: it is not found, and the file is not touched", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const before = await rawText(file);
  expect(await addReport(id, "spam", file, daysAfter(40))).toEqual({ ok: false, reason: "not-found" });
  expect(await rawText(file)).toBe(before);
});

test("a post on its last day can still be reported", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const result = await addReport(id, "spam", file, daysAfter(29, 20));
  expect(result).toEqual({ ok: true, stored: true });
});

test("a hidden post takes no reply: it is not found, and the file is not touched", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const before = await rawText(file);
  const result = await addReply(id, { message: "I can help on Saturday." }, file, daysAfter(40));
  expect(result).toEqual({ ok: false, reason: "not-found" });
  expect(await rawText(file)).toBe(before);
});

test("a post on its last day can still be replied to", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const result = await addReply(id, { message: "I can help on Saturday." }, file, daysAfter(29, 20));
  expect(result).toEqual({ ok: true, stored: true });
});

test("the author still reaches a hidden post with the key, and a wrong key still gets nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const own = await readOwnPost(id, key, file, daysAfter(40));
  expect(own.ok).toBe(true);
  if (own.ok) {
    expect(own.post.title).toBe("The first post here");
    expect(own.post.keep).toEqual({ state: "hidden" });
  }
  expect(await readOwnPost(id, wrongKey, file, daysAfter(40))).toEqual({ ok: false, reason: "not-allowed" });
});

test("the author still reads the replies of a hidden post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "I can help on Saturday." }, file, daysAfter(5));
  const replies = await readOwnReplies(id, key, file, daysAfter(40));
  expect(replies.ok).toBe(true);
  if (replies.ok) expect(replies.replies.map((reply) => reply.message)).toEqual(["I can help on Saturday."]);
});

test("the author can edit a hidden post, and that shows it again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  expect(await readPosts(file, daysAfter(40))).toEqual([]);
  const result = await updateOwnPost(id, key, fields, file, daysAfter(40));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect(await titlesOnTheBoard(file, daysAfter(40))).toEqual(["Help moving a sofa and a table"]);
});

test("the author can show a hidden post again, and it takes reports and replies again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const result = await renewOwnPost(id, key, file, daysAfter(40));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect(await titlesOnTheBoard(file, daysAfter(40))).toEqual(["The first post here"]);
  expect(await addReport(id, "spam", file, daysAfter(41))).toEqual({ ok: true, stored: true });
  expect(await addReply(id, { message: "I can help on Saturday." }, file, daysAfter(41))).toEqual({ ok: true, stored: true });
});

test("the author can take a hidden post down, and then nobody reaches it", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const result = await removeOwnPost(id, key, file, daysAfter(40));
  expect(result.ok).toBe(true);
  expect(await readPosts(file, daysAfter(40), { includeHidden: true })).toEqual([]);
  expect(await readOwnPost(id, key, file, daysAfter(40))).toEqual({ ok: false, reason: "not-allowed" });
});

test("hidden posts still count for the limit of saved posts, so hiding cannot be used to get round it", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entries = Array.from({ length: savedPostsLimit }, (_, index) =>
    oldEntry("post-" + index, "2026-01-01T10:00:00.000Z"),
  );
  const text = JSON.stringify({ version: 1, posts: entries });
  await writeFile(file, text, "utf8");
  expect(await readPosts(file, noon)).toEqual([]);
  expect(await addPost(sofa, file, noon)).toEqual({ ok: false, reason: "full" });
  expect(await rawText(file)).toBe(text);
});
