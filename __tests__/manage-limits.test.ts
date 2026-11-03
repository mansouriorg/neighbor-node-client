import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey } from "@/lib/manage-key";
import {
  changeOwnPostStatusWithinLimits,
  checkOwnPostWithinLimits,
  createManageLimits,
  defaultManageLimitSettings,
  removeOwnPostWithinLimits,
  type ManageLimits,
} from "@/lib/manage-limits";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost, readPosts } from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("manage-limits-");

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

const wrongKey = "f".repeat(64);
const notAllowed = { status: "not-allowed" };

// ---------- the counter

test("the default is 10 wrong tries in 10 minutes", () => {
  expect(defaultManageLimitSettings).toEqual({ wrongTries: 10, windowMinutes: 10 });
  const limits = createManageLimits();
  let allowed = 0;
  for (let index = 0; index < 15; index += 1) {
    if (limits.take("someone", noon).ok) allowed += 1;
  }
  expect(allowed).toBe(10);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 10 });
});

test("numbers that make no sense are refused when the counter is made", () => {
  expect(() => createManageLimits({ wrongTries: 0, windowMinutes: 10 })).toThrow("whole number");
  expect(() => createManageLimits({ wrongTries: 3, windowMinutes: 0 })).toThrow("whole number");
  expect(() => createManageLimits(defaultManageLimitSettings, 0)).toThrow("whole number");
});

test("the wait is told in whole minutes, rounded up, and gets shorter as time passes", () => {
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) limits.take("someone", noon);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 10 });
  expect(limits.take("someone", after(4, 30))).toEqual({ ok: false, minutes: 6 });
  expect(limits.take("someone", after(9, 59))).toEqual({ ok: false, minutes: 1 });
  expect(limits.take("someone", after(10)).ok).toBe(true);
});

test("visitors are counted apart", () => {
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) limits.take("first", noon);
  expect(limits.take("first", noon).ok).toBe(false);
  expect(limits.take("second", noon).ok).toBe(true);
});

test("only the most recent visitors are remembered", () => {
  const limits = createManageLimits({ wrongTries: 1, windowMinutes: 10 }, 2);
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("b", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(true);
  // "a" was forgotten to make room, so it starts again. "c" is still counted.
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(false);
});

test("by default many visitors are remembered at once, and the one unused for longest is forgotten first", () => {
  const limits = createManageLimits();
  for (let visitor = 0; visitor <= 5000; visitor += 1) {
    for (let place = 0; place < 10; place += 1) limits.take(`visitor-${visitor}`, noon);
  }
  // 5001 visitors came, so the first one was forgotten and starts again.
  expect(limits.take("visitor-0", noon).ok).toBe(true);
  expect(limits.take("visitor-2", noon).ok).toBe(false);
  expect(limits.take("visitor-5000", noon).ok).toBe(false);
});

// ---------- which tries count

test("a try with the right key is never counted", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 10; index += 1) {
    const checked = await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon);
    expect(checked.status).toBe("ok");
    const changed = await changeOwnPostStatusWithinLimits(
      id,
      key,
      index % 2 === 0 ? "done" : "open",
      "someone",
      limits,
      file,
      noon,
    );
    expect(changed.status).toBe("ok");
  }
});

test("the file and the time are handed on to the logic", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  const checked = await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon);
  expect(checked.status === "ok" && checked.post.postedLabel).toBe("Today");
  const changed = await changeOwnPostStatusWithinLimits(id, key, "done", "someone", limits, file, noon);
  expect(changed.status === "ok" && changed.post.postedLabel).toBe("Today");
  expect((await readPosts(file, noon))[0].status).toBe("done");
  expect(await removeOwnPostWithinLimits(id, key, "someone", limits, file, after(5))).toEqual({ status: "removed" });
  const stored = JSON.parse(await readFile(file, "utf8")).posts[0];
  expect(stored.removedAt).toBe(after(5).toISOString());
});

test("wrong tries are answered as before, and the one after the last place is limited", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    const answer = await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
    expect(answer).toEqual(notAllowed);
  }
  const fourth = await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  expect(fourth).toEqual({ status: "limited", minutes: 10 });
});

test("a key of another post, an unknown id and a made-up key all count", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  const limits = smallLimits();
  expect(await checkOwnPostWithinLimits(first.id, second.key, "someone", limits, file, noon)).toEqual(notAllowed);
  expect(await checkOwnPostWithinLimits("post-nothing", first.key, "someone", limits, file, noon)).toEqual(notAllowed);
  expect(await checkOwnPostWithinLimits(first.id, createManageKey(), "someone", limits, file, noon)).toEqual(notAllowed);
  const next = await checkOwnPostWithinLimits(first.id, first.key, "someone", limits, file, noon);
  expect(next.status).toBe("limited");
});

test("an id or a key of the wrong shape counts too", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  expect(await checkOwnPostWithinLimits(id, undefined, "someone", limits, file, noon)).toEqual(notAllowed);
  expect(await checkOwnPostWithinLimits({ not: "an id" }, key, "someone", limits, file, noon)).toEqual(notAllowed);
  expect(await removeOwnPostWithinLimits(id, "short", "someone", limits, file, noon)).toEqual(notAllowed);
  expect((await checkOwnPostWithinLimits(id, undefined, "someone", limits, file, noon)).status).toBe("limited");
});

test("the three actions share one counter", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  await changeOwnPostStatusWithinLimits(id, wrongKey, "done", "someone", limits, file, noon);
  await removeOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  expect((await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon)).status).toBe("limited");
  expect((await changeOwnPostStatusWithinLimits(id, wrongKey, "done", "someone", limits, file, noon)).status).toBe("limited");
  expect((await removeOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon)).status).toBe("limited");
});

test("a take-down with the right key is not counted, and the link of a post that is down counts as wrong", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  expect(await removeOwnPostWithinLimits(id, key, "someone", limits, file, noon)).toEqual({ status: "removed" });
  // Two places are used. The take-down gave its place back, so one is left.
  expect(await removeOwnPostWithinLimits(id, key, "someone", limits, file, noon)).toEqual(notAllowed);
  expect((await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon)).status).toBe("limited");
});

// ---------- what a limited visitor gets

test("a visitor with no place left is refused also with the right key, and nothing is read or changed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  }
  const before = await readFile(file, "utf8");
  const refused = { status: "limited", minutes: 10 };
  expect(await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon)).toEqual(refused);
  expect(await changeOwnPostStatusWithinLimits(id, key, "done", "someone", limits, file, noon)).toEqual(refused);
  expect(await removeOwnPostWithinLimits(id, key, "someone", limits, file, noon)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
  const posts = await readPosts(file, noon);
  expect(posts.length).toBe(1);
  expect(posts[0].status).toBe("open");
});

test("a limited visitor can try again when the time has passed, also with the right key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  }
  expect((await checkOwnPostWithinLimits(id, key, "someone", limits, file, after(9))).status).toBe("limited");
  expect((await checkOwnPostWithinLimits(id, key, "someone", limits, file, after(10))).status).toBe("ok");
});

test("another visitor is not held back by a limited one", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 4; index += 1) {
    await checkOwnPostWithinLimits(id, wrongKey, "noisy", limits, file, noon);
  }
  expect((await checkOwnPostWithinLimits(id, key, "noisy", limits, file, noon)).status).toBe("limited");
  expect((await checkOwnPostWithinLimits(id, key, "quiet", limits, file, noon)).status).toBe("ok");
});

test("wrong tries stop counting one by one, as their time runs out", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  async function wrong(at: Date) {
    return checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, at);
  }
  expect(await wrong(noon)).toEqual(notAllowed);
  expect(await wrong(noon)).toEqual(notAllowed);
  expect(await wrong(after(6))).toEqual(notAllowed);
  expect(await wrong(after(9))).toEqual({ status: "limited", minutes: 1 });
  // At 10 minutes the first two are over, and the one from minute 6 still counts.
  expect(await wrong(after(10))).toEqual(notAllowed);
  expect(await wrong(after(10))).toEqual(notAllowed);
  expect(await wrong(after(10))).toEqual({ status: "limited", minutes: 6 });
});

test("tries sent at the same moment cannot all slip through", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  const answers = await Promise.all(
    Array.from({ length: 20 }, () =>
      checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon),
    ),
  );
  expect(answers.filter((answer) => answer.status === "not-allowed").length).toBe(3);
  expect(answers.filter((answer) => answer.status === "limited").length).toBe(17);
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = smallLimits();
  for (let index = 0; index < 3; index += 1) {
    await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  }
  const refused = await checkOwnPostWithinLimits(id, wrongKey, "someone", limits, file, noon);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});

// ---------- trouble on our side

test("a try that fails on our side gives its place back", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const good = await readFile(file, "utf8");
  const limits = smallLimits();
  await writeFile(file, "{ not json", "utf8");
  const { value, logged } = await quietly(async () => {
    const answers = [];
    for (let index = 0; index < 5; index += 1) {
      answers.push(await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon));
    }
    return answers;
  });
  expect(value.map((answer) => answer.status)).toEqual(["failed", "failed", "failed", "failed", "failed"]);
  expect(logged.length).toBe(5);
  await writeFile(file, good, "utf8");
  expect((await checkOwnPostWithinLimits(id, key, "someone", limits, file, noon)).status).toBe("ok");
});
