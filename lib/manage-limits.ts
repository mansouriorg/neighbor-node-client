import {
  changeOwnPostStatusFromInput,
  checkOwnPostFromInput,
  removeOwnPostFromInput,
  type ManageAnswer,
  type RemoveAnswer,
} from "@/lib/manage-post";
import { defaultPostsFile } from "@/lib/post-store";
import { createRateLimiter, type Permit } from "@/lib/rate-limit";

// A limit on the tries on the private page. A try is one call of an action
// behind it: check the link, change the status, edit the post, read the
// replies, take the post down.
//
// Only wrong tries are counted: a post or a key that does not fit, or an id or a
// key of the wrong shape. A try with the right key is free, so an author who
// uses the link in the normal way never comes near the limit. A key cannot be
// guessed (there are 2 to the power 256 of them), so this is not about guessing.
// It stops one visitor from making the server open and compare the file over
// and over with tries that cannot work. Like the limit on posting, it is a
// speed bump and not a lock, and its numbers live in the memory of the running
// server only.

const oneMinute = 60 * 1000;

// The most visitors the server remembers at once. A visitor who is no longer
// remembered starts again from zero.
const visitorsKept = 5000;

export type ManageLimitSettings = {
  // How many wrong tries one visitor may make inside the window.
  wrongTries: number;
  // How long a wrong try counts, in whole minutes.
  windowMinutes: number;
};

export const defaultManageLimitSettings: ManageLimitSettings = {
  wrongTries: 10,
  windowMinutes: 10,
};

// What a visitor is told when all their places are used.
export type LimitedAnswer = { status: "limited"; minutes: number };

// What the three actions give back to the browser: the answer of the logic in
// lib/manage-post.ts, or "limited". It is plain data, because it travels over
// the network.
export type ManageReply = ManageAnswer | LimitedAnswer;
export type RemoveReply = RemoveAnswer | LimitedAnswer;

export type ManageLimitAnswer =
  | { ok: true; permit: Permit }
  | { ok: false; minutes: number };

export type ManageLimits = {
  take: (visitor: string, now: Date) => ManageLimitAnswer;
};

// Whole minutes, rounded up. A wait of even one millisecond is one minute.
function minutesFrom(waitMs: number): number {
  return Math.ceil(waitMs / oneMinute);
}

// One counter for each visitor. All the actions share it, so a visitor cannot
// get more tries by spreading them over the actions.
export function createManageLimits(
  settings: ManageLimitSettings = defaultManageLimitSettings,
  kept: number = visitorsKept,
): ManageLimits {
  const visitors = createRateLimiter({
    limit: settings.wrongTries,
    windowMs: settings.windowMinutes * oneMinute,
    maxKeys: kept,
  });
  return {
    take(visitor, now) {
      const answer = visitors.take(visitor, now);
      if (answer.ok === false) {
        return { ok: false, minutes: minutesFrom(answer.retryAfterMs) };
      }
      return { ok: true, permit: answer.permit };
    },
  };
}

// Runs one try, if the visitor has a place left. The place is taken before
// anything is read or changed, in one step, so many tries sent at the same
// moment cannot all slip through. Only a try that did not fit keeps its place.
// A try that fits, or that failed on our side, gives it back. A visitor who has
// no place left is stopped before the file is opened, also with the right key.
// It is exported, so that lib/own-replies-limits.ts,
// lib/edit-own-post-limits.ts and lib/renew-own-post-limits.ts use the same
// rules.
export async function withinLimits<Answer extends { status: string }>(
  visitor: string,
  limits: ManageLimits,
  now: Date,
  run: () => Promise<Answer>,
): Promise<Answer | LimitedAnswer> {
  const place = limits.take(visitor, now);
  if (place.ok === false) return { status: "limited", minutes: place.minutes };
  let answer: Answer;
  try {
    answer = await run();
  } catch (error) {
    place.permit.refund();
    throw error;
  }
  if (answer.status === "not-allowed") return answer;
  place.permit.refund();
  return answer;
}

export function checkOwnPostWithinLimits(
  id: unknown,
  key: unknown,
  visitor: string,
  limits: ManageLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageReply> {
  return withinLimits(visitor, limits, now, () =>
    checkOwnPostFromInput(id, key, file, now),
  );
}

export function changeOwnPostStatusWithinLimits(
  id: unknown,
  key: unknown,
  status: unknown,
  visitor: string,
  limits: ManageLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageReply> {
  return withinLimits(visitor, limits, now, () =>
    changeOwnPostStatusFromInput(id, key, status, file, now),
  );
}

export function removeOwnPostWithinLimits(
  id: unknown,
  key: unknown,
  visitor: string,
  limits: ManageLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<RemoveReply> {
  return withinLimits(visitor, limits, now, () =>
    removeOwnPostFromInput(id, key, file, now),
  );
}
