import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageLimits, type ManageLimits } from "@/lib/manage-limits";
import type { ValidNewPost } from "@/lib/new-post";
import { addPost } from "@/lib/post-store";
import { renewOwnPostWithinLimits } from "@/lib/renew-own-post-limits";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("renew-own-post-limits-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const day = 24 * 60 * 60 * 1000;
const oneMinute = 60 * 1000;
const noon = new Date(2026, 9, 25, 12, 0, 0);
const wrongKey = "f".repeat(64);

function daysAfter(days: number): Date {
  return new Date(noon.getTime() + days * day);
}

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * oneMinute);
}

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string) {
  const result = await addPost(sofa, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

// The counter of the private page, small so that the tests stay short: 3 wrong
// tries in 10 minutes.
function small(): ManageLimits {
  return createManageLimits({ wrongTries: 3, windowMinutes: 10 });
}

// How many places the counter still gives to a visitor at that moment.
function placesLeft(limits: ManageLimits, visitor: string, at: Date): number {
  let allowed = 0;
  for (let index = 0; index < 50; index += 1) {
    if (limits.take(visitor, at).ok) allowed += 1;
  }
  return allowed;
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

test("a try with the right key is free: it can be made again and again without using a place", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  for (let index = 0; index < 12; index += 1) {
    const answer = await renewOwnPostWithinLimits(id, key, "someone", limits, file, daysAfter(10));
    expect(answer.status).toBe("ok");
  }
  expect(placesLeft(limits, "someone", daysAfter(10))).toBe(3);
});

test("pressing the button many times writes the time once: the later presses read the file and write nothing", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  await renewOwnPostWithinLimits(id, key, "someone", limits, file, daysAfter(10));
  const after = await readFile(file, "utf8");
  for (let index = 1; index <= 10; index += 1) {
    await renewOwnPostWithinLimits(id, key, "someone", limits, file, minutesAfter(daysAfter(10), index * 60));
  }
  expect(await readFile(file, "utf8")).toBe(after);
  expect(JSON.parse(after).posts[0].renewedAt).toBe(daysAfter(10).toISOString());
});

test("a wrong key uses a place, and the fourth wrong try is limited", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id } = await save(file);
  const limits = small();
  for (let index = 0; index < 3; index += 1) {
    expect(await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10))).toEqual({ status: "not-allowed" });
  }
  expect(await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10))).toEqual({
    status: "limited",
    minutes: 10,
  });
});

test("an unknown post, and an id or a key of the wrong shape, count as wrong tries too", async () => {
  const file = join(await makeFolder(), "posts.json");
  await save(file);
  const limits = small();
  const refused = { status: "not-allowed" };
  expect(await renewOwnPostWithinLimits(undefined, undefined, "someone", limits, file, daysAfter(10))).toEqual(refused);
  expect(await renewOwnPostWithinLimits("sample-1", wrongKey, "someone", limits, file, daysAfter(10))).toEqual(refused);
  expect(await renewOwnPostWithinLimits("post-nothing", wrongKey, "someone", limits, file, daysAfter(10))).toEqual(refused);
  expect(placesLeft(limits, "someone", daysAfter(10))).toBe(0);
});

test("a visitor with no place left is stopped before anything is read, also with the right key", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  for (let index = 0; index < 3; index += 1) {
    await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10));
  }
  const before = await readFile(file, "utf8");
  const refused = { status: "limited", minutes: 10 };
  expect(await renewOwnPostWithinLimits(id, key, "someone", limits, file, daysAfter(10))).toEqual(refused);
  // A folder in place of the file would give "failed" if it were opened.
  const folder = await makeFolder();
  expect(await renewOwnPostWithinLimits(id, key, "someone", limits, folder, daysAfter(10))).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
  expect(JSON.parse(before).posts[0].renewedAt).toBe(undefined);
});

test("the wait gets shorter as time passes, and a limited visitor can try again when it is over", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  const start = daysAfter(10);
  for (let index = 0; index < 3; index += 1) {
    await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, start);
  }
  expect(await renewOwnPostWithinLimits(id, key, "someone", limits, file, minutesAfter(start, 4))).toEqual({ status: "limited", minutes: 6 });
  const later = await renewOwnPostWithinLimits(id, key, "someone", limits, file, minutesAfter(start, 10));
  expect(later.status).toBe("ok");
  expect(JSON.parse(await readFile(file, "utf8")).posts[0].renewedAt).toBe(minutesAfter(start, 10).toISOString());
});

test("another visitor is counted apart", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  for (let index = 0; index < 4; index += 1) {
    await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10));
  }
  const other = await renewOwnPostWithinLimits(id, key, "somebody else", limits, file, daysAfter(10));
  expect(other.status).toBe("ok");
});

test("a try that fails on our side gives its place back", async () => {
  const folder = await makeFolder();
  const file = join(folder, "posts.json");
  await writeFile(file, "{ not json", "utf8");
  const limits = small();
  const key = "ab".repeat(32);
  for (let index = 0; index < 8; index += 1) {
    const answer = await quietly(() => renewOwnPostWithinLimits("post-a", key, "someone", limits, file, daysAfter(10)));
    expect(answer).toEqual({ status: "failed" });
  }
  expect(placesLeft(limits, "someone", daysAfter(10))).toBe(3);
});

test("the answers are plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const limits = small();
  const answers = [
    await renewOwnPostWithinLimits(id, key, "someone", limits, file, daysAfter(10)),
    await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10)),
  ];
  for (let index = 0; index < 3; index += 1) {
    answers.push(await renewOwnPostWithinLimits(id, wrongKey, "someone", limits, file, daysAfter(10)));
  }
  expect(answers.map((answer) => answer.status)).toEqual(["ok", "not-allowed", "not-allowed", "not-allowed", "limited"]);
  for (const answer of answers) {
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  }
});
