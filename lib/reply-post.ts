import { validateNewReply, type NewReplyErrors, type NewReplyFields } from "@/lib/new-reply";
import { isPostId } from "@/lib/post-id";
import { addReply, defaultPostsFile } from "@/lib/post-store";

// What the server tells the browser after someone replies to a post. It has to
// be plain data, because it travels over the network.
//   sent       the reply was saved
//   enough     the post has so many replies already that nothing more is saved
//   closed     the post is marked as done, so it takes no more replies
//   not-found  no such post, or it was taken down, or it is not a saved post
//   invalid    a field does not pass the checks; errors say which and why
//   failed     the file could not be read or written
export type ReplyAnswer =
  | { status: "sent" }
  | { status: "enough" }
  | { status: "closed" }
  | { status: "not-found" }
  | { status: "invalid"; errors: NewReplyErrors }
  | { status: "failed" };

// Anyone can send a request to the server, not only our form. So the input can
// be anything at all, and every field is read as text or treated as empty.
function fieldsFrom(input: unknown): NewReplyFields {
  const record: Record<string, unknown> =
    input instanceof Object ? (input as Record<string, unknown>) : {};
  function text(name: string): string {
    const value = record[name];
    return typeof value === "string" ? value : "";
  }
  return {
    message: text("message"),
    name: text("name"),
    contact: text("contact"),
  };
}

// Checks a reply again, then saves it. Only the three fields of the form are
// used, so nobody can choose a time or any other field from the outside. An id
// of the wrong shape is refused before the file is opened.
export async function replyToPostFromInput(
  id: unknown,
  input: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ReplyAnswer> {
  if (isPostId(id) === false) return { status: "not-found" };
  const checked = validateNewReply(fieldsFrom(input));
  if (checked.ok === false) return { status: "invalid", errors: checked.errors };
  try {
    const saved = await addReply(id, checked.reply, file, now);
    if (saved.ok === false) {
      return saved.reason === "closed"
        ? { status: "closed" }
        : { status: "not-found" };
    }
    return saved.stored ? { status: "sent" } : { status: "enough" };
  } catch (error) {
    // The details go to the terminal of the server, not to the browser. The
    // words of the reply are not part of the log.
    console.error("Saving a reply failed:", error);
    return { status: "failed" };
  }
}
