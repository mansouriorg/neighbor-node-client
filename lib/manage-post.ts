import { isManageKey } from "@/lib/manage-key";
import { isPostId } from "@/lib/post-id";
import {
  defaultPostsFile,
  readOwnPost,
  removeOwnPost,
  updateOwnPostStatus,
} from "@/lib/post-store";
import { postStatusIds, type Post, type PostStatus } from "@/lib/posts";
import type { ReportSummary } from "@/lib/report-summary";

// What the server tells the browser after a try on the private page. It has to
// be plain data, because it travels over the network. "not-allowed" covers
// every case where the link does not fit: no such post, a wrong or cut-off key,
// an old post that has no key, a post that was taken down already, or a request
// that makes no sense.
export type ManageAnswer =
  | { status: "ok"; post: Post; reports: ReportSummary }
  | { status: "not-allowed" }
  | { status: "failed" };

// The same for taking a post down. The answer carries no post, because there is
// nothing left to show.
export type RemoveAnswer =
  | { status: "removed" }
  | { status: "not-allowed" }
  | { status: "failed" };

// Saved posts have ids like post-<random text>, and sample posts cannot be
// managed. The check for such an id is isPostId in lib/post-id.ts.

function isPostStatus(value: unknown): value is PostStatus {
  return postStatusIds.some((known) => known === value);
}

// Anyone can send a request to the server, not only our page. So the input can
// be anything at all, and a malformed id or key is refused before the file is
// opened.
export async function checkOwnPostFromInput(
  id: unknown,
  key: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageAnswer> {
  if (isPostId(id) && isManageKey(key)) {
    try {
      const found = await readOwnPost(id, key, file, now);
      return found.ok
        ? { status: "ok", post: found.post, reports: found.reports }
        : { status: "not-allowed" };
    } catch (error) {
      // The details go to the terminal of the server, not to the browser.
      console.error("Reading a post for its author failed:", error);
      return { status: "failed" };
    }
  }
  return { status: "not-allowed" };
}

// Changes the status of a post, if the key fits. Nothing else about the post
// can be changed from the outside.
export async function changeOwnPostStatusFromInput(
  id: unknown,
  key: unknown,
  status: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ManageAnswer> {
  if (isPostId(id) && isManageKey(key) && isPostStatus(status)) {
    try {
      const changed = await updateOwnPostStatus(id, key, status, file, now);
      return changed.ok
        ? { status: "ok", post: changed.post, reports: changed.reports }
        : { status: "not-allowed" };
    } catch (error) {
      console.error("Changing the status of a post failed:", error);
      return { status: "failed" };
    }
  }
  return { status: "not-allowed" };
}

// Takes a post down, if the key fits. The post disappears from the board and
// the key stops working. The entry stays in the file, marked as taken down.
export async function removeOwnPostFromInput(
  id: unknown,
  key: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<RemoveAnswer> {
  if (isPostId(id) && isManageKey(key)) {
    try {
      const removed = await removeOwnPost(id, key, file, now);
      return removed.ok ? { status: "removed" } : { status: "not-allowed" };
    } catch (error) {
      console.error("Taking a post down failed:", error);
      return { status: "failed" };
    }
  }
  return { status: "not-allowed" };
}
