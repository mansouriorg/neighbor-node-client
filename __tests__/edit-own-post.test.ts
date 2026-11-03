import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { editOwnPostFromInput } from "@/lib/edit-own-post";
import { validateEditedPost } from "@/lib/edit-post";
import type { ValidNewPost } from "@/lib/new-post";
import {
  addPost,
  addReport,
  readPosts,
  removeOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("edit-own-post-");

const sofa: ValidNewPost = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

const changed = {
  title: "Help moving a sofa and a table",
  details: "Saturday afternoon now, three people, about two hours.",
  area: "Olive Street and Fig Lane",
};

const noon = new Date(2026, 9, 25, 12, 0, 0);
const nextDay = new Date(2026, 9, 26, 9, 30, 0);
const later = new Date(2026, 9, 28, 18, 0, 0);
const wrongKey = "f".repeat(64);

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

test("an edit with the right key saves the three texts and gives back the post with its labels and the counts of its reports", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await addReport(id, "spam", file, nextDay);
  const answer = await editOwnPostFromInput(id, key, changed, file, nextDay);
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") {
    expect(answer.post).toEqual({
      id,
      kind: "help",
      ...changed,
      status: "open",
      postedLabel: "Yesterday",
      editedLabel: "Edited today",
      keep: { state: "shown", daysLeft: 30 },
    });
    expect(answer.reports.total).toBe(1);
  }
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(changed.title);
  expect(saved.details).toBe(changed.details);
  expect(saved.area).toBe(changed.area);
  expect(saved.editedAt).toBe(nextDay.toISOString());
});

test("the texts are saved without the spaces around them", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const padded = { title: `  ${changed.title} `, details: `\n${changed.details}  `, area: ` ${changed.area}` };
  expect((await editOwnPostFromInput(id, key, padded, file, nextDay)).status).toBe("ok");
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(changed.title);
  expect(saved.details).toBe(changed.details);
  expect(saved.area).toBe(changed.area);
});

test("only the three texts of the form are used, so nobody can choose a status, a kind, a time or another post", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await save(file, "The second post here");
  const before = (await rawPosts(file))[0];
  const sneaky = {
    ...changed,
    id: "post-other",
    kind: "lend",
    status: "done",
    createdAt: "1999-01-01T00:00:00.000Z",
    editedAt: "1999-01-01T00:00:00.000Z",
    removedAt: "1999-01-01T00:00:00.000Z",
    manageKeyHash: "0".repeat(64),
    reports: [{ reason: "spam", at: "1999-01-01T00:00:00.000Z" }],
    replies: [{ message: "A reply that was never sent.", at: "1999-01-01T00:00:00.000Z" }],
  };
  expect((await editOwnPostFromInput(id, key, sneaky, file, nextDay)).status).toBe("ok");
  const saved = await rawPosts(file);
  expect(saved.length).toBe(2);
  expect(saved[0]).toEqual({ ...before, ...changed, editedAt: nextDay.toISOString() });
  expect(saved[1].title).toBe("The second post here");
});

test("a field that is not text counts as empty, and says so like any empty field", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const before = await readFile(file, "utf8");
  const answer = await editOwnPostFromInput(id, key, { title: 5, details: { a: 1 }, area: ["Olive Street"] }, file, nextDay);
  const empty = validateEditedPost({ title: "", details: "", area: "" });
  expect(empty.ok).toBe(false);
  if (empty.ok === false) expect(answer).toEqual({ status: "invalid", errors: empty.errors });
  expect(await readFile(file, "utf8")).toBe(before);
});

test("any kind of input is answered, never thrown at, and nothing is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const before = await readFile(file, "utf8");
  const inputs: unknown[] = [undefined, null, 42, "a text", true, [], ["Hello there."], () => "x", Symbol("s")];
  for (const input of inputs) {
    const answer = await editOwnPostFromInput(id, key, input, file, nextDay);
    expect(answer.status).toBe("invalid");
    if (answer.status === "invalid") expect(Object.keys(answer.errors)).toEqual(["title", "details", "area"]);
  }
  expect(await readFile(file, "utf8")).toBe(before);
});

test("texts that do not pass get the messages of the check, and nothing is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const before = await readFile(file, "utf8");
  const bad = { title: "Hi", details: "Too short", area: "Olive Street 12" };
  const answer = await editOwnPostFromInput(id, key, bad, file, nextDay);
  const expected = validateEditedPost(bad);
  expect(expected.ok).toBe(false);
  if (expected.ok === false) expect(answer).toEqual({ status: "invalid", errors: expected.errors });
  if (answer.status === "invalid") expect(Object.keys(answer.errors)).toEqual(["title", "details", "area"]);
  const onlyArea = await editOwnPostFromInput(id, key, { ...changed, area: "Olive Street 12" }, file, nextDay);
  expect(onlyArea.status).toBe("invalid");
  if (onlyArea.status === "invalid") expect(Object.keys(onlyArea.errors)).toEqual(["area"]);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("the checks of the texts come before the file is opened", async () => {
  // The "file" is a folder. Opening it would fail, and the answer would be "failed".
  const folder = await makeFolder();
  const answer = await editOwnPostFromInput("post-a", wrongKey, { title: "", details: "", area: "" }, folder, nextDay);
  expect(answer.status).toBe("invalid");
});

test("an id or a key of the wrong shape is not allowed, before the file is opened", async () => {
  const folder = await makeFolder();
  const wrongIds: unknown[] = [undefined, null, 42, {}, ["post-a"], "", "sample-1", "post-", `post-${"a".repeat(65)}`, "post-a b", "../post-a"];
  for (const id of wrongIds) {
    expect(await editOwnPostFromInput(id, wrongKey, changed, folder, nextDay)).toEqual({ status: "not-allowed" });
  }
  const wrongKeys: unknown[] = [undefined, null, 5, {}, [wrongKey], "", "f".repeat(63), "f".repeat(65), "g".repeat(64), ` ${"f".repeat(63)}`];
  for (const key of wrongKeys) {
    expect(await editOwnPostFromInput("post-a", key, changed, folder, nextDay)).toEqual({ status: "not-allowed" });
  }
});

test("a wrong key, an unknown post and a post that was taken down are not allowed, and nothing is saved", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await save(file);
  const gone = await save(file, "The second post here");
  await removeOwnPost(gone.id, gone.key, file, nextDay);
  const before = await readFile(file, "utf8");
  const refused = { status: "not-allowed" };
  expect(await editOwnPostFromInput(first.id, wrongKey, changed, file, later)).toEqual(refused);
  expect(await editOwnPostFromInput("post-nothing", first.key, changed, file, later)).toEqual(refused);
  expect(await editOwnPostFromInput(gone.id, gone.key, changed, file, later)).toEqual(refused);
  expect(await editOwnPostFromInput(gone.id, first.key, changed, file, later)).toEqual(refused);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("the same texts again are fine, write nothing and carry no label", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const before = await readFile(file, "utf8");
  const answer = await editOwnPostFromInput(id, key, sofa, file, nextDay);
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect("editedLabel" in answer.post).toBe(false);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("a post that is done can be edited, and it stays done", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await updateOwnPostStatus(id, key, "done", file, nextDay);
  const answer = await editOwnPostFromInput(id, key, changed, file, later);
  expect(answer.status).toBe("ok");
  if (answer.status === "ok") expect(answer.post.status).toBe("done");
  expect((await rawPosts(file))[0].title).toBe(changed.title);
});

test("the key works again after an edit, and a second edit moves the time", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  expect((await editOwnPostFromInput(id, key, changed, file, nextDay)).status).toBe("ok");
  const newest = { ...changed, title: "The sofa is gone, a table is left" };
  expect((await editOwnPostFromInput(id, key, newest, file, later)).status).toBe("ok");
  const saved = (await rawPosts(file))[0];
  expect(saved.title).toBe(newest.title);
  expect(saved.editedAt).toBe(later.toISOString());
});

test("everyone sees the new texts and the label on the board", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  await editOwnPostFromInput(id, key, changed, file, nextDay);
  const posts = await readPosts(file, nextDay);
  expect(posts.length).toBe(1);
  expect(posts[0].title).toBe(changed.title);
  expect(posts[0].area).toBe(changed.area);
  expect(posts[0].editedLabel).toBe("Edited today");
});

test("a file that cannot be read gives a plain failure, and the log has the cause but not the words of the post", async () => {
  const file = join(await makeFolder(), "posts.json");
  await writeFile(file, "{ not json", "utf8");
  const secret = { title: "A title that must not be logged", details: "Details that must not be logged either.", area: "Secret Lane" };
  const { value, logged } = await quietly(() => editOwnPostFromInput("post-a", wrongKey, secret, file, nextDay));
  expect(value).toEqual({ status: "failed" });
  expect(logged.length).toBe(1);
  // Everything that was logged, also the inside of objects, as one text.
  const show = (part: unknown) => (typeof part === "string" || part instanceof Error ? String(part) : JSON.stringify(part));
  const text = logged.map((args) => args.map(show).join(" ")).join("\n");
  expect(text).toContain("Editing a post failed");
  expect(text).toContain("not valid JSON");
  expect(text).not.toContain("must not be logged");
  expect(text).not.toContain("Secret Lane");
  expect(await readFile(file, "utf8")).toBe("{ not json");
});

test("the answers are plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await save(file);
  const answers = [
    await editOwnPostFromInput(id, key, changed, file, nextDay),
    await editOwnPostFromInput(id, key, {}, file, nextDay),
    await editOwnPostFromInput(id, wrongKey, changed, file, nextDay),
    await editOwnPostFromInput("nope", key, changed, file, nextDay),
  ];
  expect(answers.map((answer) => answer.status)).toEqual(["ok", "invalid", "not-allowed", "not-allowed"]);
  for (const answer of answers) {
    expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
  }
});
