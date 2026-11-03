import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  defaultPostsFile,
  parseStoredPosts,
  postedLabelFor,
  readPosts,
  savedPostsLimit,
} from "@/lib/post-store";

// These tests write real files. They work in a folder inside node_modules,
// which git and the test watcher both ignore, and they remove it afterwards.
const testRoot = join(process.cwd(), "node_modules", ".cache", "post-store-tests");
const madeFolders: string[] = [];

async function makeFolder(): Promise<string> {
  await mkdir(testRoot, { recursive: true });
  const folder = await mkdtemp(join(testRoot, "run-"));
  madeFolders.push(folder);
  return folder;
}

afterEach(async () => {
  while (madeFolders.length > 0) {
    const folder = madeFolders.pop();
    // Only ever remove a folder that this test file made itself.
    if (typeof folder === "string" && folder.startsWith(testRoot + "/")) {
      await rm(folder, { recursive: true, force: true });
    }
  }
});

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : "not an Error";
  }
  return "no error";
}

function storedEntry(index: number) {
  return {
    id: `post-${index}`,
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    // Five days before the day of these tests: the 30-day rule would hide a post older than that.
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

test("the default file is data/posts.json inside the project", () => {
  expect(defaultPostsFile()).toBe(join(process.cwd(), "data", "posts.json"));
});

test("the data folder is not committed to git", () => {
  const lines = readFileSync(join(process.cwd(), ".gitignore"), "utf8")
    .split("\n")
    .map((line) => line.trim());
  expect(lines).toContain("/data/");
});

test("no file yet means no posts yet", async () => {
  const folder = await makeFolder();
  expect(await readPosts(join(folder, "posts.json"), noon)).toEqual([]);
});

test("a saved post can be read back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const result = await addPost(sofa, file, noon);
  expect(result.ok).toBe(true);
  const posts = await readPosts(file, noon);
  expect(posts.length).toBe(1);
  expect(posts[0].kind).toBe("help");
  expect(posts[0].title).toBe("Help moving a sofa");
  expect(posts[0].details).toBe(sofa.details);
  expect(posts[0].area).toBe("Olive Street");
  expect(posts[0].status).toBe("open");
  expect(posts[0].postedLabel).toBe("Today");
  expect(/^post-[0-9a-f-]{36}$/.test(posts[0].id)).toBe(true);
  if (result.ok) expect(result.post).toEqual(posts[0]);
});

test("the file holds a version, the date, and no label", async () => {
  const file = join(await makeFolder(), "posts.json");
  await addPost(sofa, file, noon);
  const data = JSON.parse(await readFile(file, "utf8"));
  expect(data.version).toBe(1);
  expect(data.posts.length).toBe(1);
  expect(data.posts[0].createdAt).toBe(noon.toISOString());
  expect(data.posts[0].postedLabel).toBeUndefined();
});

test("saves the cleaned text, without spaces at the ends", async () => {
  const file = join(await makeFolder(), "posts.json");
  await addPost(
    { ...sofa, title: "  Help moving a sofa  ", area: " Olive Street " },
    file,
    noon,
  );
  const posts = await readPosts(file, noon);
  expect(posts[0].title).toBe("Help moving a sofa");
  expect(posts[0].area).toBe("Olive Street");
});

test("creates the folder when it does not exist", async () => {
  const folder = await makeFolder();
  const file = join(folder, "deeper", "still", "posts.json");
  await addPost(sofa, file, noon);
  expect((await readPosts(file, noon)).length).toBe(1);
});

test("shows the newest post first, and the label follows the date", async () => {
  const file = join(await makeFolder(), "posts.json");
  const older = new Date(2026, 9, 22, 9, 0, 0);
  await addPost({ ...sofa, title: "An older post here" }, file, older);
  await addPost({ ...sofa, title: "A newer post here" }, file, noon);
  const posts = await readPosts(file, noon);
  expect(posts.map((post) => post.title)).toEqual([
    "A newer post here",
    "An older post here",
  ]);
  expect(posts.map((post) => post.postedLabel)).toEqual(["Today", "3 days ago"]);
});

test("two posts made at the same moment: the one saved last comes first", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entries = [storedEntry(1), storedEntry(2), storedEntry(3)];
  await writeFile(file, JSON.stringify({ version: 1, posts: entries }), "utf8");
  const posts = await readPosts(file, noon);
  expect(posts.map((post) => post.id)).toEqual(["post-3", "post-2", "post-1"]);
});

test("leaves no half-written files behind", async () => {
  const folder = await makeFolder();
  await addPost(sofa, join(folder, "posts.json"), noon);
  expect(await readdir(folder)).toEqual(["posts.json"]);
});

test("twenty saves at the same moment all end up in the file", async () => {
  const file = join(await makeFolder(), "posts.json");
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      addPost({ ...sofa, title: `Help number ${index}` }, file, noon),
    ),
  );
  expect(results.every((result) => result.ok)).toBe(true);
  const posts = await readPosts(file, noon);
  expect(posts.length).toBe(20);
  expect(new Set(posts.map((post) => post.id)).size).toBe(20);
  expect(new Set(posts.map((post) => post.title)).size).toBe(20);
});

test("refuses a post that fails the checks, and writes nothing", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const message = await messageOf(addPost({ ...sofa, title: "x" }, file, noon));
  expect(message).toContain("validateNewPost");
  expect(message).toContain("title");
  const house = await messageOf(addPost({ ...sofa, area: "Olive Street 12" }, file, noon));
  expect(house).toContain("area");
  expect(await readdir(folder)).toEqual([]);
});

test("a failed save does not stop the saves after it", async () => {
  const file = join(await makeFolder(), "posts.json");
  const failed = addPost({ ...sofa, title: "x" }, file, noon);
  const fine = addPost(sofa, file, noon);
  expect(await messageOf(failed)).toContain("validateNewPost");
  expect((await fine).ok).toBe(true);
  expect((await readPosts(file, noon)).length).toBe(1);
});

test("a damaged file is reported and never replaced", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  await writeFile(file, "{ this is not json", "utf8");
  expect(await messageOf(readPosts(file, noon))).toContain("not valid JSON");
  const message = await messageOf(addPost(sofa, file, noon));
  expect(message).toContain("not valid JSON");
  expect(message).toContain("Nothing was changed");
  expect(await readFile(file, "utf8")).toBe("{ this is not json");
  expect(await readdir(folder)).toEqual(["posts.json"]);
});

test("a file from a newer version of the app is not touched", async () => {
  const file = join(await makeFolder(), "posts.json");
  const text = JSON.stringify({ version: 2, posts: [] });
  await writeFile(file, text, "utf8");
  expect(await messageOf(addPost(sofa, file, noon))).toContain("version 2");
  expect(await readFile(file, "utf8")).toBe(text);
});

test("a post in the wrong shape is named by its number", () => {
  const entries = [storedEntry(1), { ...storedEntry(2), kind: "sell" }];
  const text = JSON.stringify({ version: 1, posts: entries });
  expect(() => parseStoredPosts(text)).toThrow("Post number 2");
});

test("every field of a stored post is checked", () => {
  const broken = [
    { ...storedEntry(1), id: "" },
    { ...storedEntry(1), title: 5 },
    { ...storedEntry(1), status: "waiting" },
    { ...storedEntry(1), createdAt: "yesterday" },
    "just text",
    null,
  ];
  for (const entry of broken) {
    const text = JSON.stringify({ version: 1, posts: [entry] });
    expect(() => parseStoredPosts(text)).toThrow("Post number 1");
  }
});

test("an object without the right parts is refused", () => {
  expect(() => parseStoredPosts("[]")).toThrow("should hold an object");
  expect(() => parseStoredPosts('{ "posts": [] }')).toThrow("should hold an object");
  expect(() => parseStoredPosts('{ "version": 1 }')).toThrow("should hold an object");
});

test("extra fields in a post are accepted, so a later version can add some", () => {
  const entries = [{ ...storedEntry(1), note: "added later" }];
  const text = JSON.stringify({ version: 1, posts: entries });
  expect(parseStoredPosts(text).length).toBe(1);
});

test("stops saving when the file is full, and leaves it as it was", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entries = Array.from({ length: savedPostsLimit }, (_, index) =>
    storedEntry(index),
  );
  const text = JSON.stringify({ version: 1, posts: entries });
  await writeFile(file, text, "utf8");
  expect(await addPost(sofa, file, noon)).toEqual({ ok: false, reason: "full" });
  expect(await readFile(file, "utf8")).toBe(text);
});

test("the last free place can still be used", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entries = Array.from({ length: savedPostsLimit - 1 }, (_, index) =>
    storedEntry(index),
  );
  await writeFile(file, JSON.stringify({ version: 1, posts: entries }), "utf8");
  expect((await addPost(sofa, file, noon)).ok).toBe(true);
  expect((await readPosts(file, noon)).length).toBe(savedPostsLimit);
});

function labelDaysBefore(days: number): string {
  const created = new Date(2026, 9, 25 - days, 8, 30, 0);
  return postedLabelFor(created.toISOString(), noon);
}

test("labels count calendar days, like the sample posts do", () => {
  expect(labelDaysBefore(0)).toBe("Today");
  expect(labelDaysBefore(1)).toBe("Yesterday");
  expect(labelDaysBefore(2)).toBe("2 days ago");
  expect(labelDaysBefore(6)).toBe("6 days ago");
  expect(labelDaysBefore(7)).toBe("Last week");
  expect(labelDaysBefore(13)).toBe("Last week");
  expect(labelDaysBefore(14)).toBe("2 weeks ago");
  expect(labelDaysBefore(59)).toBe("8 weeks ago");
  expect(labelDaysBefore(60)).toBe("A while ago");
});

test("a post from a minute before midnight is yesterday a minute later", () => {
  const created = new Date(2026, 9, 24, 23, 59, 0).toISOString();
  expect(postedLabelFor(created, new Date(2026, 9, 25, 0, 1, 0))).toBe("Yesterday");
  expect(postedLabelFor(created, new Date(2026, 9, 24, 23, 59, 30))).toBe("Today");
});

test("a date in the future, from a wrong clock, still says Today", () => {
  const created = new Date(2026, 9, 27, 12, 0, 0).toISOString();
  expect(postedLabelFor(created, noon)).toBe("Today");
});
