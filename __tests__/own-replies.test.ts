import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageLimits, type ManageLimits } from "@/lib/manage-limits";
import type { ValidNewPost } from "@/lib/new-post";
import { readOwnRepliesFromInput } from "@/lib/own-replies";
import { readOwnRepliesWithinLimits } from "@/lib/own-replies-limits";
import { addPost, addReply, removeOwnPost } from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("own-replies-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const oneMinute = 60 * 1000;

function after(minutes: number): Date {
  return new Date(noon.getTime() + minutes * oneMinute);
}

const wrongKey = "f".repeat(64);
const notAllowed = { status: "not-allowed" };

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string = sofa.title) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

// A counter that allows 3 wrong tries in 10 minutes, so the tests stay short.
function smallLimits(): ManageLimits {
  return createManageLimits({ wrongTries: 3, windowMinutes: 10 });
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

// ---------- the logic

test("the right id and key give the replies, the newest first", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReply(id, { message: "The first reply.", name: "Maria" }, file, noon);
  await addReply(id, { message: "The second reply.", contact: "0123" }, file, after(5));
  const answer = await readOwnRepliesFromInput(id, key, file, after(10));
  expect(answer).toEqual({
    status: "ok",
    replies: [
      { message: "The second reply.", contact: "0123", when: "Today" },
      { message: "The first reply.", name: "Maria", when: "Today" },
    ],
  });
});

test("a post with no replies gives an empty list", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect(await readOwnRepliesFromInput(id, key, file, noon)).toEqual({ status: "ok", replies: [] });
});

test("a wrong key, an unknown post and a post that was taken down are not allowed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReply(id, { message: "Hello there." }, file, noon);
  expect(await readOwnRepliesFromInput(id, wrongKey, file, noon)).toEqual(notAllowed);
  expect(await readOwnRepliesFromInput("post-nothing", key, file, noon)).toEqual(notAllowed);
  await removeOwnPost(id, key, file, after(1));
  expect(await readOwnRepliesFromInput(id, key, file, after(2))).toEqual(notAllowed);
});

test("an id or a key of the wrong shape is refused before the file is opened", async () => {
  // The "file" is a folder. Opening it would fail, and the answer would be "failed".
  const folder = await makeFolder();
  const key = "a".repeat(64);
  const wrongIds: unknown[] = [undefined, null, 42, {}, "", "sample-1", "post-", "../post-a", `post-${"a".repeat(65)}`];
  for (const id of wrongIds) {
    expect(await readOwnRepliesFromInput(id, key, folder, noon)).toEqual(notAllowed);
  }
  const wrongKeys: unknown[] = [undefined, null, 42, {}, "", "short", "A".repeat(64), "a".repeat(63), "a".repeat(65)];
  for (const wrong of wrongKeys) {
    expect(await readOwnRepliesFromInput("post-a", wrong, folder, noon)).toEqual(notAllowed);
  }
});

test("a file that cannot be read gives a plain failure, and the log does not hold the replies", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReply(id, { message: "A message that must not be logged." }, file, noon);
  await writeFile(file, "{ not json", "utf8");
  const { value, logged } = await quietly(() => readOwnRepliesFromInput(id, key, file, noon));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
  const text = logged.map((args) => args.map((part) => String(part)).join(" ")).join("\n");
  expect(text).toContain("Reading the replies to a post failed");
  expect(text).not.toContain("must not be logged");
  expect(await readFile(file, "utf8")).toBe("{ not json");
});

// ---------- the limit on wrong tries

test("only wrong tries count: the right key is free, however often it is used", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 10; index += 1) {
    const answer = await readOwnRepliesWithinLimits(id, key, "someone", limits, file, noon);
    expect(answer.status).toBe("ok");
  }
  for (let index = 0; index < 3; index += 1) {
    expect(await readOwnRepliesWithinLimits(id, wrongKey, "someone", limits, file, noon)).toEqual(notAllowed);
  }
  expect(await readOwnRepliesWithinLimits(id, wrongKey, "someone", limits, file, noon)).toEqual({
    status: "limited",
    minutes: 10,
  });
});

test("a visitor with no place left is stopped before the file is opened, also with the right key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await readOwnRepliesWithinLimits(id, wrongKey, "someone", limits, file, noon);
  }
  const refused = { status: "limited", minutes: 10 };
  expect(await readOwnRepliesWithinLimits(id, key, "someone", limits, file, noon)).toEqual(refused);
  // A folder in place of the file would give "failed" if it were opened.
  const folder = await makeFolder();
  expect(await readOwnRepliesWithinLimits(id, key, "someone", limits, folder, noon)).toEqual(refused);
  expect((await readOwnRepliesWithinLimits(id, key, "someone", limits, file, after(10))).status).toBe("ok");
});

test("a try that fails on our side gives its place back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const good = await readFile(file, "utf8");
  const limits = smallLimits();
  await writeFile(file, "{ not json", "utf8");
  const { value } = await quietly(async () => {
    const answers = [];
    for (let index = 0; index < 5; index += 1) {
      answers.push(await readOwnRepliesWithinLimits(id, key, "someone", limits, file, noon));
    }
    return answers;
  });
  expect(value.map((answer) => answer.status)).toEqual(["failed", "failed", "failed", "failed", "failed"]);
  await writeFile(file, good, "utf8");
  expect((await readOwnRepliesWithinLimits(id, key, "someone", limits, file, noon)).status).toBe("ok");
});

test("the counter is shared with the other tries on the private page, and other visitors are counted apart", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await readOwnRepliesWithinLimits(id, wrongKey, "noisy", limits, file, noon);
  }
  expect((await readOwnRepliesWithinLimits(id, wrongKey, "noisy", limits, file, noon)).status).toBe("limited");
  expect((await readOwnRepliesWithinLimits(id, wrongKey, "quiet", limits, file, noon)).status).toBe("not-allowed");
});

test("the answers are plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReply(id, { message: "Hello there.", name: "Maria", contact: "0123" }, file, noon);
  const limits = smallLimits();
  const answers = [
    await readOwnRepliesWithinLimits(id, key, "someone", limits, file, noon),
    await readOwnRepliesWithinLimits(id, wrongKey, "someone", limits, file, noon),
  ];
  for (const answer of answers) {
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  }
});
