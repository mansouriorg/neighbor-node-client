import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createManageKey,
  hashManageKey,
  isKeyHash,
  keyMatches,
} from "@/lib/manage-key";
import { validateEditedPost, type EditPostFields } from "@/lib/edit-post";
import { validateNewPost, type ValidNewPost } from "@/lib/new-post";
import {
  repliesKeptPerPost,
  validateNewReply,
  type ValidNewReply,
} from "@/lib/new-reply";
import { hideAfterDays, isHiddenByAge, keepOf } from "@/lib/post-age";
import { postKindIds, type PostKind } from "@/lib/post-kinds";
import { postStatusIds, type Post, type PostStatus } from "@/lib/posts";
import { reportReasonIds, type ReportReason } from "@/lib/report-reasons";
import { summarizeReports, type ReportSummary } from "@/lib/report-summary";

// Where the board keeps the posts that people wrote: one JSON file on disk.
// Only server code may use this file, because browsers cannot read disks.

// What the file holds for one post. The label ("Today", "Yesterday") is not
// stored, because it would be wrong the next day. It is worked out from
// createdAt every time the posts are read.
export type StoredPost = {
  id: string;
  kind: PostKind;
  title: string;
  details: string;
  area: string;
  status: PostStatus;
  createdAt: string;
  // When the author took the post down. A post with this field is no longer
  // shown and its private link no longer works, but its entry stays in the
  // file. A post that was never taken down has no such field.
  removedAt?: string;
  // When the author last changed the title, the details or the area. A post
  // that was never edited has no such field. The pages show it as "Edited
  // today" or "Edited 3 days ago", worked out each time a post is shown.
  editedAt?: string;
  // When the author last pressed "Keep my post up". It starts the 30 days again
  // (see lib/post-age.ts). A post where this was never pressed has no such
  // field. It is not an edit, so the pages do not show it.
  renewedAt?: string;
  // A fingerprint of the secret key in the private link of the post (see
  // lib/manage-key.ts). The key itself is never stored. A post saved before
  // private links existed has none, and cannot be changed from the site.
  manageKeyHash?: string;
  // What visitors reported about the post, the oldest first (see addReport). A
  // post that nobody reported has no such field. The pages never show it.
  reports?: StoredReport[];
  // What neighbors wrote in answer to the post, the oldest first (see
  // addReply). Only the author can read it, with the key of the private link.
  // A post that nobody replied to has no such field. The pages never show it.
  replies?: StoredReply[];
};

// One report: why the visitor reported the post, and when. Nothing about who
// the visitor is is saved.
export type StoredReport = {
  reason: ReportReason;
  at: string;
};

// One reply from a neighbor, saved with the post that it answers. Only the
// author of the post can read it (see readOwnReplies). The name and the contact
// are there only when the neighbor wrote them. Nothing else about the neighbor
// is saved.
export type StoredReply = {
  message: string;
  name?: string;
  contact?: string;
  at: string;
};

// The file looks like { "version": 1, "posts": [ ... ] }.
// The version lets a later update change the format without guessing.
export const storeVersion = 1;

// A file that grows without end would fill the disk. When the limit is
// reached, nothing more is saved until someone makes room.
export const savedPostsLimit = 500;

// A post keeps at most this many reports. A report that comes later is
// answered, but not saved: the post has more than enough already.
export const reportsKeptPerPost = 20;

export function defaultPostsFile(): string {
  return join(process.cwd(), "data", "posts.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && Array.isArray(value) === false;
}

function isDateText(value: unknown): boolean {
  return (
    typeof value === "string" && Number.isNaN(new Date(value).getTime()) === false
  );
}

function isStoredReport(value: unknown): value is StoredReport {
  return (
    isRecord(value) &&
    reportReasonIds.some((known) => known === value.reason) &&
    isDateText(value.at)
  );
}

function isReportList(value: unknown): value is StoredReport[] {
  return Array.isArray(value) && value.every(isStoredReport);
}

function isStoredReply(value: unknown): value is StoredReply {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.contact === undefined || typeof value.contact === "string") &&
    isDateText(value.at)
  );
}

function isReplyList(value: unknown): value is StoredReply[] {
  return Array.isArray(value) && value.every(isStoredReply);
}

function isStoredPost(value: unknown): value is StoredPost {
  if (isRecord(value)) {
    const {
      id,
      kind,
      title,
      details,
      area,
      status,
      createdAt,
      manageKeyHash,
      removedAt,
      editedAt,
      renewedAt,
      reports,
      replies,
    } = value;
    return (
      typeof id === "string" &&
      id.length > 0 &&
      postKindIds.some((known) => known === kind) &&
      typeof title === "string" &&
      typeof details === "string" &&
      typeof area === "string" &&
      postStatusIds.some((known) => known === status) &&
      typeof createdAt === "string" &&
      Number.isNaN(new Date(createdAt).getTime()) === false &&
      (manageKeyHash === undefined || isKeyHash(manageKeyHash)) &&
      (removedAt === undefined || isDateText(removedAt)) &&
      (editedAt === undefined || isDateText(editedAt)) &&
      (renewedAt === undefined || isDateText(renewedAt)) &&
      (reports === undefined || isReportList(reports)) &&
      (replies === undefined || isReplyList(replies))
    );
  }
  return false;
}

// Reads the text of the file. Throws a clear message when it is damaged.
export function parseStoredPosts(text: string): StoredPost[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The saved posts file is not valid JSON.");
  }
  if (
    isRecord(data) &&
    data.version === storeVersion &&
    Array.isArray(data.posts)
  ) {
    const entries: unknown[] = data.posts;
    const bad = entries.findIndex((entry) => isStoredPost(entry) === false);
    if (bad >= 0) {
      throw new Error(
        `Post number ${bad + 1} in the saved posts file is not in the right shape.`,
      );
    }
    return entries.filter(isStoredPost);
  }
  if (
    isRecord(data) &&
    typeof data.version === "number" &&
    data.version > storeVersion
  ) {
    throw new Error(
      `The saved posts file has version ${data.version}, but this app only understands version ${storeVersion}.`,
    );
  }
  throw new Error(
    'The saved posts file should hold an object like { "version": 1, "posts": [] }.',
  );
}

const dayInMilliseconds = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// "Today", "Yesterday", "3 days ago", "Last week", "3 weeks ago".
// Counts calendar days on the clock of the server, not hours.
export function postedLabelFor(createdAt: string, now: Date): string {
  const days = Math.round(
    (startOfDay(now) - startOfDay(new Date(createdAt))) / dayInMilliseconds,
  );
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return "A while ago";
}

// "Edited today", "Edited yesterday", "Edited 3 days ago". It says the same as
// the posted label, in small letters after the word Edited.
export function editedLabelFor(editedAt: string, now: Date): string {
  const posted = postedLabelFor(editedAt, now);
  return `Edited ${posted.charAt(0).toLowerCase()}${posted.slice(1)}`;
}

export function toPost(stored: StoredPost, now: Date): Post {
  const post: Post = {
    id: stored.id,
    kind: stored.kind,
    title: stored.title,
    details: stored.details,
    area: stored.area,
    status: stored.status,
    postedLabel: postedLabelFor(stored.createdAt, now),
  };
  // Only a post that was edited has the label, so the others stay as they were.
  if (typeof stored.editedAt === "string") {
    post.editedLabel = editedLabelFor(stored.editedAt, now);
  }
  return post;
}

// True for a post that its author took down.
function isTakenDown(stored: StoredPost): boolean {
  return typeof stored.removedAt === "string";
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// A missing file is fine: nobody has posted yet. A damaged file is never
// replaced, because that would throw away posts. It is reported instead.
async function readStored(file: string): Promise<StoredPost[]> {
  let text: string | null = null;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissingFile(error) === false) throw error;
  }
  if (text === null) return [];
  try {
    return parseStoredPosts(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown problem.";
    throw new Error(
      `${reason} File: ${file}. Nothing was changed. Fix the file or move it away.`,
    );
  }
}

// Writes a new file next to the old one, then renames it over the old one.
// A rename is all or nothing, so a crash cannot leave half a file behind.
async function writeStored(file: string, posts: StoredPost[]): Promise<void> {
  const text = JSON.stringify({ version: storeVersion, posts }, null, 2) + "\n";
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, "utf8");
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export type ReadPostsOptions = {
  // The private page of an author needs a post that is hidden because nothing
  // happened to it for 30 days (see lib/post-age.ts), so that its author can
  // show it again. With this, such a post is read too, and every post carries
  // keep, which says how long it stays. The posts that were taken down are
  // still left out.
  includeHidden?: boolean;
};

// The saved posts, newest first. Posts that were taken down are left out, and
// so are posts that are hidden because nothing happened to them for 30 days.
// Hiding is worked out from the dates each time the posts are read, so nothing
// is written when a post becomes hidden.
export async function readPosts(
  file: string = defaultPostsFile(),
  now: Date = new Date(),
  options: ReadPostsOptions = {},
): Promise<Post[]> {
  const stored = await readStored(file);
  const withHidden = options.includeHidden === true;
  return stored
    .filter((entry) => isTakenDown(entry) === false)
    .filter((entry) => withHidden || isHiddenByAge(entry, now) === false)
    .map((entry, index) => ({
      entry,
      index,
      time: new Date(entry.createdAt).getTime(),
    }))
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .map((item) =>
      withHidden
        ? { ...toPost(item.entry, now), keep: keepOf(item.entry, now) }
        : toPost(item.entry, now),
    );
}

// manageKey is the secret of the private link. It is given back here, once.
// The file keeps only its fingerprint.
export type AddPostResult =
  | { ok: true; post: Post; manageKey: string }
  | { ok: false; reason: "full" };

async function saveOne(
  input: ValidNewPost,
  file: string,
  now: Date,
): Promise<AddPostResult> {
  // The caller should have checked the post already. This is the second check,
  // so a mistake in the caller can never put a bad post in the file.
  const checked = validateNewPost(input);
  if (checked.ok === false) {
    throw new Error(
      `addPost was given a post that does not pass validateNewPost (${Object.keys(checked.errors).join(", ")}).`,
    );
  }
  const posts = await readStored(file);
  if (posts.length >= savedPostsLimit) return { ok: false, reason: "full" };
  const manageKey = createManageKey();
  const stored: StoredPost = {
    id: `post-${randomUUID()}`,
    ...checked.post,
    status: "open",
    createdAt: now.toISOString(),
    manageKeyHash: hashManageKey(manageKey),
  };
  await writeStored(file, [...posts, stored]);
  return { ok: true, post: toPost(stored, now), manageKey };
}

// Changes to the file happen one at a time, so two people posting or changing
// a post at the same moment cannot overwrite each other. This holds inside one
// running server.
let lastChange: Promise<unknown> = Promise.resolve();

function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = lastChange.then(task);
  lastChange = run.catch(() => undefined);
  return run;
}

export function addPost(
  input: ValidNewPost,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<AddPostResult> {
  return inOrder(() => saveOne(input, file, now));
}

// reports says how often visitors reported the post, and for which reason (see
// lib/report-summary.ts). Only the author gets to see it.
export type OwnPostResult =
  | { ok: true; post: Post; reports: ReportSummary }
  | { ok: false; reason: "not-allowed" };

// The place of the post with this id, but only when the key fits it. Anything
// else gives -1: no such post, a wrong key, an old post with no fingerprint, or
// a post that was taken down. A post that is hidden because of its age still
// fits: its author must be able to reach it, to show it again.
function ownIndex(posts: StoredPost[], id: string, key: string): number {
  const index = posts.findIndex((entry) => entry.id === id);
  if (index < 0 || isTakenDown(posts[index])) return -1;
  if (keyMatches(key, posts[index].manageKeyHash)) return index;
  return -1;
}

// What the author gets about a post: the post as everyone sees it, with how
// long it stays (keep), and the counts of its reports. The times of the reports
// stay in the file.
function ownAnswer(stored: StoredPost, now: Date): OwnPostResult {
  return {
    ok: true,
    post: { ...toPost(stored, now), keep: keepOf(stored, now) },
    reports: summarizeReports(stored.reports),
  };
}

// Reads one post for its author. Only the key of the private link opens it.
export async function readOwnPost(
  id: string,
  key: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnPostResult> {
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  return ownAnswer(posts[index], now);
}

async function changeOne(
  id: string,
  key: string,
  status: PostStatus,
  file: string,
  now: Date,
): Promise<OwnPostResult> {
  // The caller should have checked the status already. This is the second check.
  if (postStatusIds.some((known) => known === status) === false) {
    throw new Error(
      `updateOwnPostStatus was given a status that does not exist (${String(status)}).`,
    );
  }
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  // Nothing to write when the status is the one it already has.
  if (posts[index].status === status) {
    return ownAnswer(posts[index], now);
  }
  const changed = posts.map((entry, place) =>
    place === index ? { ...entry, status } : entry,
  );
  await writeStored(file, changed);
  return ownAnswer(changed[index], now);
}

async function editOne(
  id: string,
  key: string,
  fields: EditPostFields,
  file: string,
  now: Date,
): Promise<OwnPostResult> {
  // The caller should have checked the texts already. This is the second check,
  // and the clean text that it gives back is what is saved.
  const checked = validateEditedPost(fields);
  if (checked.ok === false) {
    throw new Error(
      `updateOwnPost was given texts that do not pass validateEditedPost (${Object.keys(checked.errors).join(", ")}).`,
    );
  }
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  const { title, details, area } = checked.fields;
  const before = posts[index];
  // Nothing to write, and nothing to mark as edited, when the texts are the
  // ones the post already has.
  if (
    before.title === title &&
    before.details === details &&
    before.area === area
  ) {
    return ownAnswer(before, now);
  }
  const edited = posts.map((entry, place) =>
    place === index
      ? { ...entry, title, details, area, editedAt: now.toISOString() }
      : entry,
  );
  await writeStored(file, edited);
  return ownAnswer(edited[index], now);
}

// Changes the title, the details and the area of a post, but only for the one
// who has its key. The kind, the status, the date and the key stay as they
// are, and so do the reports, the replies and every other post. The time of the
// edit is saved, so that the pages can say that the post was edited.
export function updateOwnPost(
  id: string,
  key: string,
  fields: EditPostFields,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnPostResult> {
  return inOrder(() => editOne(id, key, fields, file, now));
}

async function renewOne(
  id: string,
  key: string,
  file: string,
  now: Date,
): Promise<OwnPostResult> {
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  const before = posts[index];
  const keep = keepOf(before, now);
  // Nothing to write for a post that is done, because it is never hidden. And
  // nothing to write while the post still has all of its days: that is the
  // first day after it was written, edited or kept up. So the file is written
  // at most once a day for a post, however often the button is pressed.
  if (keep.state === "done") return ownAnswer(before, now);
  if (keep.state === "shown" && keep.daysLeft === hideAfterDays) {
    return ownAnswer(before, now);
  }
  const renewed = posts.map((entry, place) =>
    place === index ? { ...entry, renewedAt: now.toISOString() } : entry,
  );
  await writeStored(file, renewed);
  return ownAnswer(renewed[index], now);
}

// Starts the 30 days of a post again, but only for the one who has its key. Only
// the time renewedAt is saved. The texts, the status, the date, the key, the
// reports, the replies and every other post stay as they are. A post that is
// already hidden can be kept up too: it is shown again.
export function renewOwnPost(
  id: string,
  key: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnPostResult> {
  return inOrder(() => renewOne(id, key, file, now));
}

async function removeOne(
  id: string,
  key: string,
  file: string,
  now: Date,
): Promise<OwnPostResult> {
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  // The entry is not erased. It only gets the time, and the pages stop showing it.
  const marked = posts.map((entry, place) =>
    place === index ? { ...entry, removedAt: now.toISOString() } : entry,
  );
  await writeStored(file, marked);
  return ownAnswer(posts[index], now);
}

// Takes a post down, but only for the one who has its key. The post is marked,
// not erased, and no other post is changed. The key stops working afterwards.
export function removeOwnPost(
  id: string,
  key: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnPostResult> {
  return inOrder(() => removeOne(id, key, file, now));
}

// stored is false when the post already has reportsKeptPerPost reports: the
// report is then not saved, and the file is not written.
export type AddReportResult =
  | { ok: true; stored: boolean }
  | { ok: false; reason: "not-found" };

async function reportOne(
  id: string,
  reason: ReportReason,
  file: string,
  now: Date,
): Promise<AddReportResult> {
  // The caller should have checked the reason already. This is the second check.
  if (reportReasonIds.some((known) => known === reason) === false) {
    throw new Error(
      `addReport was given a reason that does not exist (${String(reason)}).`,
    );
  }
  const posts = await readStored(file);
  const index = posts.findIndex((entry) => entry.id === id);
  if (
    index < 0 ||
    isTakenDown(posts[index]) ||
    isHiddenByAge(posts[index], now)
  ) {
    return { ok: false, reason: "not-found" };
  }
  const before = posts[index].reports ?? [];
  if (before.length >= reportsKeptPerPost) return { ok: true, stored: false };
  const changed = posts.map((entry, place) =>
    place === index
      ? { ...entry, reports: [...before, { reason, at: now.toISOString() }] }
      : entry,
  );
  await writeStored(file, changed);
  return { ok: true, stored: true };
}

// Saves a report about a post. Anyone may report, so no key is needed. Only
// the reason and the time are kept. The post and every other post stay as they
// are. A post that was taken down cannot be reported, and neither can a post
// that is hidden because nothing happened to it for 30 days.
export function addReport(
  id: string,
  reason: ReportReason,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<AddReportResult> {
  return inOrder(() => reportOne(id, reason, file, now));
}

// stored is false when the post already has repliesKeptPerPost replies: the
// reply is then not saved, and the file is not written. "closed" means that the
// post is marked as done, so it takes no more replies.
export type AddReplyResult =
  | { ok: true; stored: boolean }
  | { ok: false; reason: "not-found" | "closed" };

async function replyOne(
  id: string,
  reply: ValidNewReply,
  file: string,
  now: Date,
): Promise<AddReplyResult> {
  // The caller should have checked the reply already. This is the second check,
  // and the clean text that it gives back is what is saved.
  const checked = validateNewReply({
    message: reply.message,
    name: reply.name ?? "",
    contact: reply.contact ?? "",
  });
  if (checked.ok === false) {
    throw new Error(
      `addReply was given a reply that does not pass validateNewReply (${Object.keys(checked.errors).join(", ")}).`,
    );
  }
  const posts = await readStored(file);
  const index = posts.findIndex((entry) => entry.id === id);
  if (
    index < 0 ||
    isTakenDown(posts[index]) ||
    isHiddenByAge(posts[index], now)
  ) {
    return { ok: false, reason: "not-found" };
  }
  if (posts[index].status === "done") return { ok: false, reason: "closed" };
  const before = posts[index].replies ?? [];
  if (before.length >= repliesKeptPerPost) return { ok: true, stored: false };
  const added: StoredReply = { ...checked.reply, at: now.toISOString() };
  const changed = posts.map((entry, place) =>
    place === index ? { ...entry, replies: [...before, added] } : entry,
  );
  await writeStored(file, changed);
  return { ok: true, stored: true };
}

// Saves a reply to a post. Anyone may reply, so no key is needed. Only the
// words that the neighbor chose to write and the time are kept. The post and
// every other post stay as they are. A post that was taken down cannot be
// replied to, and neither can a post that is hidden because nothing happened
// to it for 30 days, or that is marked as done.
export function addReply(
  id: string,
  reply: ValidNewReply,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<AddReplyResult> {
  return inOrder(() => replyOne(id, reply, file, now));
}

// One reply as the author gets it: the words, and how long ago it was written,
// as "Today" or "3 days ago". The exact time stays in the file.
export type OwnReply = {
  message: string;
  name?: string;
  contact?: string;
  when: string;
};

export type OwnRepliesResult =
  | { ok: true; replies: OwnReply[] }
  | { ok: false; reason: "not-allowed" };

function toOwnReply(stored: StoredReply, now: Date): OwnReply {
  const own: OwnReply = {
    message: stored.message,
    when: postedLabelFor(stored.at, now),
  };
  if (typeof stored.name === "string") own.name = stored.name;
  if (typeof stored.contact === "string") own.contact = stored.contact;
  return own;
}

// The replies to a post, the newest first, for its author only. Only the key of
// the private link opens them: a wrong key, an unknown post, an old post and a
// post that was taken down all get the same answer. Reading writes nothing.
export async function readOwnReplies(
  id: string,
  key: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnRepliesResult> {
  const posts = await readStored(file);
  const index = ownIndex(posts, id, key);
  if (index < 0) return { ok: false, reason: "not-allowed" };
  const replies = (posts[index].replies ?? [])
    .map((reply, place) => ({
      reply,
      place,
      time: new Date(reply.at).getTime(),
    }))
    .sort((a, b) => b.time - a.time || b.place - a.place)
    .map((item) => toOwnReply(item.reply, now));
  return { ok: true, replies };
}

// Changes the status of a post, but only for the one who has its key. Nothing
// else about the post is changed, and the other posts stay exactly as they are.
export function updateOwnPostStatus(
  id: string,
  key: string,
  status: PostStatus,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnPostResult> {
  return inOrder(() => changeOne(id, key, status, file, now));
}
