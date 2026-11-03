import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey } from "@/lib/manage-key";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReport,
  readOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import type { ReportReason } from "@/lib/report-reasons";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("own-reports-");

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

async function reportMany(file: string, id: string, reasons: ReportReason[]) {
  for (const reason of reasons) await addReport(id, reason, file, noon);
}

// What the author gets to know about the reports of the post.
async function reportsOf(file: string, id: string, key: string) {
  const found = await readOwnPost(id, key, file, noon);
  if (found.ok === false) throw new Error("The test post could not be read.");
  return found.reports;
}

test("a post that nobody reported has zero reports", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect(await reportsOf(file, id, key)).toEqual({ total: 0, byReason: [] });
});

test("the author learns how many reports there are and for which reasons", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await reportMany(file, id, ["other", "spam", "spam"]);
  expect(await reportsOf(file, id, key)).toEqual({
    total: 3,
    byReason: [
      { reason: "spam", count: 2 },
      { reason: "other", count: 1 },
    ],
  });
});

test("only the reports of that post are counted", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await reportMany(file, second.id, ["scam", "scam", "unsafe"]);
  expect((await reportsOf(file, first.id, first.key)).total).toBe(0);
  expect((await reportsOf(file, second.id, second.key)).total).toBe(3);
});

test("a report that comes later shows at the next read", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await reportMany(file, id, ["spam"]);
  expect((await reportsOf(file, id, key)).total).toBe(1);
  await reportMany(file, id, ["private"]);
  expect((await reportsOf(file, id, key)).total).toBe(2);
});

test("a change of status answers with the same counts, also when the status stays", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await reportMany(file, id, ["spam", "scam"]);
  const changed = await updateOwnPostStatus(id, key, "done", file, noon);
  const same = await updateOwnPostStatus(id, key, "done", file, noon);
  for (const answer of [changed, same]) {
    if (answer.ok === false) throw new Error("The change was refused.");
    expect(answer.post.status).toBe("done");
    expect(answer.reports).toEqual({
      total: 2,
      byReason: [
        { reason: "spam", count: 1 },
        { reason: "scam", count: 1 },
      ],
    });
  }
});

test("the answer holds the counts only: no time, no fingerprint, no key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await reportMany(file, id, ["spam"]);
  const found = await readOwnPost(id, key, file, noon);
  if (found.ok === false) throw new Error("The test post could not be read.");
  expect(Object.keys(found.reports).sort()).toEqual(["byReason", "total"]);
  expect(Object.keys(found.reports.byReason[0]).sort()).toEqual(["count", "reason"]);
  const text = JSON.stringify(found);
  expect(text.includes("2026")).toBe(false);
  expect(text.includes("manageKeyHash")).toBe(false);
  expect(text.includes(key)).toBe(false);
});

test("a wrong key gets no counts", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  await reportMany(file, id, ["spam"]);
  const refused = await readOwnPost(id, createManageKey(), file, noon);
  expect(refused).toEqual({ ok: false, reason: "not-allowed" });
});

test("the key of another post gets no counts either", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await reportMany(file, second.id, ["spam"]);
  const refused = await readOwnPost(second.id, first.key, file, noon);
  expect(refused).toEqual({ ok: false, reason: "not-allowed" });
});

test("reading the counts writes nothing to the file", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await reportMany(file, id, ["spam", "other"]);
  const text = await readFile(file, "utf8");
  const before = await stat(file);
  // Saving a file always makes a new one, so a save would show here, also when
  // the text stays the same.
  await new Promise((resolve) => setTimeout(resolve, 20));
  await reportsOf(file, id, key);
  await reportsOf(file, id, key);
  const after = await stat(file);
  expect(await readFile(file, "utf8")).toBe(text);
  expect(after.ino).toBe(before.ino);
  expect(after.mtimeMs).toBe(before.mtimeMs);
});
