import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import {
  addPost,
  addReply,
  addReport,
  parseStoredPosts,
} from "@/lib/post-store";
import { parsePosts, run, serialize } from "@/scripts/moderate.mjs";
import { useTempFolders } from "./support/temp-folders";

// The replies are for the author of a post. The tool of the person who runs the
// site must understand a file that has them exactly as the store does, must not
// print them, and must keep them when it takes a post down.

const makeFolder = useTempFolders("moderate-replies-");

const sofa = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
} as const;

const noon = new Date(2026, 9, 25, 12, 0, 0);
const earlier = new Date(Date.UTC(2026, 9, 26, 9, 30, 0));
const taken = new Date(Date.UTC(2026, 9, 31, 11, 55, 7));
const backupName = "posts.json.before-take-down-20261031-115507";

async function projectFolder() {
  const folder = await makeFolder();
  return { folder, file: join(folder, "data", "posts.json") };
}

// Runs the tool in the folder with a fixed clock and gives back what it printed.
async function tool(folder: string, args: string[]) {
  const lines: string[] = [];
  const code = await run(args, {
    out: (line) => {
      lines.push(line);
    },
    now: () => taken,
    cwd: folder,
  });
  return { code, text: lines.join("\n") };
}

function validEntry(id: string, more: Record<string, unknown> = {}) {
  return {
    id,
    kind: "help",
    title: "An older post here",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...more,
  };
}

function fileWith(entries: unknown[]): string {
  return JSON.stringify({ version: 1, posts: entries }, null, 2) + "\n";
}

async function writeRaw(file: string, text: string) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

// A post with two replies and one report, written by the store itself.
async function postWithReplies(file: string) {
  const result = await addPost(sofa, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  const id = result.post.id;
  await addReport(id, "spam", file, earlier);
  await addReply(id, { message: "A message that is only for the author.", name: "Maria", contact: "0123 456 789" }, file, earlier);
  await addReply(id, { message: "A second private message." }, file, earlier);
  return id;
}

test("the tool understands exactly the files that the store understands, also with replies", () => {
  const reply = { message: "Hello there.", at: earlier.toISOString() };
  const texts = [
    fileWith([validEntry("post-a", { replies: [] })]),
    fileWith([validEntry("post-a", { replies: [reply] })]),
    fileWith([validEntry("post-a", { replies: [{ ...reply, name: "Maria", contact: "0123" }] })]),
    fileWith([validEntry("post-a", { replies: [reply], reports: [{ reason: "spam", at: earlier.toISOString() }] })]),
    fileWith([validEntry("post-a", { replies: "many" })]),
    fileWith([validEntry("post-a", { replies: {} })]),
    fileWith([validEntry("post-a", { replies: [null] })]),
    fileWith([validEntry("post-a", { replies: ["Hello there."] })]),
    fileWith([validEntry("post-a", { replies: [{ ...reply, message: 5 }] })]),
    fileWith([validEntry("post-a", { replies: [{ at: earlier.toISOString() }] })]),
    fileWith([validEntry("post-a", { replies: [{ ...reply, name: 5 }] })]),
    fileWith([validEntry("post-a", { replies: [{ ...reply, contact: ["0123"] }] })]),
    fileWith([validEntry("post-a", { replies: [{ ...reply, at: "soon" }] })]),
    fileWith([validEntry("post-a", { replies: [{ message: "Hello there." }] })]),
  ];
  let accepted = 0;
  for (const text of texts) {
    let storeAccepts = true;
    try {
      parseStoredPosts(text);
    } catch {
      storeAccepts = false;
    }
    expect(parsePosts(text).ok).toBe(storeAccepts);
    if (storeAccepts) accepted += 1;
  }
  expect(accepted).toBe(4);
});

test("serialize writes a file with replies exactly like the store does", async () => {
  const { file } = await projectFolder();
  await postWithReplies(file);
  const text = await readFile(file, "utf8");
  expect(serialize(JSON.parse(text).posts)).toBe(text);
});

test("list and show never print the words, the name or the contact of a reply", async () => {
  const { folder, file } = await projectFolder();
  const id = await postWithReplies(file);
  for (const args of [["list"], ["show", id], ["take-down", id]]) {
    const { code, text } = await tool(folder, args);
    expect(code).toBe(0);
    expect(text).not.toContain("only for the author");
    expect(text).not.toContain("Maria");
    expect(text).not.toContain("0123 456 789");
    expect(text).not.toContain("second private message");
  }
});

test("taking a post down keeps its replies exactly as they were, and the backup is the old file", async () => {
  const { folder, file } = await projectFolder();
  const id = await postWithReplies(file);
  const before = await readFile(file, "utf8");
  const entryBefore = JSON.parse(before).posts[0];
  const { code } = await tool(folder, ["take-down", id, "--yes"]);
  expect(code).toBe(0);
  const after = JSON.parse(await readFile(file, "utf8")).posts[0];
  expect(after.replies).toEqual(entryBefore.replies);
  expect(after.reports).toEqual(entryBefore.reports);
  expect(after).toEqual({ ...entryBefore, removedAt: taken.toISOString() });
  expect((await readdir(join(folder, "data"))).sort()).toEqual(["posts.json", backupName]);
  expect(await readFile(join(folder, "data", backupName), "utf8")).toBe(before);
});

test("a file with a reply in the wrong shape is never written, and no backup is made", async () => {
  const { folder, file } = await projectFolder();
  const text = fileWith([validEntry("post-a", { replies: [{ message: 5, at: earlier.toISOString() }] })]);
  await writeRaw(file, text);
  const { code, text: printed } = await tool(folder, ["take-down", "post-a", "--yes"]);
  expect(code).toBe(1);
  expect(printed).toContain("not in the right shape");
  expect(await readFile(file, "utf8")).toBe(text);
  expect(await readdir(join(folder, "data"))).toEqual(["posts.json"]);
});
