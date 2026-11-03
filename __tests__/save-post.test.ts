import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { newPostFieldOrder } from "@/lib/new-post";
import { savePostFromInput } from "@/lib/save-post";
import { readPosts, savedPostsLimit } from "@/lib/post-store";

// These tests write real files, in a folder inside node_modules that git and
// the test watcher ignore. They remove it afterwards.
const testRoot = join(process.cwd(), "node_modules", ".cache", "post-store-tests");
const madeFolders: string[] = [];

async function makeFolder(): Promise<string> {
  await mkdir(testRoot, { recursive: true });
  const folder = await mkdtemp(join(testRoot, "save-"));
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

const noon = new Date(2026, 9, 25, 12, 0, 0);

const good = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

// Runs something that logs an error, and keeps the log out of the test output.
async function quietly<T>(run: () => Promise<T>) {
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    return { value: await run(), logged };
  } finally {
    console.error = original;
  }
}

test("a good post is saved and sent back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const result = await savePostFromInput(good, file, noon);
  expect(result.status).toBe("saved");
  if (result.status === "saved") {
    expect(result.post.title).toBe("Help moving a sofa");
    expect(result.post.status).toBe("open");
    expect(result.post.postedLabel).toBe("Today");
  }
  expect((await readPosts(file, noon)).length).toBe(1);
});

test("saves the cleaned text, without spaces at the ends", async () => {
  const file = join(await makeFolder(), "posts.json");
  await savePostFromInput(
    { ...good, title: "  Help moving a sofa  ", area: "  Olive Street " },
    file,
    noon,
  );
  const posts = await readPosts(file, noon);
  expect(posts[0].title).toBe("Help moving a sofa");
  expect(posts[0].area).toBe("Olive Street");
});

test("an empty request is refused with a message for every field", async () => {
  const folder = await makeFolder();
  const result = await savePostFromInput({}, join(folder, "posts.json"), noon);
  expect(result.status).toBe("invalid");
  if (result.status === "invalid") {
    expect(Object.keys(result.errors).sort()).toEqual([...newPostFieldOrder].sort());
  }
  expect(await readdir(folder)).toEqual([]);
});

test("things that are not even an object are refused, not crashed on", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  for (const input of [null, undefined, "text", 5, true, [], () => 1]) {
    const result = await savePostFromInput(input, file, noon);
    expect(result.status).toBe("invalid");
  }
  expect(await readdir(folder)).toEqual([]);
});

test("fields that are not text are treated as empty", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const odd = {
    kind: ["help"],
    title: 12345,
    details: { text: "Saturday morning, two people, about an hour." },
    area: null,
  };
  const result = await savePostFromInput(odd, file, noon);
  expect(result.status).toBe("invalid");
  if (result.status === "invalid") {
    expect(Object.keys(result.errors).length).toBe(4);
  }
  expect(await readdir(folder)).toEqual([]);
});

test("a house number is refused, also in digits of other scripts", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const plain = await savePostFromInput({ ...good, area: "Olive Street 12" }, file, noon);
  expect(plain.status).toBe("invalid");
  const arabic = await savePostFromInput(
    { ...good, area: "Olive Street \u0661\u0662" },
    file,
    noon,
  );
  expect(arabic.status).toBe("invalid");
  if (arabic.status === "invalid") expect(arabic.errors.area).toContain("house number");
  expect(await readdir(folder)).toEqual([]);
});

test("a text that is far too long is refused", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const huge = "a".repeat(200000);
  for (const field of ["title", "details", "area"]) {
    const result = await savePostFromInput({ ...good, [field]: huge }, file, noon);
    expect(result.status).toBe("invalid");
  }
  expect(await readdir(folder)).toEqual([]);
});

test("nobody can choose the id, the status or the date from outside", async () => {
  const file = join(await makeFolder(), "posts.json");
  const result = await savePostFromInput(
    {
      ...good,
      id: "sample-1",
      status: "done",
      createdAt: "2001-01-01T00:00:00.000Z",
      postedLabel: "Last week",
    },
    file,
    noon,
  );
  expect(result.status).toBe("saved");
  if (result.status === "saved") {
    expect(result.post.id.startsWith("post-")).toBe(true);
    expect(result.post.status).toBe("open");
    expect(result.post.postedLabel).toBe("Today");
  }
  const data = JSON.parse(await readFile(file, "utf8"));
  expect(data.posts[0].createdAt).toBe(noon.toISOString());
});

test("a full board says so, and the file is left as it was", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entry = {
    id: "post-0",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt: "2026-01-01T10:00:00.000Z",
  };
  const text = JSON.stringify({
    version: 1,
    posts: Array.from({ length: savedPostsLimit }, () => entry),
  });
  await writeFile(file, text, "utf8");
  const result = await savePostFromInput(good, file, noon);
  expect(result).toEqual({ status: "full" });
  expect(await readFile(file, "utf8")).toBe(text);
});

test("a damaged file gives a plain failure, with no details for the browser", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  await writeFile(file, "{ this is not json", "utf8");
  const { value, logged } = await quietly(() => savePostFromInput(good, file, noon));
  expect(value).toEqual({ status: "failed" });
  expect(JSON.stringify(value)).not.toContain("posts.json");
  expect(logged.length).toBe(1);
  expect(String(logged[0][1])).toContain("not valid JSON");
  expect(await readFile(file, "utf8")).toBe("{ this is not json");
});

test("every answer can travel as plain data", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  const damaged = join(folder, "damaged.json");
  await writeFile(damaged, "nope", "utf8");
  const saved = await savePostFromInput(good, file, noon);
  const invalid = await savePostFromInput({}, file, noon);
  const { value: failed } = await quietly(() => savePostFromInput(good, damaged, noon));
  for (const result of [saved, invalid, failed]) {
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  }
});

test("five people saving at the same moment all get their post saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((number) =>
      savePostFromInput({ ...good, title: `Help number ${number}` }, file, noon),
    ),
  );
  expect(results.every((result) => result.status === "saved")).toBe(true);
  expect((await readPosts(file, noon)).length).toBe(5);
});
