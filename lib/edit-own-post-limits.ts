import {
  editOwnPostFromInput,
  type EditOwnPostAnswer,
} from "@/lib/edit-own-post";
import {
  withinLimits,
  type LimitedAnswer,
  type ManageLimits,
} from "@/lib/manage-limits";
import { defaultPostsFile } from "@/lib/post-store";
import { createRateLimiter, type Permit } from "@/lib/rate-limit";

// Two limits stand in front of an edit.
//
// 1. The limit on wrong tries of the private page (lib/manage-limits.ts). A
//    post or a key that does not fit counts there, and a try with the right key
//    is free. A visitor who has used all their wrong tries is stopped before
//    the file is opened, also with the right key.
// 2. This file: a limit on edits. Every edit that reaches the file counts,
//    also one that changes nothing, because the server opens, reads and
//    compares the file each time. A wrong try, a text that does not pass the
//    checks and a try that failed on our side give their place back, so they
//    never use up the edits of an author.
//
// Like the other limits, they are a speed bump and not a lock, and their
// numbers live in the memory of the running server only.

const oneMinute = 60 * 1000;

// The most visitors the server remembers at once. A visitor who is no longer
// remembered starts again from zero.
const visitorsKept = 5000;

export type EditLimitSettings = {
  // How many edits one visitor may make inside the window.
  edits: number;
  // How long an edit counts, in whole minutes.
  windowMinutes: number;
};

export const defaultEditLimitSettings: EditLimitSettings = {
  edits: 10,
  windowMinutes: 60,
};

// What the action gives back to the browser: the answer of the logic in
// lib/edit-own-post.ts, or "limited". It is plain data, because it travels over
// the network.
export type EditOwnPostReply = EditOwnPostAnswer | LimitedAnswer;

export type EditLimitAnswer =
  | { ok: true; permit: Permit }
  | { ok: false; minutes: number };

export type EditLimits = {
  take: (visitor: string, now: Date) => EditLimitAnswer;
};

// Whole minutes, rounded up. A wait of even one millisecond is one minute.
function minutesFrom(waitMs: number): number {
  return Math.ceil(waitMs / oneMinute);
}

// One counter for each visitor.
export function createEditLimits(
  settings: EditLimitSettings = defaultEditLimitSettings,
  kept: number = visitorsKept,
): EditLimits {
  const visitors = createRateLimiter({
    limit: settings.edits,
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

// Edits a post, if the visitor has a place left in both counters. Each place is
// taken before the file is opened, in one step, so many edits sent at the same
// moment cannot all slip through. A visitor with no place left in the first
// counter is stopped before the second counter is used. A visitor who is over
// the limit on edits is told so before the key is looked at, and does not lose
// a place in the first counter for that.
export function editOwnPostWithinLimits(
  id: unknown,
  key: unknown,
  input: unknown,
  visitor: string,
  wrongTries: ManageLimits,
  edits: EditLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<EditOwnPostReply> {
  return withinLimits<EditOwnPostReply>(visitor, wrongTries, now, async () => {
    const place = edits.take(visitor, now);
    if (place.ok === false) return { status: "limited", minutes: place.minutes };
    let answer: EditOwnPostAnswer;
    try {
      answer = await editOwnPostFromInput(id, key, input, file, now);
    } catch (error) {
      place.permit.refund();
      throw error;
    }
    // Only an edit that reached the file keeps its place.
    if (answer.status === "ok") return answer;
    place.permit.refund();
    return answer;
  });
}
