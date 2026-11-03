"use server";

import { headers } from "next/headers";
import { replyLimits } from "@/lib/live-reply-limits";
import { visitorKey } from "@/lib/post-limits";
import { replyToPostWithinLimits, type ReplyReply } from "@/lib/reply-limits";

// The post page calls this when someone sends a reply to a post. Anyone can
// call it, also without our form, so the id and the fields are checked again
// inside, and so is the limit on how many replies one visitor can send in an
// hour. A file with "use server" at the top may export only async functions.
export async function replyToPost(
  id: unknown,
  input: unknown,
): Promise<ReplyReply> {
  const visitor = visitorKey(await headers());
  return replyToPostWithinLimits(id, input, visitor, replyLimits);
}
