import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { repliesKeptPerPost } from "@/lib/new-reply";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost, removeOwnPost, updateOwnPostStatus } from "@/lib/post-store";
import { replyToPostFromInput } from "@/lib/reply-post";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("reply-post-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const later = new Date(2026, 9, 26, 9, 30, 0);

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string = sofa.title) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
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

const hello = { message: "I can help on Saturday.", name: "Maria", contact: "maria@example.org" };

test("a reply to a saved post is saved, with the words, the name, the contact and the time", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  expect(await replyToPostFromInput(id, hello, file, later)).toEqual({ status: "sent" });
  expect((await rawPosts(file))[0].replies).toEqual([{ ...hello, at: later.toISOString() }]);
});

test("a reply with only a message is saved without a name and without a contact", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  expect(await replyToPostFromInput(id, { message: "I have a ladder." }, file, later)).toEqual({ status: "sent" });
  expect((await rawPosts(file))[0].replies).toEqual([{ message: "I have a ladder.", at: later.toISOString() }]);
});

test("only the three fields of the form are used, so nobody can choose a time or anything else", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const sneaky = {
    ...hello,
    at: "1999-01-01T00:00:00.000Z",
    id: "post-other",
    status: "done",
    reports: [{ reason: "spam", at: "1999-01-01T00:00:00.000Z" }],
  };
  expect(await replyToPostFromInput(id, sneaky, file, later)).toEqual({ status: "sent" });
  const saved = await rawPosts(file);
  expect(saved[0].replies).toEqual([{ ...hello, at: later.toISOString() }]);
  expect(saved[0].status).toBe("open");
  expect(saved[0].reports).toBeUndefined();
});

test("fields that are not text count as empty", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const answer = await replyToPostFromInput(id, { message: "Fine words here.", name: 5, contact: { a: 1 } }, file, later);
  expect(answer).toEqual({ status: "sent" });
  expect((await rawPosts(file))[0].replies).toEqual([{ message: "Fine words here.", at: later.toISOString() }]);
  const bad = await replyToPostFromInput(id, { message: 12345 }, file, later);
  expect(bad).toEqual({ status: "invalid", errors: { message: "Write a short message." } });
});

test("a reply that does not pass the checks is invalid, says why, and saves nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const before = await readFile(file, "utf8");
  const answer = await replyToPostFromInput(id, { message: "no", name: "n".repeat(41), contact: "c".repeat(101) }, file, later);
  expect(answer).toEqual({
    status: "invalid",
    errors: {
      message: "The message is too short. Use at least 5 characters.",
      name: "This is too long. Use at most 40 characters.",
      contact: "This is too long. Use at most 100 characters.",
    },
  });
  expect(await readFile(file, "utf8")).toBe(before);
});

test("any kind of input is answered, never thrown at", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const inputs: unknown[] = [undefined, null, 42, "a text", true, [], ["Hello there."], () => "x", Symbol("s")];
  for (const input of inputs) {
    expect(await replyToPostFromInput(id, input, file, later)).toEqual({
      status: "invalid",
      errors: { message: "Write a short message." },
    });
  }
  expect((await rawPosts(file))[0].replies).toBeUndefined();
});

test("the checks of the words come before the file is opened", async () => {
  // The "file" is a folder. Opening it would fail, and the answer would be "failed".
  const folder = await makeFolder();
  const answer = await replyToPostFromInput("post-a", { message: "" }, folder, later);
  expect(answer.status).toBe("invalid");
});

test("an id of the wrong shape is not found, before the file is opened", async () => {
  const folder = await makeFolder();
  const wrongIds: unknown[] = [
    undefined,
    null,
    42,
    {},
    ["post-a"],
    "",
    "sample-1",
    "post-",
    `post-${"a".repeat(65)}`,
    "post-a b",
    "../post-a",
  ];
  for (const id of wrongIds) {
    expect(await replyToPostFromInput(id, hello, folder, later)).toEqual({ status: "not-found" });
  }
});

test("an unknown post and a post that was taken down are not found", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect(await replyToPostFromInput("post-nothing", hello, file, later)).toEqual({ status: "not-found" });
  await removeOwnPost(id, key, file, later);
  expect(await replyToPostFromInput(id, hello, file, later)).toEqual({ status: "not-found" });
});

test("a post that is marked as done is closed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await updateOwnPostStatus(id, key, "done", file, later);
  expect(await replyToPostFromInput(id, hello, file, later)).toEqual({ status: "closed" });
  expect((await rawPosts(file))[0].replies).toBeUndefined();
});

test("a post that has enough replies says so, and nothing more is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  for (let count = 0; count < repliesKeptPerPost; count += 1) {
    expect(await replyToPostFromInput(id, hello, file, later)).toEqual({ status: "sent" });
  }
  expect(await replyToPostFromInput(id, hello, file, later)).toEqual({ status: "enough" });
  expect((await rawPosts(file))[0].replies.length).toBe(repliesKeptPerPost);
});

test("a file that cannot be read gives a plain failure, and the log has the cause but not the words of the reply", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ not json", "utf8");
  const secret = { message: "A message that must not be logged.", name: "Maria", contact: "0123 456 789" };
  const { value, logged } = await quietly(() => replyToPostFromInput("post-a", secret, file, later));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
  const text = logged.map((args) => args.map((part) => String(part)).join(" ")).join("\n");
  expect(text).toContain("Saving a reply failed");
  expect(text).toContain("not valid JSON");
  expect(text).not.toContain("must not be logged");
  expect(text).not.toContain("0123 456 789");
  expect(await readFile(file, "utf8")).toBe("{ not json");
});

test("the answers are plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const answers = [
    await replyToPostFromInput(id, hello, file, later),
    await replyToPostFromInput(id, {}, file, later),
    await replyToPostFromInput("nope", hello, file, later),
  ];
  for (const answer of answers) {
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  }
});
