import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { addPost, parseStoredPosts, updateOwnPost } from "@/lib/post-store";
import { parsePosts, run, serialize } from "@/scripts/moderate.mjs";
import { useTempFolders } from "./support/temp-folders";

// An author can edit a post, and the post then has a field editedAt. The tool of
// the person who runs the site must understand a file that has it exactly as
// the store does, and must keep it when it takes a post down.

const makeFolder = useTempFolders("moderate-edited-");

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

// A post that was edited, written by the store itself.
async function editedPost(file: string) {
  const result = await addPost(sofa, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  const edit = { title: "Help moving a sofa and a table", details: sofa.details, area: sofa.area };
  await updateOwnPost(result.post.id, result.manageKey, edit, file, earlier);
  return result.post.id;
}

test("the tool understands exactly the files that the store understands, also with editedAt", () => {
  const good = "2026-10-26T09:30:00.000Z";
  const texts = [
    fileWith([validEntry("post-a", { editedAt: good })]),
    fileWith([validEntry("post-a", { editedAt: good, removedAt: good })]),
    fileWith([validEntry("post-a")]),
    fileWith([validEntry("post-a", { editedAt: "soon" })]),
    fileWith([validEntry("post-a", { editedAt: 5 })]),
    fileWith([validEntry("post-a", { editedAt: null })]),
    fileWith([validEntry("post-a", { editedAt: {} })]),
    fileWith([validEntry("post-a", { editedAt: [good] })]),
    fileWith([validEntry("post-a", { editedAt: true })]),
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
  expect(accepted).toBe(3);
});

test("serialize writes a file with an edited post exactly like the store does", async () => {
  const { file } = await projectFolder();
  await editedPost(file);
  const text = await readFile(file, "utf8");
  expect(serialize(JSON.parse(text).posts)).toBe(text);
});

test("list and show work on a file with an edited post", async () => {
  const { folder, file } = await projectFolder();
  const id = await editedPost(file);
  const listed = await tool(folder, ["list"]);
  expect(listed.code).toBe(0);
  const shown = await tool(folder, ["show", id]);
  expect(shown.code).toBe(0);
  expect(shown.text).toContain("Help moving a sofa and a table");
});

test("taking an edited post down keeps editedAt exactly as it was, and the backup is the old file", async () => {
  const { folder, file } = await projectFolder();
  const id = await editedPost(file);
  const before = await readFile(file, "utf8");
  const entryBefore = JSON.parse(before).posts[0];
  expect(entryBefore.editedAt).toBe(earlier.toISOString());
  const { code } = await tool(folder, ["take-down", id, "--yes"]);
  expect(code).toBe(0);
  const after = JSON.parse(await readFile(file, "utf8")).posts[0];
  expect(after.editedAt).toBe(entryBefore.editedAt);
  expect(after).toEqual({ ...entryBefore, removedAt: taken.toISOString() });
  expect((await readdir(join(folder, "data"))).sort()).toEqual(["posts.json", backupName]);
  expect(await readFile(join(folder, "data", backupName), "utf8")).toBe(before);
});

test("a file with an editedAt in the wrong shape is never written, and no backup is made", async () => {
  const { folder, file } = await projectFolder();
  const text = fileWith([validEntry("post-a", { editedAt: "soon" })]);
  await writeRaw(file, text);
  const { code, text: printed } = await tool(folder, ["take-down", "post-a", "--yes"]);
  expect(code).toBe(1);
  expect(printed).toContain("not in the right shape");
  expect(await readFile(file, "utf8")).toBe(text);
  expect(await readdir(join(folder, "data"))).toEqual(["posts.json"]);
});
