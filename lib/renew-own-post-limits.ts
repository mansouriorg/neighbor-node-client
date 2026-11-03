import {
  withinLimits,
  type ManageLimits,
  type ManageReply,
} from "@/lib/manage-limits";
import { defaultPostsFile } from "@/lib/post-store";
import { renewOwnPostFromInput } from "@/lib/renew-own-post";

// One limit stands in front of keeping a post up: the limit on wrong tries of
// the private page (lib/manage-limits.ts). A post or a key that does not fit
// counts there, and a try with the right key is free. A visitor who has used
// all their wrong tries is stopped before the file is opened, also with the
// right key.
//
// There is no second counter, as there is for edits, because the post itself
// limits the writing: keeping a post up writes to the file at most once a day
// for each post (see renewOwnPost in lib/post-store.ts). All other presses read
// the file and write nothing, like opening the private page.

// Keeps a post up, if the visitor has a place left. It uses the same rules as
// the other tries on the private page, see withinLimits.
export function renewOwnPostWithinLimits(
  id: unknown,
  key: unknown,
  visitor: string,
  limits: ManageLimits,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageReply> {
  return withinLimits(visitor, limits, now, () =>
    renewOwnPostFromInput(id, key, file, now),
  );
}
