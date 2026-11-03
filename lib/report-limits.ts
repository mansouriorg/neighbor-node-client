import type { LimitedAnswer } from "@/lib/manage-limits";
import { defaultPostsFile } from "@/lib/post-store";
import { createRateLimiter, type Permit } from "@/lib/rate-limit";
import { reportPostFromInput, type ReportAnswer } from "@/lib/report-post";

// A limit on reports. Anyone can report a post, so without a limit one visitor
// could send reports as fast as the server can write the file. Every try
// counts, whatever the answer, because even a report about a post that does not
// exist makes the server open the file. Only a try that failed on our side
// gives its place back. Like the other limits, this is a speed bump and not a
// lock, and its numbers live in the memory of the running server only.

const oneMinute = 60 * 1000;

// The most visitors the server remembers at once. A visitor who is no longer
// remembered starts again from zero.
const visitorsKept = 5000;

export type ReportLimitSettings = {
  // How many reports one visitor may send inside the window.
  reports: number;
  // How long a report counts, in whole minutes.
  windowMinutes: number;
};

export const defaultReportLimitSettings: ReportLimitSettings = {
  reports: 5,
  windowMinutes: 60,
};

// What the three kinds of answer look like when they travel to the browser: an
// answer of the logic in lib/report-post.ts, or "limited". Plain data.
export type ReportReply = ReportAnswer | LimitedAnswer;

export type ReportLimitAnswer =
  | { ok: true; permit: Permit }
  | { ok: false; minutes: number };

export type ReportLimits = {
  take: (visitor: string, now: Date) => ReportLimitAnswer;
};

// Whole minutes, rounded up. A wait of even one millisecond is one minute.
function minutesFrom(waitMs: number): number {
  return Math.ceil(waitMs / oneMinute);
}

// One counter for each visitor.
export function createReportLimits(
  settings: ReportLimitSettings = defaultReportLimitSettings,
  kept: number = visitorsKept,
): ReportLimits {
  const visitors = createRateLimiter({
    limit: settings.reports,
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

// Sends a report, if the visitor has a place left. The place is taken before
// the file is opened, in one step, so many reports sent at the same moment
// cannot all slip through. A visitor with no place left is stopped before the
// file is opened.
export async function reportPostWithinLimits(
  id: unknown,
  reason: unknown,
  visitor: string,
  limits: ReportLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ReportReply> {
  const place = limits.take(visitor, now);
  if (place.ok === false) return { status: "limited", minutes: place.minutes };
  let answer: ReportAnswer;
  try {
    answer = await reportPostFromInput(id, reason, file, now);
  } catch (error) {
    place.permit.refund();
    throw error;
  }
  if (answer.status === "failed") place.permit.refund();
  return answer;
}
