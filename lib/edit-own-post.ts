import {
  validateEditedPost,
  type EditPostErrors,
  type EditPostFields,
} from "@/lib/edit-post";
import { isManageKey } from "@/lib/manage-key";
import { isPostId } from "@/lib/post-id";
import { defaultPostsFile, updateOwnPost } from "@/lib/post-store";
import type { Post } from "@/lib/posts";
import type { ReportSummary } from "@/lib/report-summary";

// What the server tells the browser after the author edits a post. It has to be
// plain data, because it travels over the network.
//   ok           the post now says what the author wrote, also when nothing
//                changed. The answer carries the post as everyone will see it.
//   invalid      a text does not pass the checks; errors say which and why
//   not-allowed  the link does not fit: no such post, a wrong or cut-off key, an
//                old post that has no key, a post that was taken down, or an id
//                or a key of the wrong shape
//   failed       the file could not be read or written
export type EditOwnPostAnswer =
  | { status: "ok"; post: Post; reports: ReportSummary }
  | { status: "invalid"; errors: EditPostErrors }
  | { status: "not-allowed" }
  | { status: "failed" };

// Anyone can send a request to the server, not only our form. So the input can
// be anything at all, and every field is read as text or treated as empty.
function fieldsFrom(input: unknown): EditPostFields {
  const record: Record<string, unknown> =
    input instanceof Object ? (input as Record<string, unknown>) : {};
  function text(name: string): string {
    const value = record[name];
    return typeof value === "string" ? value : "";
  }
  return {
    title: text("title"),
    details: text("details"),
    area: text("area"),
  };
}

// Checks the texts again, then saves them, if the key fits the post. Only the
// three texts of the form are used, so nobody can choose a status, a kind, a
// time or another post from the outside. An id or a key of the wrong shape is
// refused before the file is opened, and so are texts that do not pass.
export async function editOwnPostFromInput(
  id: unknown,
  key: unknown,
  input: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<EditOwnPostAnswer> {
  if (isPostId(id) === false || isManageKey(key) === false) {
    return { status: "not-allowed" };
  }
  const checked = validateEditedPost(fieldsFrom(input));
  if (checked.ok === false) return { status: "invalid", errors: checked.errors };
  try {
    const saved = await updateOwnPost(id, key, checked.fields, file, now);
    return saved.ok
      ? { status: "ok", post: saved.post, reports: saved.reports }
      : { status: "not-allowed" };
  } catch (error) {
    // The details go to the terminal of the server, not to the browser. The
    // words of the post are not part of the log.
    console.error("Editing a post failed:", error);
    return { status: "failed" };
  }
}
