import type { PostKeep, PostStatus } from "@/lib/posts";

// How long a post that is not done stays on the board without anything
// happening to it. After that it is hidden, never deleted. This file holds the
// one rule, so that the board, the private page and the tests all use the same.
export const hideAfterDays = 30;

const dayInMilliseconds = 24 * 60 * 60 * 1000;

// The few fields of a stored post that decide its age. A stored post fits.
export type Aging = {
  status: PostStatus;
  createdAt: string;
  // When the author last edited the texts, and when the author last pressed
  // "Keep my post up". Both are there only if it happened.
  editedAt?: string;
  renewedAt?: string;
};

// The latest moment that counts for the age: the day the post was written, the
// day it was edited, or the day its author kept it up. The dates are checked
// when the file is read. If one of them still were not a date, the age could
// not be worked out, and then the post is not hidden (see isHiddenByAge).
export function lastActiveTime(post: Aging): number {
  let latest = new Date(post.createdAt).getTime();
  for (const text of [post.editedAt, post.renewedAt]) {
    if (typeof text === "string") {
      const time = new Date(text).getTime();
      if (time > latest) latest = time;
    }
  }
  return latest;
}

// True for a post that is hidden because nothing happened to it for
// hideAfterDays. A post that is done is never hidden. When the age cannot be
// worked out, the answer is false: a mistake must never hide a post.
export function isHiddenByAge(post: Aging, now: Date): boolean {
  if (post.status === "done") return false;
  const age = now.getTime() - lastActiveTime(post);
  return age >= hideAfterDays * dayInMilliseconds;
}

// What the author is told on the private page: that the post is done and
// never hidden, that it is hidden, or how many days it has left. The days are
// rounded up, so a post that has 5 hours left has 1 day left. A date in the
// future (a clock that was wrong) never gives more than the full time.
export function keepOf(post: Aging, now: Date): PostKeep {
  if (post.status === "done") return { state: "done" };
  if (isHiddenByAge(post, now)) return { state: "hidden" };
  const age = now.getTime() - lastActiveTime(post);
  const days = Math.ceil((hideAfterDays * dayInMilliseconds - age) / dayInMilliseconds);
  if (Number.isFinite(days) === false) {
    return { state: "shown", daysLeft: hideAfterDays };
  }
  return { state: "shown", daysLeft: Math.min(hideAfterDays, Math.max(1, days)) };
}
