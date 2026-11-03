import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadBoardPosts, loadPost, loadPostForAuthor } from "@/lib/board-posts";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost, removeOwnPost, renewOwnPost } from "@/lib/post-store";
import { samplePosts } from "@/lib/posts";
import { useTempFolders } from "./support/temp-folders";

// A post that nothing happened to for 30 days is hidden from the board and from
// its page, but not from the private page of its author. These tests check
// the three ways to load a post.
const makeFolder = useTempFolders("hidden-board-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const day = 24 * 60 * 60 * 1000;
const noon = new Date(2026, 9, 25, 12, 0, 0);

function daysAfter(days: number): Date {
  return new Date(noon.getTime() + days * day);
}

async function save(file: string, title: string, at: Date = noon) {
  const result = await addPost({ ...sofa, title }, file, at);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

// Runs something that logs an error, and keeps the log out of the test output.
async function quietly<T>(run: () => Promise<T>) {
  const original = console.error;
  console.error = () => undefined;
  try {
    return await run();
  } finally {
    console.error = original;
  }
}

// Asks for a post for its author and gives back the text of the error, or "".
async function errorOfLoadForAuthor(id: string, file: string, now: Date): Promise<string> {
  try {
    await loadPostForAuthor(id, file, now);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "unknown";
  }
}

test("the board leaves a hidden post out, and the count of saved posts does not include it", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "Post written on day 0", daysAfter(0));
  await save(file, "Post written on day 20", daysAfter(20));
  const board = await loadBoardPosts(file, daysAfter(35));
  expect(board.savedCount).toBe(1);
  expect(board.savedProblem).toBe(false);
  expect(board.posts[0].title).toBe("Post written on day 20");
  expect(board.posts.length).toBe(1 + samplePosts.length);
  expect(board.posts.slice(1)).toEqual(samplePosts);
});

test("when every saved post is hidden, the board shows the examples only", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file, "Post written on day 0", daysAfter(0));
  const board = await loadBoardPosts(file, daysAfter(60));
  expect(board.savedCount).toBe(0);
  expect(board.posts).toEqual(samplePosts);
});

test("the post page does not find a hidden post, and finds it again when it is shown", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  expect((await loadPost(id, file, daysAfter(10)))?.title).toBe("The first post here");
  expect(await loadPost(id, file, daysAfter(40))).toBe(undefined);
  await renewOwnPost(id, key, file, daysAfter(40));
  expect((await loadPost(id, file, daysAfter(40)))?.title).toBe("The first post here");
});

test("the post page shows a post with no keep, as before", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const post = await loadPost(id, file, daysAfter(5));
  expect(post?.keep).toBe(undefined);
});

test("the private page finds a shown post, and says how long it stays", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const post = await loadPostForAuthor(id, file, daysAfter(10));
  expect(post?.title).toBe("The first post here");
  expect(post?.keep).toEqual({ state: "shown", daysLeft: 20 });
});

test("the private page finds a hidden post, and says it is hidden", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file, "The first post here");
  const post = await loadPostForAuthor(id, file, daysAfter(40));
  expect(post?.title).toBe("The first post here");
  expect(post?.keep).toEqual({ state: "hidden" });
});

test("the private page does not find a post that was taken down, or one that does not exist", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file, "The first post here");
  expect(await loadPostForAuthor("post-nobody", file, daysAfter(1))).toBe(undefined);
  await removeOwnPost(id, key, file, daysAfter(1));
  expect(await loadPostForAuthor(id, file, daysAfter(2))).toBe(undefined);
  expect(await loadPostForAuthor(id, file, daysAfter(60))).toBe(undefined);
});

test("an id that is not a saved post is never looked up in the file: a sample is found, anything else is not", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ this is not json", "utf8");
  const sample = samplePosts[0];
  const found = await loadPostForAuthor(sample.id, file, noon);
  expect(found).toEqual(sample);
  expect(found?.keep).toBe(undefined);
  expect(await loadPostForAuthor("something-else", file, noon)).toBe(undefined);
  expect(await loadPostForAuthor("", file, noon)).toBe(undefined);
});

test("a damaged file is an error for the private page, not a wrong answer of not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ this is not json", "utf8");
  const message = await quietly(() => errorOfLoadForAuthor("post-abc", file, noon));
  expect(message).toContain("not valid JSON");
});
