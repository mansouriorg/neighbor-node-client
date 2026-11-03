import { isPostId } from "@/lib/post-id";
import { addReport, defaultPostsFile } from "@/lib/post-store";
import { isReportReason } from "@/lib/report-reasons";

// What the server tells the browser after someone reports a post. It has to be
// plain data, because it travels over the network.
//   reported   the report was saved
//   enough     the post has been reported so often that nothing more is saved
//   not-found  no such post, or it was taken down, or it is not a saved post
//   invalid    the reason is not one of the known reasons
//   failed     the file could not be read or written
export type ReportAnswer =
  | { status: "reported" }
  | { status: "enough" }
  | { status: "not-found" }
  | { status: "invalid" }
  | { status: "failed" };

// Anyone can send a request to the server, not only our form. So the input can
// be anything at all. An id or a reason of the wrong shape is refused before
// the file is opened.
export async function reportPostFromInput(
  id: unknown,
  reason: unknown,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<ReportAnswer> {
  if (isPostId(id) === false) return { status: "not-found" };
  if (isReportReason(reason) === false) return { status: "invalid" };
  try {
    const saved = await addReport(id, reason, file, now);
    if (saved.ok === false) return { status: "not-found" };
    return saved.stored ? { status: "reported" } : { status: "enough" };
  } catch (error) {
    // The details go to the terminal of the server, not to the browser.
    console.error("Saving a report failed:", error);
    return { status: "failed" };
  }
}
