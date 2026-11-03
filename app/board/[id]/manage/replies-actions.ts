"use server";

import { headers } from "next/headers";
import { manageLimits } from "@/lib/live-manage-limits";
import {
  readOwnRepliesWithinLimits,
  type OwnRepliesReply,
} from "@/lib/own-replies-limits";
import { visitorKey } from "@/lib/post-limits";

// The private page calls this to read the replies to the post. Anyone can call
// it, also without our page, so the key is checked again inside, on every call.
// A wrong try counts with the other wrong tries of the visitor, see
// lib/manage-limits.ts. A file with "use server" at the top may export only
// async functions.
export async function loadReplies(
  id: unknown,
  key: unknown,
): Promise<OwnRepliesReply> {
  const visitor = visitorKey(await headers());
  return readOwnRepliesWithinLimits(id, key, visitor, manageLimits);
}
