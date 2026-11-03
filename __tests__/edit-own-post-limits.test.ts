import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  createEditLimits,
  defaultEditLimitSettings,
  editOwnPostWithinLimits,
  type EditLimits,
} from "@/lib/edit-own-post-limits";
import { createManageLimits, type ManageLimits } from "@/lib/manage-limits";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost } from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("edit-own-post-limits-");

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

const wrongKey = "f".repeat(64);

function words(number: number) {
  return {
    title: `Help moving a sofa, try ${number}`,
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
  };
}

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string) {
  const result = await addPost(sofa, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

// The two counters, small so that the tests stay short: 3 wrong tries in 10
// minutes, and 2 edits in an hour.
function small(): { wrong: ManageLimits; edits: EditLimits } {
  return {
    wrong: createManageLimits({ wrongTries: 3, windowMinutes: 10 }),
    edits: createEditLimits({ edits: 2, windowMinutes: 60 }),
  };
}

// How many places a counter still gives to a visitor at that moment.
function placesLeft(limits: { take: (visitor: string, now: Date) => { ok: boolean } }, visitor: string, at: Date): number {
  let allowed = 0;
  for (let index = 0; index < 50; index += 1) {
    if (limits.take(visitor, at).ok) allowed += 1;
  }
  return allowed;
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

// ---------- the counter of edits

test("the default is 10 edits in an hour", () => {
  expect(defaultEditLimitSettings).toEqual({ edits: 10, windowMinutes: 60 });
  const limits = createEditLimits();
  expect(placesLeft(limits, "someone", noon)).toBe(10);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 60 });
});

test("numbers that make no sense are refused when the counter is made", () => {
  expect(() => createEditLimits({ edits: 0, windowMinutes: 10 })).toThrow("whole number");
  expect(() => createEditLimits({ edits: 3, windowMinutes: 0 })).toThrow("whole number");
  expect(() => createEditLimits(defaultEditLimitSettings, 0)).toThrow("whole number");
});

test("the wait is told in whole minutes, rounded up, and gets shorter as time passes", () => {
  const limits = createEditLimits({ edits: 3, windowMinutes: 10 });
  for (let index = 0; index < 3; index += 1) limits.take("someone", noon);
  expect(limits.take("someone", noon)).toEqual({ ok: false, minutes: 10 });
  expect(limits.take("someone", after(4, 30))).toEqual({ ok: false, minutes: 6 });
  expect(limits.take("someone", after(9, 59))).toEqual({ ok: false, minutes: 1 });
  expect(limits.take("someone", after(10)).ok).toBe(true);
});

test("visitors are counted apart, and only the most recent ones are remembered", () => {
  const limits = createEditLimits({ edits: 1, windowMinutes: 10 }, 2);
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("a", noon).ok).toBe(false);
  expect(limits.take("b", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(true);
  // "a" was forgotten to make room, so it starts again. "c" is still counted.
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(false);
});

// ---------- which tries use which place

test("an edit that reached the file uses an edit place and no place for wrong tries", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  const first = await editOwnPostWithinLimits(id, key, words(1), "someone", wrong, edits, file, noon);
  const second = await editOwnPostWithinLimits(id, key, words(2), "someone", wrong, edits, file, noon);
  expect(first.status).toBe("ok");
  expect(second.status).toBe("ok");
  expect(placesLeft(wrong, "someone", noon)).toBe(3);
  expect(placesLeft(edits, "someone", noon)).toBe(0);
});

test("the third edit in an hour is limited, and then the key and the file are not even looked at", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  await editOwnPostWithinLimits(id, key, words(1), "someone", wrong, edits, file, noon);
  await editOwnPostWithinLimits(id, key, words(2), "someone", wrong, edits, file, noon);
  const before = await readFile(file, "utf8");
  const refused = { status: "limited", minutes: 60 };
  expect(await editOwnPostWithinLimits(id, key, words(3), "someone", wrong, edits, file, noon)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
  // A wrong key gets the same answer, so the limit tells nothing about the key.
  expect(await editOwnPostWithinLimits(id, wrongKey, words(3), "someone", wrong, edits, file, noon)).toEqual(refused);
  // A folder in place of the file would give "failed" if it were opened.
  const folder = await makeFolder();
  expect(await editOwnPostWithinLimits(id, key, words(3), "someone", wrong, edits, folder, noon)).toEqual(refused);
  // The visitor did nothing wrong, so no place for wrong tries was lost.
  expect(placesLeft(wrong, "someone", noon)).toBe(3);
});

test("a wrong key uses a place for wrong tries and no edit place", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const { wrong, edits } = small();
  for (let index = 0; index < 3; index += 1) {
    const answer = await editOwnPostWithinLimits(id, wrongKey, words(index), "someone", wrong, edits, file, noon);
    expect(answer).toEqual({ status: "not-allowed" });
  }
  expect(placesLeft(edits, "someone", noon)).toBe(2);
  expect(await editOwnPostWithinLimits(id, wrongKey, words(4), "someone", wrong, edits, file, noon)).toEqual({
    status: "limited",
    minutes: 10,
  });
});

test("an id or a key of the wrong shape counts as a wrong try too", async () => {
  const folder = await makeFolder();
  const { wrong, edits } = small();
  for (let index = 0; index < 3; index += 1) {
    const answer = await editOwnPostWithinLimits(undefined, undefined, words(index), "someone", wrong, edits, folder, noon);
    expect(answer).toEqual({ status: "not-allowed" });
  }
  const fourth = await editOwnPostWithinLimits(undefined, undefined, words(4), "someone", wrong, edits, folder, noon);
  expect(fourth).toEqual({ status: "limited", minutes: 10 });
  expect(placesLeft(edits, "someone", noon)).toBe(2);
});

test("a visitor with no place for wrong tries left is stopped before anything is read, also with the right key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  for (let index = 0; index < 3; index += 1) {
    await editOwnPostWithinLimits(id, wrongKey, words(index), "someone", wrong, edits, file, noon);
  }
  const before = await readFile(file, "utf8");
  const refused = { status: "limited", minutes: 10 };
  expect(await editOwnPostWithinLimits(id, key, words(5), "someone", wrong, edits, file, noon)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
  expect(placesLeft(edits, "someone", noon)).toBe(2);
});

test("texts that do not pass the checks use no place at all", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  for (let index = 0; index < 6; index += 1) {
    const answer = await editOwnPostWithinLimits(id, key, { title: "Hi", details: "", area: "Olive Street 12" }, "someone", wrong, edits, file, noon);
    expect(answer.status).toBe("invalid");
  }
  expect(placesLeft(wrong, "someone", noon)).toBe(3);
  expect(placesLeft(edits, "someone", noon)).toBe(2);
});

test("a try that fails on our side gives back both places", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const good = await readFile(file, "utf8");
  const { wrong, edits } = small();
  await writeFile(file, "{ not json", "utf8");
  const { value, logged } = await quietly(async () => {
    const answers = [];
    for (let index = 0; index < 5; index += 1) {
      answers.push(await editOwnPostWithinLimits(id, key, words(index), "someone", wrong, edits, file, noon));
    }
    return answers;
  });
  expect(value.map((answer) => answer.status)).toEqual(["failed", "failed", "failed", "failed", "failed"]);
  expect(logged.length).toBe(5);
  expect(placesLeft(wrong, "someone", noon)).toBe(3);
  expect(placesLeft(edits, "someone", noon)).toBe(2);
  await writeFile(file, good, "utf8");
  const again = small();
  expect((await editOwnPostWithinLimits(id, key, words(9), "someone", again.wrong, again.edits, file, noon)).status).toBe("ok");
});

test("an edit that changes nothing still uses an edit place, because the file was read", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  const same = { title: sofa.title, details: sofa.details, area: sofa.area };
  expect((await editOwnPostWithinLimits(id, key, same, "someone", wrong, edits, file, noon)).status).toBe("ok");
  expect((await editOwnPostWithinLimits(id, key, same, "someone", wrong, edits, file, noon)).status).toBe("ok");
  expect((await editOwnPostWithinLimits(id, key, same, "someone", wrong, edits, file, noon)).status).toBe("limited");
});

// ---------- visitors, time and the same moment

test("the tries of one visitor never hold back another visitor", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  for (let index = 0; index < 6; index += 1) {
    await editOwnPostWithinLimits(id, wrongKey, words(index), "noisy", wrong, edits, file, noon);
  }
  expect((await editOwnPostWithinLimits(id, key, words(1), "noisy", wrong, edits, file, noon)).status).toBe("limited");
  expect((await editOwnPostWithinLimits(id, key, words(2), "quiet", wrong, edits, file, noon)).status).toBe("ok");
});

test("a limited visitor can edit again when the time has passed", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  await editOwnPostWithinLimits(id, key, words(1), "someone", wrong, edits, file, noon);
  await editOwnPostWithinLimits(id, key, words(2), "someone", wrong, edits, file, noon);
  expect((await editOwnPostWithinLimits(id, key, words(3), "someone", wrong, edits, file, after(59))).status).toBe("limited");
  const next = await editOwnPostWithinLimits(id, key, words(3), "someone", wrong, edits, file, after(60));
  expect(next.status).toBe("ok");
  const saved = JSON.parse(await readFile(file, "utf8")).posts[0];
  expect(saved.title).toBe(words(3).title);
  expect(saved.editedAt).toBe(after(60).toISOString());
});

test("edits sent at the same moment cannot all slip through", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  const answers = await Promise.all(
    Array.from({ length: 20 }, (_, index) => editOwnPostWithinLimits(id, key, words(index), "someone", wrong, edits, file, noon)),
  );
  expect(answers.filter((answer) => answer.status === "ok").length).toBe(2);
  expect(answers.filter((answer) => answer.status === "limited").length).toBe(18);
  expect(placesLeft(wrong, "someone", noon)).toBe(3);
  const saved = JSON.parse(await readFile(file, "utf8")).posts;
  expect(saved.length).toBe(1);
});

test("the file and the time are handed on to the logic", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  await editOwnPostWithinLimits(id, key, words(1), "someone", wrong, edits, file, after(7));
  const saved = JSON.parse(await readFile(file, "utf8")).posts[0];
  expect(saved.title).toBe(words(1).title);
  expect(saved.editedAt).toBe(after(7).toISOString());
});

test("the answer to a limited visitor is plain data with two fields", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const { wrong, edits } = small();
  for (let index = 0; index < 2; index += 1) {
    await editOwnPostWithinLimits(id, key, words(index), "someone", wrong, edits, file, noon);
  }
  const refused = await editOwnPostWithinLimits(id, key, words(3), "someone", wrong, edits, file, noon);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
});
