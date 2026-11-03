import { join } from "node:path";
import { expect, test } from "vitest";
import { createManageKey } from "@/lib/manage-key";
import {
  changeOwnPostStatusFromInput,
  checkOwnPostFromInput,
  type ManageAnswer,
} from "@/lib/manage-post";
import { addReport } from "@/lib/post-store";
import { savePostFromInput } from "@/lib/save-post";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("manage-reports-");

const noon = new Date(2026, 9, 25, 12, 0, 0);

const good = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

// Saves a post through the same path the form uses, and gives back what the
// author gets: the id and the secret key.
async function saveGood(file: string, title: string = good.title) {
  const result = await savePostFromInput({ ...good, title }, file, noon);
  if (result.status === "saved") {
    return { id: result.post.id, key: result.manageKey };
  }
  throw new Error("The test post was not saved.");
}

// The answer of a link that fits, or an error that stops the test.
function fitting(answer: ManageAnswer) {
  if (answer.status === "ok") return answer;
  throw new Error("The link should fit.");
}

test("the check answer tells the author what visitors reported", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await addReport(id, "scam", file, noon);
  await addReport(id, "private", file, noon);
  await addReport(id, "scam", file, noon);
  const answer = fitting(await checkOwnPostFromInput(id, key, file, noon));
  expect(answer.reports).toEqual({
    total: 3,
    byReason: [
      { reason: "private", count: 1 },
      { reason: "scam", count: 2 },
    ],
  });
});

test("a post that nobody reported says zero", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  const answer = fitting(await checkOwnPostFromInput(id, key, file, noon));
  expect(answer.reports).toEqual({ total: 0, byReason: [] });
});

test("a change of status answers with the counts too", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await addReport(id, "spam", file, noon);
  const answer = fitting(
    await changeOwnPostStatusFromInput(id, key, "in-progress", file, noon),
  );
  expect(answer.post.status).toBe("in-progress");
  expect(answer.reports).toEqual({
    total: 1,
    byReason: [{ reason: "spam", count: 1 }],
  });
});

test("the answer is plain data", async () => {
  const file = join(await makeFolder(), "posts.json");
  const { id, key } = await saveGood(file);
  await addReport(id, "other", file, noon);
  const answer = await checkOwnPostFromInput(id, key, file, noon);
  expect(JSON.parse(JSON.stringify(answer))).toEqual(answer);
});

test("the reports of another post are not shown", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await saveGood(file, "The first post here");
  const second = await saveGood(file, "The second post here");
  await addReport(second.id, "spam", file, noon);
  const answer = fitting(
    await checkOwnPostFromInput(first.id, first.key, file, noon),
  );
  expect(answer.reports.total).toBe(0);
});

test("a wrong key, another post's key and a post that is gone get no counts", async () => {
  const file = join(await makeFolder(), "posts.json");
  const first = await saveGood(file, "The first post here");
  const second = await saveGood(file, "The second post here");
  await addReport(first.id, "spam", file, noon);
  const refused = { status: "not-allowed" };
  expect(await checkOwnPostFromInput(first.id, createManageKey(), file, noon)).toEqual(refused);
  expect(await checkOwnPostFromInput(first.id, second.key, file, noon)).toEqual(refused);
  expect(await checkOwnPostFromInput("post-nothing", first.key, file, noon)).toEqual(refused);
  expect(await changeOwnPostStatusFromInput(first.id, createManageKey(), "done", file, noon)).toEqual(refused);
});
