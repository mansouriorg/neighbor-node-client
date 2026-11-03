import { defaultPostsFile } from "@/lib/post-store";
import { createRateLimiter, type Permit } from "@/lib/rate-limit";
import { savePostFromInput, type SavePostResult } from "@/lib/save-post";

const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;

// The most visitors the server remembers at once. A visitor who is no longer
// remembered starts again from zero.
const visitorsKept = 5000;

// How many posts may be saved in one hour.
export type PostLimitSettings = {
  // By one visitor.
  perVisitor: number;
  // By everybody together. This one also stops a flood from many addresses.
  perSite: number;
};

export const defaultPostLimitSettings: PostLimitSettings = {
  perVisitor: 5,
  perSite: 60,
};

// Reads the two numbers from the environment of the server, for example from
// POSTS_PER_HOUR=20 npm run dev. A wrong value is not used, and the warning
// says which one it was.
export function readPostLimitSettings(
  env: Record<string, string | undefined>,
): { settings: PostLimitSettings; warnings: string[] } {
  const warnings: string[] = [];
  function read(name: string, fallback: number): number {
    const raw = env[name];
    if (raw === undefined) return fallback;
    const text = raw.trim();
    if (text === "") return fallback;
    const value = Number(text);
    if (/^[0-9]+$/.test(text) && value >= 1 && value <= 1000) return value;
    warnings.push(
      `${name} must be a whole number from 1 to 1000, so ${fallback} is used.`,
    );
    return fallback;
  }
  return {
    settings: {
      perVisitor: read("POSTS_PER_HOUR", defaultPostLimitSettings.perVisitor),
      perSite: read("POSTS_PER_HOUR_SITE", defaultPostLimitSettings.perSite),
    },
    warnings,
  };
}

export type PostLimitAnswer =
  | { ok: true; permit: Permit }
  | { ok: false; minutes: number };

export type PostLimits = {
  take: (visitor: string, now: Date) => PostLimitAnswer;
};

// Whole minutes, rounded up. A wait of even one millisecond is one minute.
function minutesFrom(waitMs: number): number {
  return Math.ceil(waitMs / oneMinute);
}

// Two counters: one for each visitor, and one for the whole site.
export function createPostLimits(
  settings: PostLimitSettings = defaultPostLimitSettings,
  kept: number = visitorsKept,
): PostLimits {
  const visitors = createRateLimiter({
    limit: settings.perVisitor,
    windowMs: oneHour,
    maxKeys: kept,
  });
  const site = createRateLimiter({
    limit: settings.perSite,
    windowMs: oneHour,
    maxKeys: 1,
  });
  return {
    take(visitor, now) {
      const mine = visitors.take(visitor, now);
      if (mine.ok === false) {
        return { ok: false, minutes: minutesFrom(mine.retryAfterMs) };
      }
      const everybody = site.take("site", now);
      if (everybody.ok === false) {
        // The visitor did nothing wrong, so their place is given back.
        mine.permit.refund();
        return { ok: false, minutes: minutesFrom(everybody.retryAfterMs) };
      }
      return {
        ok: true,
        permit: {
          refund() {
            mine.permit.refund();
            everybody.permit.refund();
          },
        },
      };
    },
  };
}

// What the server can read about a visitor: a header that a proxy in front of
// the site fills in. Headers from Next have this shape.
export type HeaderReader = { get: (name: string) => string | null };

function cleanAddress(text: string): string {
  // The cut keeps the memory small, however long a header is.
  return text.trim().toLowerCase().slice(0, 64);
}

// Tells visitors apart by their address. A proxy adds the address it saw at the
// end of x-forwarded-for, so the last entry is the one the nearest proxy wrote.
// The first entries can be written by the visitor. Without any header, all
// visitors count as one.
export function visitorKey(headers: HeaderReader): string {
  const forwarded = headers.get("x-forwarded-for");
  if (typeof forwarded === "string") {
    const parts = forwarded.split(",");
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const address = cleanAddress(parts[index]);
      if (address.length > 0) return address;
    }
  }
  const real = headers.get("x-real-ip");
  if (typeof real === "string") {
    const address = cleanAddress(real);
    if (address.length > 0) return address;
  }
  return "unknown";
}

// Saves a post, if the visitor has a place left. The place is taken before
// anything else, in one step, so many posts sent at the same moment cannot all
// slip through. Only a post that was really saved keeps its place: a post that
// fails the checks, or cannot be written, gives it back.
export async function savePostWithinLimits(
  input: unknown,
  visitor: string,
  limits: PostLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<SavePostResult> {
  const answer = limits.take(visitor, now);
  if (answer.ok === false) return { status: "limited", minutes: answer.minutes };
  const result = await savePostFromInput(input, file, now);
  if (result.status === "saved") return result;
  answer.permit.refund();
  return result;
}
