import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  createPostLimits,
  defaultPostLimitSettings,
  readPostLimitSettings,
  savePostWithinLimits,
  visitorKey,
  type HeaderReader,
} from "@/lib/post-limits";
import { readPosts, savedPostsLimit } from "@/lib/post-store";

// These tests write real files, in a folder inside node_modules that git and
// the test watcher ignore. They remove it afterwards.
const testRoot = join(process.cwd(), "node_modules", ".cache", "post-store-tests");
const madeFolders: string[] = [];

async function makeFolder(): Promise<string> {
  await mkdir(testRoot, { recursive: true });
  const folder = await mkdtemp(join(testRoot, "limits-"));
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
const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;

const good = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

// Headers that answer like the real ones: a text, or null when it is not there.
function headersOf(values: Record<string, string>): HeaderReader {
  return {
    get: (name) => {
      const value = values[name];
      return typeof value === "string" ? value : null;
    },
  };
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

// ---------- who the visitor is

test("without any header, all visitors count as one", () => {
  expect(visitorKey(headersOf({}))).toBe("unknown");
});

test("uses the address in x-forwarded-for", () => {
  expect(visitorKey(headersOf({ "x-forwarded-for": "203.0.113.7" }))).toBe(
    "203.0.113.7",
  );
});

test("with a list, uses the last address, which the nearest proxy wrote", () => {
  const key = visitorKey(
    headersOf({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.9" }),
  );
  expect(key).toBe("203.0.113.9");
});

test("empty entries at the end of the list are skipped", () => {
  const key = visitorKey(
    headersOf({ "x-forwarded-for": "1.1.1.1, 203.0.113.9, ,  ," }),
  );
  expect(key).toBe("203.0.113.9");
});

test("a list with only blanks falls back to x-real-ip", () => {
  const key = visitorKey(
    headersOf({ "x-forwarded-for": " , ", "x-real-ip": "198.51.100.4" }),
  );
  expect(key).toBe("198.51.100.4");
});

test("uses x-real-ip when there is no x-forwarded-for", () => {
  expect(visitorKey(headersOf({ "x-real-ip": "198.51.100.4" }))).toBe(
    "198.51.100.4",
  );
});

test("x-forwarded-for is used before x-real-ip", () => {
  const key = visitorKey(
    headersOf({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" }),
  );
  expect(key).toBe("203.0.113.7");
});

test("spaces and capital letters are cleaned away", () => {
  expect(visitorKey(headersOf({ "x-forwarded-for": "  2001:DB8::1 " }))).toBe(
    "2001:db8::1",
  );
});

test("a very long value is cut, so the memory cannot be filled by one header", () => {
  const key = visitorKey(headersOf({ "x-forwarded-for": "a".repeat(5000) }));
  expect(key.length).toBe(64);
});

test("blank headers give the shared key", () => {
  expect(visitorKey(headersOf({ "x-forwarded-for": "   ", "x-real-ip": " " }))).toBe(
    "unknown",
  );
});

// ---------- the numbers

test("the default is 5 posts an hour for a visitor and 60 for the whole site", () => {
  expect(defaultPostLimitSettings).toEqual({ perVisitor: 5, perSite: 60 });
  expect(readPostLimitSettings({})).toEqual({
    settings: { perVisitor: 5, perSite: 60 },
    warnings: [],
  });
});

test("the numbers can be set with POSTS_PER_HOUR and POSTS_PER_HOUR_SITE", () => {
  const read = readPostLimitSettings({
    POSTS_PER_HOUR: " 7 ",
    POSTS_PER_HOUR_SITE: "70",
  });
  expect(read.settings).toEqual({ perVisitor: 7, perSite: 70 });
  expect(read.warnings.length).toBe(0);
});

test("1 and 1000 are allowed", () => {
  const read = readPostLimitSettings({
    POSTS_PER_HOUR: "1",
    POSTS_PER_HOUR_SITE: "1000",
  });
  expect(read.settings).toEqual({ perVisitor: 1, perSite: 1000 });
});

test("an empty value is the same as not set, without a warning", () => {
  const read = readPostLimitSettings({ POSTS_PER_HOUR: "", POSTS_PER_HOUR_SITE: "  " });
  expect(read.settings).toEqual({ perVisitor: 5, perSite: 60 });
  expect(read.warnings.length).toBe(0);
});

test("a wrong value is not used, and the warning names it", () => {
  for (const value of ["0", "-1", "1.5", "abc", "1001", "5 posts", "1e2", "0x10"]) {
    const read = readPostLimitSettings({ POSTS_PER_HOUR: value });
    expect(read.settings.perVisitor).toBe(5);
    expect(read.warnings.length).toBe(1);
    expect(read.warnings[0]).toContain("POSTS_PER_HOUR must be a whole number");
  }
  const site = readPostLimitSettings({ POSTS_PER_HOUR_SITE: "lots" });
  expect(site.settings.perSite).toBe(60);
  expect(site.warnings[0]).toContain("POSTS_PER_HOUR_SITE must be");
});

test("one wrong value does not change the other one", () => {
  const read = readPostLimitSettings({
    POSTS_PER_HOUR: "nope",
    POSTS_PER_HOUR_SITE: "90",
  });
  expect(read.settings).toEqual({ perVisitor: 5, perSite: 90 });
});

// ---------- the two counters

test("a visitor can take places up to the limit, then is told how long to wait", () => {
  const limits = createPostLimits({ perVisitor: 2, perSite: 100 });
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("a", noon).ok).toBe(true);
  const refused = limits.take("a", noon);
  expect(refused.ok).toBe(false);
  expect(refused.ok ? 0 : refused.minutes).toBe(60);
});

test("the minutes are rounded up and are never less than one", () => {
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  limits.take("a", noon);
  const long = limits.take("a", new Date(noon.getTime() + oneHour - 61 * 1000));
  const short = limits.take("a", new Date(noon.getTime() + oneHour - 1));
  expect(long.ok ? 0 : long.minutes).toBe(2);
  expect(short.ok ? 0 : short.minutes).toBe(1);
});

test("visitors are counted apart", () => {
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("a", noon).ok).toBe(false);
  expect(limits.take("b", noon).ok).toBe(true);
});

test("the whole site has a limit too, whoever the visitors are", () => {
  const limits = createPostLimits({ perVisitor: 5, perSite: 3 });
  expect(limits.take("a", noon).ok).toBe(true);
  expect(limits.take("b", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(true);
  const refused = limits.take("d", noon);
  expect(refused.ok).toBe(false);
  expect(refused.ok ? 0 : refused.minutes).toBe(60);
});

test("when the site limit refuses, the visitor keeps their own place", () => {
  const limits = createPostLimits({ perVisitor: 1, perSite: 1 });
  const first = limits.take("a", noon);
  expect(limits.take("b", noon).ok).toBe(false);
  if (first.ok) first.permit.refund();
  expect(limits.take("b", noon).ok).toBe(true);
});

test("a refund gives back the place of the visitor and the place of the site", () => {
  const limits = createPostLimits({ perVisitor: 1, perSite: 1 });
  const first = limits.take("a", noon);
  expect(limits.take("a", noon).ok).toBe(false);
  if (first.ok) first.permit.refund();
  expect(limits.take("a", noon).ok).toBe(true);
});

test("a visitor who is blocked does not use up the places of the site", () => {
  const limits = createPostLimits({ perVisitor: 1, perSite: 2 });
  expect(limits.take("a", noon).ok).toBe(true);
  for (let index = 0; index < 20; index += 1) {
    expect(limits.take("a", noon).ok).toBe(false);
  }
  expect(limits.take("b", noon).ok).toBe(true);
  expect(limits.take("c", noon).ok).toBe(false);
});

// ---------- saving, with the limits

test("a post is saved when the visitor has a place", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 2, perSite: 100 });
  const result = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(result.status).toBe("saved");
  expect((await readPosts(file, noon)).length).toBe(1);
});

test("after the limit the post is refused with the time to wait, and nothing is written", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 2, perSite: 100 });
  const statuses: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    statuses.push((await savePostWithinLimits(good, "a", limits, file, noon)).status);
  }
  const third = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(statuses).toEqual(["saved", "saved"]);
  expect(third).toEqual({ status: "limited", minutes: 60 });
  expect((await readPosts(file, noon)).length).toBe(2);
});

test("another visitor can still post when one is blocked", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  await savePostWithinLimits(good, "a", limits, file, noon);
  const blocked = await savePostWithinLimits(good, "a", limits, file, noon);
  const other = await savePostWithinLimits(good, "b", limits, file, noon);
  expect(blocked.status).toBe("limited");
  expect(other.status).toBe("saved");
});

test("a post that fails the checks does not use a place", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  for (let index = 0; index < 5; index += 1) {
    const refused = await savePostWithinLimits({}, "a", limits, file, noon);
    expect(refused.status).toBe("invalid");
  }
  const result = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(result.status).toBe("saved");
});

test("a post that cannot be written does not use a place", async () => {
  const folder = await makeFolder();
  const damaged = join(folder, "damaged.json");
  await writeFile(damaged, "nope", "utf8");
  const file = join(folder, "posts.json");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  const first = await quietly(() => savePostWithinLimits(good, "a", limits, damaged, noon));
  expect(first.value.status).toBe("failed");
  const second = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(second.status).toBe("saved");
});

test("a full board does not use a place", async () => {
  const folder = await makeFolder();
  const full = join(folder, "full.json");
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
  await writeFile(full, text, "utf8");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  const refused = await savePostWithinLimits(good, "a", limits, full, noon);
  expect(refused).toEqual({ status: "full" });
  const file = join(folder, "posts.json");
  const result = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(result.status).toBe("saved");
  expect(await readFile(full, "utf8")).toBe(text);
});

test("posts sent at the same moment are counted exactly, none slips through", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 5, perSite: 100 });
  const results = await Promise.all(
    Array.from({ length: 8 }, () => savePostWithinLimits(good, "a", limits, file, noon)),
  );
  expect(results.filter((result) => result.status === "saved").length).toBe(5);
  expect(results.filter((result) => result.status === "limited").length).toBe(3);
  expect((await readPosts(file, noon)).length).toBe(5);
});

test("after an hour the visitor can post again", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  const later = new Date(noon.getTime() + oneHour);
  expect((await savePostWithinLimits(good, "a", limits, file, noon)).status).toBe("saved");
  expect(
    (await savePostWithinLimits(good, "a", limits, file, new Date(noon.getTime() + oneMinute))).status,
  ).toBe("limited");
  expect((await savePostWithinLimits(good, "a", limits, file, later)).status).toBe("saved");
});

test("an answer that says the visitor must wait can travel as plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const limits = createPostLimits({ perVisitor: 1, perSite: 100 });
  await savePostWithinLimits(good, "a", limits, file, noon);
  const refused = await savePostWithinLimits(good, "a", limits, file, noon);
  expect(JSON.parse(JSON.stringify(refused))).toEqual(refused);
  expect(Object.keys(refused).sort()).toEqual(["minutes", "status"]);
  expect(JSON.stringify(refused)).not.toContain("posts.json");
});
