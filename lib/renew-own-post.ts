import { isManageKey } from "@/lib/manage-key";
import type { ManageAnswer } from "@/lib/manage-post";
import { isPostId } from "@/lib/post-id";
import { defaultPostsFile, renewOwnPost } from "@/lib/post-store";

// Keeps a post up for its author: the 30 days of the post (see
// lib/post-age.ts) start again. Anyone can send a request to the server, not
// only our page, so the input can be anything at all. An id or a key of the
// wrong shape is refused before the file is opened.
//
// The answer is the one of the other tries on the private page (ManageAnswer):
//   ok           the post, as everyone sees it, with how long it stays (keep),
//                and the counts of its reports. It is also "ok" when nothing
//                had to be written, for a post that is done or that still has
//                all of its days.
//   not-allowed  the link does not fit: no such post, a wrong or cut-off key, an
//                old post that has no key, or a post that was taken down
//   failed       the file could not be read or written
//
// Nothing comes from the outside except the id and the key. So nobody can
// choose the time that is saved, or change anything else about the post.
export async function renewOwnPostFromInput(
  id: unknown,
  key: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageAnswer> {
  if (isPostId(id) && isManageKey(key)) {
    try {
      const renewed = await renewOwnPost(id, key, file, now);
      return renewed.ok
        ? { status: "ok", post: renewed.post, reports: renewed.reports }
        : { status: "not-allowed" };
    } catch (error) {
      // The details go to the terminal of the server, not to the browser.
      console.error("Keeping a post up failed:", error);
      return { status: "failed" };
    }
  }
  return { status: "not-allowed" };
}
