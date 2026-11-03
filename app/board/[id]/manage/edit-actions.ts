"use server";

import { headers } from "next/headers";
import {
  editOwnPostWithinLimits,
  type EditOwnPostReply,
} from "@/lib/edit-own-post-limits";
import { editLimits } from "@/lib/live-edit-limits";
import { manageLimits } from "@/lib/live-manage-limits";
import { visitorKey } from "@/lib/post-limits";

// The private page calls this to save the new texts of the post. Anyone can
// call it, also without our page, so the key and the texts are checked again
// inside, on every call. Two limits count the tries of the visitor, see
// lib/edit-own-post-limits.ts. A file with "use server" at the top may export
// only async functions.
export async function editPost(
  id: unknown,
  key: unknown,
  input: unknown,
): Promise<EditOwnPostReply> {
  const visitor = visitorKey(await headers());
  return editOwnPostWithinLimits(id, key, input, visitor, manageLimits, editLimits);
}
