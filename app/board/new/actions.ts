"use server";

import { headers } from "next/headers";
import { postLimits } from "@/lib/live-post-limits";
import { savePostWithinLimits, visitorKey } from "@/lib/post-limits";
import type { SavePostResult } from "@/lib/save-post";

// The browser calls this when someone presses "Save my post".
// Anyone can call it, also without our form, so the checks happen again inside,
// and so does the limit on how many posts one visitor can save in an hour.
// A file with "use server" at the top may export only async functions.
export async function savePost(input: unknown): Promise<SavePostResult> {
  const visitor = visitorKey(await headers());
  return savePostWithinLimits(input, visitor, postLimits);
}
