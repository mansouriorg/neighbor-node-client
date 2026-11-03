import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadBoardPosts, loadPost } from "@/lib/board-posts";
import { addPost } from "@/lib/post-store";
import { isExamplePost, samplePosts } from "@/lib/posts";

// These tests write real files, in a folder inside node_modules that git and
// the test watcher ignore. They remove it afterwards.
const testRoot = join(process.cwd(), "node_modules", ".cache", "post-store-tests");
const madeFolders: string[] = [];

async function makeFolder(): Promise<string> {
  await mkdir(testRoot, { recursive: true });
  const folder = await mkdtemp(join(testRoot, "board-"));
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

const sofa = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
} as const;

const drill = {
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
} as const;

// Saves a post at a chosen time and gives back its id.
async function save(file: string, input: typeof sofa | typeof drill, when: Date): Promise<string> {
  const result = await addPost(input, file, when);
  if (result.ok) return result.post.id;
  throw new Error("The board of the test is full.");
}

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

// Asks for a post and gives back the text of the error, or "" when there was none.
async function errorOfLoadPost(id: string, file: string, now: Date): Promise<string> {
  try {
    await loadPost(id, file, now);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "unknown";
  }
}

const noon = new Date(2026, 9, 25, 12, 0, 0);

test("with no file yet, the board shows the nine examples and nothing else", async () => {
  const file = join(await makeFolder(), "posts.json");
  const board = await loadBoardPosts(file, noon);
  expect(board.savedCount).toBe(0);
  expect(board.savedProblem).toBe(false);
  expect(board.posts.length).toBe(9);
  expect(board.posts).toEqual(samplePosts);
});

test("saved posts come first, newest first, and the examples follow", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, sofa, new Date(2026, 9, 23, 10, 0, 0));
  await save(file, drill, new Date(2026, 9, 25, 9, 0, 0));
  const board = await loadBoardPosts(file, noon);
  expect(board.savedCount).toBe(2);
  expect(board.posts.length).toBe(11);
  expect(board.posts[0].title).toBe("A drill for the weekend");
  expect(board.posts[0].postedLabel).toBe("Today");
  expect(board.posts[1].title).toBe("Help moving a sofa");
  expect(board.posts[1].postedLabel).toBe("2 days ago");
  expect(board.posts.slice(2)).toEqual(samplePosts);
});

test("only the sample posts count as examples", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, sofa, noon);
  const board = await loadBoardPosts(file, noon);
  const examples = board.posts.filter((post) => isExamplePost(post));
  expect(examples.length).toBe(9);
  expect(isExamplePost(board.posts[0])).toBe(false);
});

test("a damaged file does not break the board: the examples show and the problem is flagged", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ this is not json", "utf8");
  const { value, logged } = await quietly(() => loadBoardPosts(file, noon));
  expect(value.savedProblem).toBe(true);
  expect(value.savedCount).toBe(0);
  expect(value.posts).toEqual(samplePosts);
  expect(logged.length).toBe(1);
  expect(String(logged[0][1])).toContain("not valid JSON");
  expect(await readFile(file, "utf8")).toBe("{ this is not json");
});

test("a file from a newer version gives the same plain fallback", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, JSON.stringify({ version: 99, posts: [] }), "utf8");
  const { value } = await quietly(() => loadBoardPosts(file, noon));
  expect(value.savedProblem).toBe(true);
  expect(value.posts.length).toBe(9);
});

test("a saved post that repeats an id is left out", async () => {
  const file = join(await makeFolder(), "posts.json");
  const entry = {
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt: "2026-10-25T08:00:00.000Z",
  };
  const posts = [
    { id: "post-a", ...entry },
    { id: "post-a", ...entry, title: "The same id again", createdAt: "2026-10-25T07:00:00.000Z" },
    { id: "sample-1", ...entry, title: "Pretends to be a sample" },
  ];
  await writeFile(file, JSON.stringify({ version: 1, posts }), "utf8");
  const board = await loadBoardPosts(file, noon);
  expect(board.savedCount).toBe(1);
  expect(board.posts.length).toBe(10);
  expect(new Set(board.posts.map((post) => post.id)).size).toBe(10);
  expect(board.posts.filter((post) => post.title === "The same id again").length).toBe(0);
  expect(board.posts.filter((post) => post.title === "Pretends to be a sample").length).toBe(0);
  // The page of the post shows the same one that the board shows.
  const page = await loadPost("post-a", file, noon);
  expect(page === undefined ? "" : page.title).toBe("Help moving a sofa");
});

test("a sample post is found without opening the file", async () => {
  const folder = await makeFolder();
  const damaged = join(folder, "damaged.json");
  await writeFile(damaged, "nope", "utf8");
  const post = await loadPost("sample-3", damaged, noon);
  expect(post).toEqual(samplePosts[2]);
});

test("an id that cannot be a saved post is not found, and the file is not opened", async () => {
  const folder = await makeFolder();
  const damaged = join(folder, "damaged.json");
  await writeFile(damaged, "nope", "utf8");
  for (const id of ["nope", "", "SAMPLE-1", "../../etc/passwd", "sample-1/../sample-2", "Post-1"]) {
    expect(await loadPost(id, damaged, noon)).toBeUndefined();
  }
});

test("a saved post is found by its id", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, drill, noon);
  const id = await save(file, sofa, noon);
  const post = await loadPost(id, file, noon);
  expect(post === undefined ? "" : post.title).toBe("Help moving a sofa");
});

test("the ids of saved posts start with post-, which is how the board tells them apart", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file, sofa, noon);
  expect(id.startsWith("post-")).toBe(true);
  expect((await loadPost(id, file, noon)) === undefined).toBe(false);
});

test("the time words are worked out at the moment of the visit", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file, sofa, new Date(2026, 9, 25, 9, 0, 0));
  const sameDay = await loadPost(id, file, new Date(2026, 9, 25, 20, 0, 0));
  const later = await loadPost(id, file, new Date(2026, 9, 28, 20, 0, 0));
  expect(sameDay === undefined ? "" : sameDay.postedLabel).toBe("Today");
  expect(later === undefined ? "" : later.postedLabel).toBe("3 days ago");
});

test("an id that looks like a saved post but is not in the file is not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, sofa, noon);
  expect(await loadPost("post-nope", file, noon)).toBeUndefined();
  expect(await loadPost("post-", file, noon)).toBeUndefined();
});

test("with no file at all, a saved-looking id is simply not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  expect(await loadPost("post-1", file, noon)).toBeUndefined();
});

test("a damaged file is an error for a saved post, not a wrong 'not found'", async () => {
  const folder = await makeFolder();
  const damaged = join(folder, "damaged.json");
  await writeFile(damaged, "nope", "utf8");
  const message = await errorOfLoadPost("post-1", damaged, noon);
  expect(message).toContain("not valid JSON");
});
