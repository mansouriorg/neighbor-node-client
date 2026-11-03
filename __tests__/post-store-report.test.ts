import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReport,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  removeOwnPost,
  reportsKeptPerPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import type { ReportReason } from "@/lib/report-reasons";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("report-store-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const later = new Date(2026, 9, 26, 9, 30, 0);
const notFound = { ok: false, reason: "not-found" };

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

// A post as an older version wrote it: it has no fingerprint and no reports.
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

test("a report is added to that post only, as a reason and a time", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const before = await rawPosts(file);
  expect(await addReport(second.id, "scam", file, later)).toEqual({ ok: true, stored: true });
  const after = await rawPosts(file);
  expect(after.length).toBe(2);
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).toEqual({
    ...before[1],
    reports: [{ reason: "scam", at: later.toISOString() }],
  });
  expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);
});

test("reports pile up with the oldest first, and keep the reason they were given", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  await addReport(id, "spam", file, noon);
  await addReport(id, "private", file, later);
  await addReport(id, "other", file, later);
  const reports = (await rawPosts(file))[0].reports;
  expect(reports).toEqual([
    { reason: "spam", at: noon.toISOString() },
    { reason: "private", at: later.toISOString() },
    { reason: "other", at: later.toISOString() },
  ]);
});

test("a post keeps at most 20 reports, and the 21st is not saved and does not touch the file", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  expect(reportsKeptPerPost).toBe(20);
  for (let count = 0; count < 20; count += 1) {
    expect(await addReport(id, "spam", file, later)).toEqual({ ok: true, stored: true });
  }
  const full = await readFile(file, "utf8");
  expect(await addReport(id, "scam", file, later)).toEqual({ ok: true, stored: false });
  expect(await readFile(file, "utf8")).toBe(full);
  expect((await rawPosts(file))[0].reports.length).toBe(20);
});

test("an unknown post, a sample post and a post taken down are not found, and the file is not touched", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await save(file, "The second post here");
  const unchanged = await readFile(file, "utf8");
  expect(await addReport("post-nothing", "spam", file, later)).toEqual(notFound);
  expect(await addReport("sample-1", "spam", file, later)).toEqual(notFound);
  expect(await readFile(file, "utf8")).toBe(unchanged);
  await removeOwnPost(id, key, file, later);
  const afterRemoval = await readFile(file, "utf8");
  expect(await addReport(id, "spam", file, later)).toEqual(notFound);
  expect(await readFile(file, "utf8")).toBe(afterRemoval);
});

test("a file that is not there yet means no such post, and no file is made", async () => {
  const file = join(await makeFolder(), "posts.json");
  expect(await addReport("post-nothing", "spam", file, later)).toEqual(notFound);
  await expect(readFile(file, "utf8")).rejects.toThrow("ENOENT");
});

test("a reason that does not exist throws, and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const unchanged = await readFile(file, "utf8");
  await expect(addReport(id, "nonsense" as ReportReason, file, later)).rejects.toThrow(
    "reason that does not exist",
  );
  expect(await readFile(file, "utf8")).toBe(unchanged);
});

test("the reports themselves are never part of what the pages read", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReport(id, "scam", file, later);
  const expected = ["area", "details", "id", "kind", "postedLabel", "status", "title"];
  const shown = await readPosts(file, later);
  expect(shown.length).toBe(1);
  expect(Object.keys(shown[0]).sort()).toEqual(expected);
  const own = await readOwnPost(id, key, file, later);
  expect(own.ok).toBe(true);
  if (own.ok) expect(Object.keys(own.post).sort()).toEqual([...expected, "keep"].sort());
  expect(JSON.stringify(shown)).not.toContain("reports");
  // The author gets the counts, never the reports with their times.
  if (own.ok) {
    expect(JSON.stringify(own.post)).not.toContain("reports");
    expect(own.reports).toEqual({
      total: 1,
      byReason: [{ reason: "scam", count: 1 }],
    });
  }
});

test("changing the status and taking the post down keep its reports", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  await addReport(id, "unsafe", file, noon);
  await updateOwnPostStatus(id, key, "done", file, later);
  let entry = (await rawPosts(file))[0];
  expect(entry.status).toBe("done");
  expect(entry.reports).toEqual([{ reason: "unsafe", at: noon.toISOString() }]);
  await removeOwnPost(id, key, file, later);
  entry = (await rawPosts(file))[0];
  expect(entry.removedAt).toBe(later.toISOString());
  expect(entry.reports).toEqual([{ reason: "unsafe", at: noon.toISOString() }]);
});

test("a post saved before private links existed can be reported too", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, fileWith([oldEntry("post-old")]), "utf8");
  expect(await addReport("post-old", "other", file, later)).toEqual({ ok: true, stored: true });
  const entry = (await rawPosts(file))[0];
  expect(entry.manageKeyHash).toBe(undefined);
  expect(entry.reports).toEqual([{ reason: "other", at: later.toISOString() }]);
});

test("the reader accepts a file with no reports, an empty list and a list of reports", () => {
  const without = parseStoredPosts(fileWith([oldEntry("post-a")]));
  expect(without[0].reports).toBe(undefined);
  const empty = parseStoredPosts(fileWith([{ ...oldEntry("post-a"), reports: [] }]));
  expect(empty[0].reports).toEqual([]);
  const reports = [{ reason: "spam", at: noon.toISOString() }];
  const some = parseStoredPosts(fileWith([{ ...oldEntry("post-a"), reports }]));
  expect(some[0].reports).toEqual(reports);
});

test("a damaged reports field is refused like any damaged post", () => {
  const good = { reason: "spam", at: noon.toISOString() };
  const damaged: unknown[] = [
    "spam",
    {},
    [null],
    [{ reason: "spam" }],
    [{ at: noon.toISOString() }],
    [{ reason: "rude", at: noon.toISOString() }],
    [{ reason: "spam", at: "not a date" }],
    [{ reason: "spam", at: 5 }],
    [good, "x"],
  ];
  for (const reports of damaged) {
    expect(() =>
      parseStoredPosts(fileWith([{ ...oldEntry("post-a"), reports }])),
    ).toThrow("Post number 1 in the saved posts file is not in the right shape.");
  }
});

test("a file with a damaged report is never replaced", async () => {
  const file = join(await makeFolder(), "posts.json");
  const text = fileWith([
    { ...oldEntry("post-a"), reports: [{ reason: "rude", at: noon.toISOString() }] },
  ]);
  await writeFile(file, text, "utf8");
  await expect(addReport("post-a", "spam", file, later)).rejects.toThrow("Nothing was changed");
  expect(await readFile(file, "utf8")).toBe(text);
});

test("reports sent at the same moment are all saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const answers = await Promise.all(
    Array.from({ length: 12 }, () => addReport(id, "spam", file, later)),
  );
  expect(answers.filter((answer) => answer.ok && answer.stored).length).toBe(12);
  expect((await rawPosts(file))[0].reports.length).toBe(12);
});
