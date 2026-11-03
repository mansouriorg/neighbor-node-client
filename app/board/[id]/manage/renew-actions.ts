"use server";

import { headers } from "next/headers";
import { manageLimits } from "@/lib/live-manage-limits";
import type { ManageReply } from "@/lib/manage-limits";
import { visitorKey } from "@/lib/post-limits";
import { renewOwnPostWithinLimits } from "@/lib/renew-own-post-limits";

// The private page calls this to keep the post up: the 30 days start again.
// Anyone can call it, also without our page, so the key is checked again
// inside, on every call. The call also counts the wrong tries of the visitor,
// see lib/renew-own-post-limits.ts. A file with "use server" at the top may
// export only async functions.
export async function renewPost(
  id: unknown,
  key: unknown,
): Promise<ManageReply> {
  const visitor = visitorKey(await headers());
  return renewOwnPostWithinLimits(id, key, visitor, manageLimits);
}
