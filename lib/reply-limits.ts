import type { LimitedAnswer } from "@/lib/manage-limits";
import { defaultPostsFile } from "@/lib/post-store";
import { createRateLimiter, type Permit } from "@/lib/rate-limit";
import { replyToPostFromInput, type ReplyAnswer } from "@/lib/reply-post";

// A limit on replies. Anyone can reply to a post, so without a limit one
// visitor could send replies as fast as the server can write the file. Every
// try counts, whatever the answer, because even a reply to a post that does not
// exist makes the server open the file. Only a try that failed on our side
// gives its place back. Like the other limits, this is a speed bump and not a
// lock, and its numbers live in the memory of the running server only.

const oneMinute = 60 * 1000;

// The most visitors the server remembers at once. A visitor who is no longer
// remembered starts again from zero.
const visitorsKept = 5000;

export type ReplyLimitSettings = {
  // How many replies one visitor may send inside the window.
  replies: number;
  // How long a reply counts, in whole minutes.
  windowMinutes: number;
};

export const defaultReplyLimitSettings: ReplyLimitSettings = {
  replies: 10,
  windowMinutes: 60,
};

// What the answers look like when they travel to the browser: an answer of the
// logic in lib/reply-post.ts, or "limited". Plain data.
export type ReplyReply = ReplyAnswer | LimitedAnswer;

export type ReplyLimitAnswer =
  | { ok: true; permit: Permit }
  | { ok: false; minutes: number };

export type ReplyLimits = {
  take: (visitor: string, now: Date) => ReplyLimitAnswer;
};

// Whole minutes, rounded up. A wait of even one millisecond is one minute.
function minutesFrom(waitMs: number): number {
  return Math.ceil(waitMs / oneMinute);
}

// One counter for each visitor.
export function createReplyLimits(
  settings: ReplyLimitSettings = defaultReplyLimitSettings,
  kept: number = visitorsKept,
): ReplyLimits {
  const visitors = createRateLimiter({
    limit: settings.replies,
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

// Sends a reply, if the visitor has a place left. The place is taken before the
// file is opened, in one step, so many replies sent at the same moment cannot
// all slip through. A visitor with no place left is stopped before the file is
// opened.
export async function replyToPostWithinLimits(
  id: unknown,
  input: unknown,
  visitor: string,
  limits: ReplyLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ReplyReply> {
  const place = limits.take(visitor, now);
  if (place.ok === false) return { status: "limited", minutes: place.minutes };
  let answer: ReplyAnswer;
  try {
    answer = await replyToPostFromInput(id, input, file, now);
  } catch (error) {
    place.permit.refund();
    throw error;
  }
  if (answer.status === "failed") place.permit.refund();
  return answer;
}
