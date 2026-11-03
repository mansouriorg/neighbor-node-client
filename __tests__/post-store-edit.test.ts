import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { EditPostFields } from "@/lib/edit-post";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReply,
  addReport,
  editedLabelFor,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  removeOwnPost,
  updateOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("edit-store-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const changed: EditPostFields = {
  title: "Help moving a sofa and a table",
  details: "Saturday afternoon now, three people, about two hours.",
  area: "Olive Street and Fig Lane",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const nextDay = new Date(2026, 9, 26, 9, 30, 0);
const later = new Date(2026, 9, 28, 18, 0, 0);
const wrongKey = "f".repeat(64);

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string, at: Date = noon) {
  const result = await addPost({ ...sofa, title }, file, at);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
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
    // Five days before the day of these tests: the 30-day rule would hide a post older than that.
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

function fileWith(entries: unknown[]): string {
  return JSON.stringify({ version: 1, posts: entries });
}

test("an edit changes the three texts of that post only, and marks the post as edited", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const before = await rawPosts(file);
  const result = await updateOwnPost(second.id, second.key, changed, file, nextDay);
  expect(result.ok).toBe(true);
  const after = await rawPosts(file);
  expect(after.length).toBe(2);
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).toEqual({ ...before[1], ...changed, editedAt: nextDay.toISOString() });
  expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
});

test("the answer is the post as everyone will see it, with the label, and the counts of its reports", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReport(id, "spam", file, nextDay);
  const result = await updateOwnPost(id, key, changed, file, nextDay);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.post).toEqual({
      id,
      kind: "help",
      ...changed,
      status: "open",
      postedLabel: "Yesterday",
      editedLabel: "Edited today",
      keep: { state: "shown", daysLeft: 30 },
    });
    expect(result.reports.total).toBe(1);
  }
});

test("the id, the kind, the status, the date, the fingerprint, the reports and the replies are kept", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReport(id, "scam", file, nextDay);
  await addReply(id, { message: "I can help on Saturday.", name: "Maria" }, file, nextDay);
  await updateOwnPostStatus(id, key, "in-progress", file, nextDay);
  const before = (await rawPosts(file))[0];
  await updateOwnPost(id, key, changed, file, later);
  const after = (await rawPosts(file))[0];
  for (const name of ["id", "kind", "status", "createdAt", "manageKeyHash", "reports", "replies"]) {
    expect(after[name]).toEqual(before[name]);
  }
  expect(after.status).toBe("in-progress");
  expect(typeof after.manageKeyHash).toBe("string");
  expect(after.removedAt).toBeUndefined();
});

test("the key still opens the post after an edit, and shows the new texts", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, changed, file, nextDay);
  const own = await readOwnPost(id, key, file, nextDay);
  expect(own.ok).toBe(true);
  if (own.ok) {
    expect(own.post.title).toBe(changed.title);
    expect(own.post.details).toBe(changed.details);
    expect(own.post.area).toBe(changed.area);
  }
});

test("only the posts that were edited have the label when the board is read", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  await save(file, "The second post here", nextDay);
  await updateOwnPost(first.id, first.key, changed, file, nextDay);
  const posts = await readPosts(file, nextDay);
  const withLabel = posts.find((post) => post.id === first.id);
  const without = posts.find((post) => (post.id === first.id) === false);
  expect(withLabel?.editedLabel).toBe("Edited today");
  expect(without).toBeDefined();
  expect("editedLabel" in (without ?? {})).toBe(false);
});

test("the label is worked out when the post is read, so it is true on the day", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, changed, file, nextDay);
  const table: [Date, string][] = [
    [new Date(2026, 9, 26, 23, 0, 0), "Edited today"],
    [new Date(2026, 9, 27, 12, 0, 0), "Edited yesterday"],
    [new Date(2026, 9, 29, 12, 0, 0), "Edited 3 days ago"],
    [new Date(2026, 10, 4, 12, 0, 0), "Edited last week"],
    [new Date(2026, 10, 16, 12, 0, 0), "Edited 3 weeks ago"],
    [new Date(2027, 0, 4, 12, 0, 0), "Edited a while ago"],
  ];
  for (const [now, label] of table) {
    // Days later the post is hidden from the board, so it is read the way the private page reads it.
    const posts = await readPosts(file, now, { includeHidden: true });
    expect(posts[0].editedLabel).toBe(label);
  }
});

test("editedLabelFor says the same as the posted label, in small letters after Edited", () => {
  const at = nextDay.toISOString();
  expect(editedLabelFor(at, nextDay)).toBe("Edited today");
  expect(editedLabelFor(at, new Date(2026, 9, 27, 12, 0, 0))).toBe("Edited yesterday");
  expect(editedLabelFor(at, new Date(2026, 9, 31, 12, 0, 0))).toBe("Edited 5 days ago");
  expect(editedLabelFor(at, new Date(2027, 5, 1, 12, 0, 0))).toBe("Edited a while ago");
});

test("the same texts again write nothing and do not mark the post as edited", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const before = await readFile(file, "utf8");
  const same = { title: "The first post here", details: sofa.details, area: sofa.area };
  const result = await updateOwnPost(id, key, same, file, nextDay);
  expect(result.ok).toBe(true);
  if (result.ok) expect("editedLabel" in result.post).toBe(false);
  expect(await readFile(file, "utf8")).toBe(before);
  const padded = { title: "  The first post here ", details: ` ${sofa.details}\n`, area: `${sofa.area}  ` };
  expect((await updateOwnPost(id, key, padded, file, later)).ok).toBe(true);
  expect(await readFile(file, "utf8")).toBe(before);
  expect((await rawPosts(file))[0].editedAt).toBeUndefined();
});

test("a change of one text alone is an edit", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, { title: "The first post here", details: sofa.details, area: "Fig Lane" }, file, nextDay);
  const saved = (await rawPosts(file))[0];
  expect(saved.area).toBe("Fig Lane");
  expect(saved.title).toBe("The first post here");
  expect(saved.editedAt).toBe(nextDay.toISOString());
});

test("the texts are saved clean, without the spaces around them", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const padded = { title: `  ${changed.title}  `, details: `\n${changed.details} `, area: ` ${changed.area}` };
  await updateOwnPost(id, key, padded, file, nextDay);
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(changed.title);
  expect(saved.details).toBe(changed.details);
  expect(saved.area).toBe(changed.area);
});

test("a second edit later moves the time and keeps the newest texts", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, changed, file, nextDay);
  const newest = { ...changed, title: "The sofa is gone, a table is left" };
  await updateOwnPost(id, key, newest, file, later);
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(newest.title);
  expect(saved.editedAt).toBe(later.toISOString());
  expect(saved.createdAt).toBe(noon.toISOString());
});

test("a wrong key, an unknown post, an old post and a post that was taken down get 'not-allowed', and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const gone = await save(file, "The second post here");
  await removeOwnPost(gone.id, gone.key, file, nextDay);
  const withOld = JSON.parse(await readFile(file, "utf8"));
  withOld.posts.push(oldEntry("post-old"));
  await writeFile(file, JSON.stringify(withOld), "utf8");
  const before = await readFile(file, "utf8");
  const notAllowed = { ok: false, reason: "not-allowed" };
  expect(await updateOwnPost(first.id, wrongKey, changed, file, later)).toEqual(notAllowed);
  expect(await updateOwnPost(first.id, first.key.toUpperCase(), changed, file, later)).toEqual(notAllowed);
  expect(await updateOwnPost("post-nothing", first.key, changed, file, later)).toEqual(notAllowed);
  expect(await updateOwnPost("post-old", first.key, changed, file, later)).toEqual(notAllowed);
  expect(await updateOwnPost("post-old", wrongKey, changed, file, later)).toEqual(notAllowed);
  expect(await updateOwnPost(gone.id, gone.key, changed, file, later)).toEqual(notAllowed);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("the key of one post does not open another post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const before = await readFile(file, "utf8");
  expect(await updateOwnPost(second.id, first.key, changed, file, later)).toEqual({ ok: false, reason: "not-allowed" });
  expect(await readFile(file, "utf8")).toBe(before);
});

test("texts that fail the check are refused with an error, also with a wrong key, and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const before = await readFile(file, "utf8");
  await expect(updateOwnPost(id, key, { ...changed, title: "Hi" }, file, later)).rejects.toThrow("validateEditedPost");
  await expect(updateOwnPost(id, key, { ...changed, area: "Olive Street 12" }, file, later)).rejects.toThrow("validateEditedPost");
  await expect(updateOwnPost(id, wrongKey, { ...changed, details: "" }, file, later)).rejects.toThrow("validateEditedPost");
  expect(await readFile(file, "utf8")).toBe(before);
});

test("a post that is done can be edited, and it stays done with its replies", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReply(id, { message: "I can help on Saturday." }, file, nextDay);
  await updateOwnPostStatus(id, key, "done", file, nextDay);
  const result = await updateOwnPost(id, key, changed, file, later);
  expect(result.ok).toBe(true);
  const saved = (await rawPosts(file))[0];
  expect(saved.status).toBe("done");
  expect(saved.replies.length).toBe(1);
  expect(saved.title).toBe(changed.title);
});

test("a status change after an edit keeps the edit, and an edit after a status change keeps the status", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, changed, file, nextDay);
  await updateOwnPostStatus(id, key, "done", file, later);
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(changed.title);
  expect(saved.editedAt).toBe(nextDay.toISOString());
  expect(saved.status).toBe("done");
});

test("the place of the post on the board does not change when it is edited", async () => {
  const file = join(await makeFolder(), "posts.json");
  const oldest = await save(file, "The oldest post here", noon);
  await save(file, "The middle post here", nextDay);
  await save(file, "The newest post here", later);
  const titles = async () => (await readPosts(file, later)).map((post) => post.title);
  expect(await titles()).toEqual(["The newest post here", "The middle post here", "The oldest post here"]);
  const idsInFile = async () => (await rawPosts(file)).map((entry: { id: string }) => entry.id);
  const before = await idsInFile();
  expect(before[0]).toBe(oldest.id);
  await updateOwnPost(oldest.id, oldest.key, changed, file, later);
  expect(await titles()).toEqual(["The newest post here", "The middle post here", changed.title]);
  expect(await idsInFile()).toEqual(before);
});

test("edits and replies sent at the same moment are all kept", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  const titles = Array.from({ length: 8 }, (_, index) => `A new title number ${index + 1}`);
  const answers = await Promise.all([
    ...titles.map((title) => updateOwnPost(id, key, { ...changed, title }, file, later)),
    ...Array.from({ length: 5 }, (_, index) => addReply(id, { message: `Reply number ${index + 1}.` }, file, later)),
  ]);
  expect(answers.every((answer) => answer.ok)).toBe(true);
  const saved = (await rawPosts(file))[0];
  expect(saved.replies.length).toBe(5);
  expect(titles).toContain(saved.title);
  expect(saved.editedAt).toBe(later.toISOString());
  expect(parseStoredPosts(await readFile(file, "utf8")).length).toBe(1);
});

test("the file with an edited post is read again by the store", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await updateOwnPost(id, key, changed, file, nextDay);
  const stored = parseStoredPosts(await readFile(file, "utf8"));
  expect(stored.length).toBe(1);
  expect(stored[0].editedAt).toBe(nextDay.toISOString());
});

test("a file where the time of an edit is not a time is refused, and a good one is accepted", () => {
  const good = oldEntry("post-a");
  expect(parseStoredPosts(fileWith([{ ...good, editedAt: "2026-10-26T09:30:00.000Z" }])).length).toBe(1);
  expect(parseStoredPosts(fileWith([good])).length).toBe(1);
  for (const bad of ["soon", 5, null, {}, [], true]) {
    expect(() => parseStoredPosts(fileWith([{ ...good, editedAt: bad }]))).toThrow("not in the right shape");
  }
});
