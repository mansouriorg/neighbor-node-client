import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReport,
  readPosts,
  removeOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { renewOwnPostFromInput } from "@/lib/renew-own-post";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("renew-own-post-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const day = 24 * 60 * 60 * 1000;
const noon = new Date(2026, 9, 25, 12, 0, 0);
const wrongKey = "f".repeat(64);

// The moment that is this many days after the post of the test was written.
function daysAfter(days: number): Date {
  return new Date(noon.getTime() + days * day);
}

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string = sofa.title) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawText(file: string) {
  return readFile(file, "utf8");
}

async function rawPosts(file: string) {
  return JSON.parse(await rawText(file)).posts;
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

test("a post that has used some of its days is kept up: the answer says 30 days, and the time is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const answer = await renewOwnPostFromInput(id, key, file, daysAfter(10));
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect(answer.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(10).toISOString());
});

test("the answer holds the post as everyone sees it, with keep, and the counts of its reports", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReport(id, "spam", file, daysAfter(2));
  const answer = await renewOwnPostFromInput(id, key, file, daysAfter(10));
  const shown = await readPosts(file, daysAfter(10));
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") {
    expect(answer.post).toEqual({ ...shown[0], keep: { state: "shown", daysLeft: 30 } });
    expect(answer.reports).toEqual({ total: 1, byReason: [{ reason: "spam", count: 1 }] });
    expect(JSON.stringify(answer)).not.toContain("manageKeyHash");
    expect(JSON.stringify(answer)).not.toContain(key);
  }
});

test("a post that is hidden by its age can be kept up, and is then shown for 30 days", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const answer = await renewOwnPostFromInput(id, key, file, daysAfter(45));
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect(answer.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(45).toISOString());
});

test("a post that is just written is fine and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const before = await rawText(file);
  const answer = await renewOwnPostFromInput(id, key, file, daysAfter(0));
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect(answer.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect(await rawText(file)).toBe(before);
});

test("a post that is done is fine, is never hidden, and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await updateOwnPostStatus(id, key, "done", file, daysAfter(1));
  const before = await rawText(file);
  const answer = await renewOwnPostFromInput(id, key, file, daysAfter(90));
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") {
    expect(answer.post.status).toBe("done");
    expect(answer.post.keep).toEqual({ state: "done" });
  }
  expect(await rawText(file)).toBe(before);
});

test("an id or a key of the wrong shape is not allowed, before the file is opened", async () => {
  // The "file" is a folder. Opening it would fail, and the answer would be "failed".
  const folder = await makeFolder();
  const wrongIds: unknown[] = [undefined, null, 42, {}, ["post-a"], "", "sample-1", "post-", `post-${"a".repeat(65)}`, "post-a b", "../post-a"];
  for (const id of wrongIds) {
    expect(await renewOwnPostFromInput(id, wrongKey, folder, daysAfter(10))).toEqual({ status: "not-allowed" });
  }
  const wrongKeys: unknown[] = [undefined, null, 5, {}, [wrongKey], "", "f".repeat(63), "f".repeat(65), "g".repeat(64), ` ${"f".repeat(63)}`];
  for (const key of wrongKeys) {
    expect(await renewOwnPostFromInput("post-a", key, folder, daysAfter(10))).toEqual({ status: "not-allowed" });
  }
});

test("a wrong key, an unknown post and a post that was taken down are not allowed, and nothing is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file);
  const gone = await save(file, "The second post here");
  await removeOwnPost(gone.id, gone.key, file, daysAfter(1));
  const before = await rawText(file);
  const refused = { status: "not-allowed" };
  expect(await renewOwnPostFromInput(first.id, wrongKey, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPostFromInput("post-nothing", first.key, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPostFromInput(gone.id, gone.key, file, daysAfter(40))).toEqual(refused);
  expect(await renewOwnPostFromInput(gone.id, first.key, file, daysAfter(40))).toEqual(refused);
  expect(await rawText(file)).toBe(before);
});

test("the key works again afterwards: a post that is kept up and left alone for 30 days can be kept up again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect((await renewOwnPostFromInput(id, key, file, daysAfter(10))).status).toBe("ok");
  const hidden = await renewOwnPostFromInput(id, key, file, daysAfter(41));
  expect(hidden.status).toBe("ok");
  if (hidden.status === "ok") expect(hidden.post.keep).toEqual({ state: "shown", daysLeft: 30 });
  expect((await rawPosts(file))[0].renewedAt).toBe(daysAfter(41).toISOString());
});

test("a file that cannot be read gives a plain failure, and the log has the cause but not the key", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ not json", "utf8");
  const secretKey = "ab".repeat(32);
  const { value, logged } = await quietly(() => renewOwnPostFromInput("post-a", secretKey, file, daysAfter(10)));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
  // Everything that was logged, also the inside of objects, as one text.
  const show = (part: unknown) => (typeof part === "string" || part instanceof Error ? String(part) : JSON.stringify(part));
  const text = logged.map((args) => args.map(show).join(" ")).join("\n");
  expect(text).toContain("Keeping a post up failed");
  expect(text).toContain("not valid JSON");
  expect(text).not.toContain(secretKey);
  expect(await rawText(file)).toBe("{ not json");
});

test("the answers are plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const answers = [
    await renewOwnPostFromInput(id, key, file, daysAfter(10)),
    await renewOwnPostFromInput(id, wrongKey, file, daysAfter(10)),
    await renewOwnPostFromInput("nope", key, file, daysAfter(10)),
  ];
  expect(answers.map((answer) => answer.status)).toEqual(["ok", "not-allowed", "not-allowed"]);
  for (const answer of answers) {
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  }
});
