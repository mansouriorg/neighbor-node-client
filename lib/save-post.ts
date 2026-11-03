import {
  validateNewPost,
  type NewPostErrors,
  type NewPostFields,
} from "@/lib/new-post";
import type { Post } from "@/lib/posts";
import { addPost, defaultPostsFile } from "@/lib/post-store";

// What the server tells the browser after a try. It has to be plain data,
// because it travels over the network. It never holds a file path or an error.
// The "saved" answer carries the secret key of the private link, once. The
// server does not keep the key, it keeps only a fingerprint of it.
export type SavePostResult =
  | { status: "saved"; post: Post; manageKey: string }
  | { status: "invalid"; errors: NewPostErrors }
  | { status: "full" }
  | { status: "limited"; minutes: number }
  | { status: "failed" };

// Anyone can send a request to the server, not only our form. So the input can
// be anything at all, and every field is read as text or treated as empty.
function fieldsFrom(input: unknown): NewPostFields {
  const record: Record<string, unknown> =
    input instanceof Object ? (input as Record<string, unknown>) : {};
  function text(name: string): string {
    const value = record[name];
    return typeof value === "string" ? value : "";
  }
  return {
    kind: text("kind"),
    title: text("title"),
    details: text("details"),
    area: text("area"),
  };
}

// Checks a post again, then saves it. Only the four fields of the form are
// used, so nobody can choose an id, a status or a date from the outside.
export async function savePostFromInput(
  input: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<SavePostResult> {
  const checked = validateNewPost(fieldsFrom(input));
  if (checked.ok === false) return { status: "invalid", errors: checked.errors };
  try {
    const result = await addPost(checked.post, file, now);
    if (result.ok) {
      return { status: "saved", post: result.post, manageKey: result.manageKey };
    }
    return { status: "full" };
  } catch (error) {
    // The details go to the terminal of the server, not to the browser.
    console.error("Saving a post failed:", error);
    return { status: "failed" };
  }
}
