import {
  withinLimits,
  type LimitedAnswer,
  type ManageLimits,
} from "@/lib/manage-limits";
import { readOwnRepliesFromInput, type OwnRepliesAnswer } from "@/lib/own-replies";
import { defaultPostsFile } from "@/lib/post-store";

// What the action gives back to the browser: the answer of the logic in
// lib/own-replies.ts, or "limited" when the visitor made too many wrong tries.
// It is plain data, because it travels over the network.
export type OwnRepliesReply = OwnRepliesAnswer | LimitedAnswer;

// The same limit as for the other tries on the private page: only wrong tries
// count, and a try with the right key is free (see lib/manage-limits.ts).
export function readOwnRepliesWithinLimits(
  id: unknown,
  key: unknown,
  visitor: string,
  limits: ManageLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnRepliesReply> {
  return withinLimits(visitor, limits, now, () =>
    readOwnRepliesFromInput(id, key, file, now),
  );
}
