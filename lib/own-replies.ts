import { isManageKey } from "@/lib/manage-key";
import { isPostId } from "@/lib/post-id";
import { defaultPostsFile, readOwnReplies, type OwnReply } from "@/lib/post-store";

// What the server tells the browser when the author asks for the replies to a
// post. It has to be plain data, because it travels over the network.
// "not-allowed" covers every case where the link does not fit: no such post, a
// wrong or cut-off key, an old post that has no key, a post that was taken
// down, or a request that makes no sense.
export type OwnRepliesAnswer =
  | { status: "ok"; replies: OwnReply[] }
  | { status: "not-allowed" }
  | { status: "failed" };

// Anyone can send a request to the server, not only our page. So the input can
// be anything at all, and a malformed id or key is refused before the file is
// opened.
export async function readOwnRepliesFromInput(
  id: unknown,
  key: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<OwnRepliesAnswer> {
  if (isPostId(id) && isManageKey(key)) {
    try {
      const found = await readOwnReplies(id, key, file, now);
      return found.ok
        ? { status: "ok", replies: found.replies }
        : { status: "not-allowed" };
    } catch (error) {
      // The details go to the terminal of the server, not to the browser.
      console.error("Reading the replies to a post failed:", error);
      return { status: "failed" };
    }
  }
  return { status: "not-allowed" };
}
