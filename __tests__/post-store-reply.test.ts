import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { repliesKeptPerPost } from "@/lib/new-reply";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReply,
  addReport,
  parseStoredPosts,
  readOwnPost,
  readOwnReplies,
  readPosts,
  removeOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("reply-store-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const nextDay = new Date(2026, 9, 26, 9, 30, 0);
const later = new Date(2026, 9, 28, 18, 0, 0);
const wrongKey = "f".repeat(64);

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

// A post as an older version wrote it: it has no fingerprint, no reports and no replies.
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

function fileWith(entries: unknown[]): string {
  return JSON.stringify({ version: 1, posts: entries });
}

test("a reply is added to that post only, with the words, the name, the contact and the time", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const before = await rawPosts(file);
  const reply = { message: "I can help on Saturday.", name: "Maria", contact: "maria@example.org" };
  expect(await addReply(second.id, reply, file, nextDay)).toEqual({ ok: true, stored: true });
  const after = await rawPosts(file);
  expect(after.length).toBe(2);
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).toEqual({ ...before[1], replies: [{ ...reply, at: nextDay.toISOString() }] });
  expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
});

test("a name or a contact that was not given is not written at all", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  await addReply(id, { message: "I have a ladder." }, file, nextDay);
  const saved = (await rawPosts(file))[0].replies[0];
  expect(saved).toEqual({ message: "I have a ladder.", at: nextDay.toISOString() });
  expect(Object.keys(saved)).toEqual(["message", "at"]);
});

test("replies pile up in the file with the oldest first", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  await addReply(id, { message: "The first reply." }, file, noon);
  await addReply(id, { message: "The second reply." }, file, nextDay);
  await addReply(id, { message: "The third reply." }, file, later);
  const saved = (await rawPosts(file))[0].replies.map((item: { message: string }) => item.message);
  expect(saved).toEqual(["The first reply.", "The second reply.", "The third reply."]);
});

test("the second check saves clean text, and a reply that fails it is refused and writes nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  await addReply(id, { message: "  Spaces around.  ", name: "  Maria  " }, file, nextDay);
  expect((await rawPosts(file))[0].replies[0].message).toBe("Spaces around.");
  expect((await rawPosts(file))[0].replies[0].name).toBe("Maria");
  const before = await readFile(file, "utf8");
  await expect(addReply(id, { message: "no" }, file, nextDay)).rejects.toThrow("validateNewReply");
  await expect(addReply(id, { message: "Fine words here.", name: "n".repeat(41) }, file, nextDay)).rejects.toThrow(
    "validateNewReply",
  );
  expect(await readFile(file, "utf8")).toBe(before);
});

test("a post with enough replies says so, and nothing more is saved or written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  for (let count = 0; count < repliesKeptPerPost; count += 1) {
    expect(await addReply(id, { message: `Reply number ${count + 1}.` }, file, nextDay)).toEqual({
      ok: true,
      stored: true,
    });
  }
  const before = await readFile(file, "utf8");
  expect(await addReply(id, { message: "One too many." }, file, later)).toEqual({ ok: true, stored: false });
  expect(await readFile(file, "utf8")).toBe(before);
  expect((await rawPosts(file))[0].replies.length).toBe(20);
});

test("an unknown post and a post that was taken down are not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const notFound = { ok: false, reason: "not-found" };
  expect(await addReply("post-nothing", { message: "Hello there." }, file, later)).toEqual(notFound);
  expect(await addReply("sample-1", { message: "Hello there." }, file, later)).toEqual(notFound);
  await removeOwnPost(id, key, file, nextDay);
  const before = await readFile(file, "utf8");
  expect(await addReply(id, { message: "Hello there." }, file, later)).toEqual(notFound);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("a post that is marked as done takes no replies, and takes them again when it is open again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPostStatus(id, key, "done", file, nextDay);
  const before = await readFile(file, "utf8");
  expect(await addReply(id, { message: "Too late maybe." }, file, later)).toEqual({ ok: false, reason: "closed" });
  expect(await readFile(file, "utf8")).toBe(before);
  await updateOwnPostStatus(id, key, "in-progress", file, nextDay);
  expect(await addReply(id, { message: "Still possible." }, file, later)).toEqual({ ok: true, stored: true });
  await updateOwnPostStatus(id, key, "open", file, nextDay);
  expect(await addReply(id, { message: "Of course." }, file, later)).toEqual({ ok: true, stored: true });
});

test("many replies sent at the same moment are all saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const answers = await Promise.all(
    Array.from({ length: 12 }, (_, index) => addReply(id, { message: `Reply number ${index + 1}.` }, file, nextDay)),
  );
  expect(answers.every((answer) => answer.ok && answer.stored)).toBe(true);
  const saved = (await rawPosts(file))[0].replies.map((item: { message: string }) => item.message);
  expect(saved.length).toBe(12);
  expect(new Set(saved).size).toBe(12);
});

test("a reply does not disturb the status, the reports or the key, and they do not disturb it", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReport(id, "spam", file, nextDay);
  await addReply(id, { message: "I can help on Saturday." }, file, nextDay);
  await updateOwnPostStatus(id, key, "in-progress", file, later);
  await addReport(id, "other", file, later);
  const entry = (await rawPosts(file))[0];
  expect(entry.status).toBe("in-progress");
  expect(entry.reports.length).toBe(2);
  expect(entry.replies.length).toBe(1);
  expect(typeof entry.manageKeyHash).toBe("string");
  const found = await readOwnPost(id, key, file, later);
  expect(found.ok).toBe(true);
});

test("a post that is taken down keeps its replies in the file, but nobody can read them in the app", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "I can help on Saturday." }, file, nextDay);
  await removeOwnPost(id, key, file, later);
  const entry = (await rawPosts(file))[0];
  expect(entry.replies.length).toBe(1);
  expect(typeof entry.removedAt).toBe("string");
  expect(await readOwnReplies(id, key, file, later)).toEqual({ ok: false, reason: "not-allowed" });
});

test("the board and the other reads never carry the replies", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "A secret-looking message.", name: "Maria", contact: "0123 456" }, file, nextDay);
  const board = await readPosts(file, later);
  expect(board.length).toBe(1);
  expect(Object.keys(board[0]).sort()).toEqual(
    ["area", "details", "id", "kind", "postedLabel", "status", "title"].sort(),
  );
  expect(JSON.stringify(board)).not.toContain("secret-looking");
  const own = await readOwnPost(id, key, file, later);
  expect(JSON.stringify(own)).not.toContain("secret-looking");
  expect(JSON.stringify(own)).not.toContain("0123 456");
});

test("the author reads the replies with the key, the newest first, with how long ago", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "The first reply.", name: "Maria", contact: "maria@example.org" }, file, noon);
  await addReply(id, { message: "The second reply." }, file, nextDay);
  await addReply(id, { message: "The third reply.", name: "Karim" }, file, later);
  const found = await readOwnReplies(id, key, file, later);
  expect(found).toEqual({
    ok: true,
    replies: [
      { message: "The third reply.", name: "Karim", when: "Today" },
      { message: "The second reply.", when: "2 days ago" },
      { message: "The first reply.", name: "Maria", contact: "maria@example.org", when: "3 days ago" },
    ],
  });
});

test("a reply carries only the words, the name, the contact and a time word, never the exact time", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "The first reply.", name: "Maria", contact: "0123" }, file, nextDay);
  await addReply(id, { message: "The second reply." }, file, nextDay);
  const found = await readOwnReplies(id, key, file, later);
  if (found.ok === false) throw new Error("The key should fit.");
  expect(found.replies.map((item) => Object.keys(item).sort())).toEqual([
    ["message", "when"],
    ["contact", "message", "name", "when"],
  ]);
  expect(JSON.stringify(found)).not.toContain(nextDay.toISOString());
});

test("replies of the same moment keep the order in which they came, the last one first", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "Came first." }, file, nextDay);
  await addReply(id, { message: "Came second." }, file, nextDay);
  const found = await readOwnReplies(id, key, file, later);
  if (found.ok === false) throw new Error("The key should fit.");
  expect(found.replies.map((item) => item.message)).toEqual(["Came second.", "Came first."]);
});

test("a post that nobody replied to gives an empty list", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  expect(await readOwnReplies(id, key, file, later)).toEqual({ ok: true, replies: [] });
});

test("a wrong key, an unknown post and an old post with no key all get the same answer, and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "I can help on Saturday." }, file, nextDay);
  const notAllowed = { ok: false, reason: "not-allowed" };
  const before = await readFile(file, "utf8");
  expect(await readOwnReplies(id, wrongKey, file, later)).toEqual(notAllowed);
  expect(await readOwnReplies("post-nothing", key, file, later)).toEqual(notAllowed);
  expect(await readOwnReplies(id, "", file, later)).toEqual(notAllowed);
  expect(await readFile(file, "utf8")).toBe(before);
  const old = join(await makeFolder(), "old.json");
  await writeFile(old, fileWith([{ ...oldEntry("post-old"), replies: [{ message: "Hello.", at: noon.toISOString() }] }]));
  expect(await readOwnReplies("post-old", key, old, later)).toEqual(notAllowed);
  expect(await readOwnReplies("post-old", "", old, later)).toEqual(notAllowed);
});

test("the key of another post does not open the replies of this one", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await addReply(first.id, { message: "For the first." }, file, nextDay);
  expect(await readOwnReplies(first.id, second.key, file, later)).toEqual({ ok: false, reason: "not-allowed" });
});

test("an older file with no replies still works, and the first reply adds the field to that post only", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, fileWith([oldEntry("post-a"), oldEntry("post-b")]));
  expect(parseStoredPosts(await readFile(file, "utf8")).length).toBe(2);
  expect(await addReply("post-b", { message: "Hello there." }, file, nextDay)).toEqual({ ok: true, stored: true });
  const after = await rawPosts(file);
  expect(after[0]).toEqual(oldEntry("post-a"));
  expect(after[1]).toEqual({ ...oldEntry("post-b"), replies: [{ message: "Hello there.", at: nextDay.toISOString() }] });
});

test("the file is understood with replies, and refused when a reply is in the wrong shape", () => {
  const reply = { message: "Hello there.", at: noon.toISOString() };
  expect(parseStoredPosts(fileWith([{ ...oldEntry("post-a"), replies: [] }])).length).toBe(1);
  expect(parseStoredPosts(fileWith([{ ...oldEntry("post-a"), replies: [reply] }])).length).toBe(1);
  expect(parseStoredPosts(fileWith([{ ...oldEntry("post-a"), replies: [{ ...reply, name: "Maria", contact: "0123" }] }])).length).toBe(1);
  const wrong: unknown[] = [
    "many",
    {},
    [null],
    ["Hello there."],
    [{ ...reply, message: 5 }],
    [{ at: noon.toISOString() }],
    [{ ...reply, name: 5 }],
    [{ ...reply, contact: ["0123"] }],
    [{ ...reply, at: "soon" }],
    [{ message: "Hello there." }],
  ];
  for (const replies of wrong) {
    expect(() => parseStoredPosts(fileWith([{ ...oldEntry("post-a"), replies }]))).toThrow("not in the right shape");
  }
});

test("a damaged file is never replaced when a reply comes", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ not json", "utf8");
  await expect(addReply("post-a", { message: "Hello there." }, file, nextDay)).rejects.toThrow("not valid JSON");
  expect(await readFile(file, "utf8")).toBe("{ not json");
  await expect(readOwnReplies("post-a", wrongKey, file, nextDay)).rejects.toThrow("not valid JSON");
});

test("a missing file means no post, so a reply is not found and no file is made", async () => {
  const folder = await makeFolder();
  const file = join(folder, "data", "posts.json");
  expect(await addReply("post-a", { message: "Hello there." }, file, nextDay)).toEqual({ ok: false, reason: "not-found" });
  await expect(readFile(file, "utf8")).rejects.toThrow("ENOENT");
});
