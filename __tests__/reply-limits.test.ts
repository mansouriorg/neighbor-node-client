import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost } from "@/lib/post-store";
import {
  createReplyLimits,
  defaultReplyLimitSettings,
  replyToPostWithinLimits,
  type ReplyLimits,
} from "@/lib/reply-limits";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("reply-limits-");

const noon = new Date(2026, 9, 25, 12, 0, 0);
const oneMinute = 60 * 1000;

function after(minutes: number, seconds: number = 0): Date {
  return new Date(noon.getTime() + minutes * oneMinute + seconds * 1000);
}

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const hello = { message: "I can help on Saturday." };

// Saves a post and gives back its id.
async function save(file: string): Promise<string> {
  const result = await addPost(sofa, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return result.post.id;
}

// A counter that allows 3 replies in 10 minutes, so the tests stay short.
function smallLimits(): ReplyLimits {
  return createReplyLimits({ replies: 3, windowMinutes: 10 });
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

// ---------- the counter

test("the default is 10 replies in an hour", () => {
  expect(defaultReplyLimitSettings).toEqual({ replies: 10, windowMinutes: 60 });
  const limits = createReplyLimits();
  let allowed = 0;
  for (let index = 0; index < 25; index += 1) {
    if (limits.take("someone", noon).ok) allowed += 1;
  }
  expect(allowed).toBe(10);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 60 });
});

test("numbers that make no sense are refused when the counter is made", () => {
  expect(() => createReplyLimits({ replies: 0, windowMinutes: 10 })).toThrow("whole number");
  expect(() => createReplyLimits({ replies: 3, windowMinutes: 0 })).toThrow("whole number");
  expect(() => createReplyLimits(defaultReplyLimitSettings, 0)).toThrow("whole number");
});

test("the wait is told in whole minutes, rounded up, and gets shorter as time passes", () => {
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) limits.take("someone", noon);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 10 });
  expect(limits.take("someone", after(4, 30))).toEqual({ ok: false, minutes: 6 });
  expect(limits.take("someone", after(9, 59))).toEqual({ ok: false, minutes: 1 });
  expect(limits.take("someone", after(10)).ok).toBe(true);
});

test("visitors are counted apart, and only the most recent ones are remembered", () => {
  const limits = createReplyLimits({ replies: 1, windowMinutes: 10 }, 2);
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("a", noon).ok).toBe(false);
  expect(limits.take("b", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(true);
  // "a" was forgotten to make room, so it starts again. "c" is still counted.
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(false);
});

// ---------- which tries count

test("every try counts, whatever the answer, except one that fails on our side", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  const sent = await replyToPostWithinLimits(id, hello, "someone", limits, file, noon);
  const missing = await replyToPostWithinLimits("post-nothing", hello, "someone", limits, file, noon);
  const invalid = await replyToPostWithinLimits(id, { message: "" }, "someone", limits, file, noon);
  expect(sent).toEqual({ status: "sent" });
  expect(missing).toEqual({ status: "not-found" });
  expect(invalid.status).toBe("invalid");
  const fourth = await replyToPostWithinLimits(id, hello, "someone", limits, file, noon);
  expect(fourth).toEqual({ status: "limited", minutes: 10 });
});

test("a try with an id of the wrong shape counts too", async () => {
  const folder = await makeFolder();
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    const answer = await replyToPostWithinLimits(undefined, hello, "someone", limits, folder, noon);
    expect(answer).toEqual({ status: "not-found" });
  }
  const fourth = await replyToPostWithinLimits(undefined, hello, "someone", limits, folder, noon);
  expect(fourth).toEqual({ status: "limited", minutes: 10 });
});

test("a try that fails on our side gives its place back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const good = await readFile(file, "utf8");
  const limits = smallLimits();
  await writeFile(file, "{ not json", "utf8");
  const { value, logged } = await quietly(async () => {
    const answers = [];
    for (let index = 0; index < 5; index += 1) {
      answers.push(await replyToPostWithinLimits(id, hello, "someone", limits, file, noon));
    }
    return answers;
  });
  expect(value.map((answer) => answer.status)).toEqual(["failed", "failed", "failed", "failed", "failed"]);
  expect(logged.length).toBe(5);
  await writeFile(file, good, "utf8");
  expect(await replyToPostWithinLimits(id, hello, "someone", limits, file, noon)).toEqual({ status: "sent" });
});

// ---------- what a limited visitor gets

test("a visitor with no place left is refused before the file is opened, and nothing is changed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await replyToPostWithinLimits(id, hello, "someone", limits, file, noon);
  }
  const before = await readFile(file, "utf8");
  const refused = { status: "limited", minutes: 10 };
  expect(await replyToPostWithinLimits(id, hello, "someone", limits, file, noon)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
  // A folder in place of the file would give "failed" if it were opened.
  const folder = await makeFolder();
  expect(await replyToPostWithinLimits(id, hello, "someone", limits, folder, noon)).toEqual(refused);
});

test("a limited visitor can reply again when the time has passed, and another visitor is never held back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 4; index += 1) {
    await replyToPostWithinLimits(id, hello, "noisy", limits, file, noon);
  }
  expect((await replyToPostWithinLimits(id, hello, "noisy", limits, file, after(9))).status).toBe("limited");
  expect((await replyToPostWithinLimits(id, hello, "quiet", limits, file, after(9))).status).toBe("sent");
  expect((await replyToPostWithinLimits(id, hello, "noisy", limits, file, after(10))).status).toBe("sent");
});

test("replies sent at the same moment cannot all slip through", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  const answers = await Promise.all(
    Array.from({ length: 20 }, () => replyToPostWithinLimits(id, hello, "someone", limits, file, noon)),
  );
  expect(answers.filter((answer) => answer.status === "sent").length).toBe(3);
  expect(answers.filter((answer) => answer.status === "limited").length).toBe(17);
  const saved = JSON.parse(await readFile(file, "utf8")).posts[0].replies;
  expect(saved.length).toBe(3);
});

test("the file and the time are handed on to the logic", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  await replyToPostWithinLimits(id, hello, "someone", limits, file, after(7));
  const saved = JSON.parse(await readFile(file, "utf8")).posts[0].replies;
  expect(saved).toEqual([{ message: hello.message, at: after(7).toISOString() }]);
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  const file = join(await makeFolder(), "posts.json");
  const id = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await replyToPostWithinLimits(id, hello, "someone", limits, file, noon);
  }
  const refused = await replyToPostWithinLimits(id, hello, "someone", limits, file, noon);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
