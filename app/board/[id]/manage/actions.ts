"use server";

import { headers } from "next/headers";
import { manageLimits } from "@/lib/live-manage-limits";
import {
  changeOwnPostStatusWithinLimits,
  checkOwnPostWithinLimits,
  removeOwnPostWithinLimits,
  type ManageReply,
  type RemoveReply,
} from "@/lib/manage-limits";
import { visitorKey } from "@/lib/post-limits";

// The private page calls these three functions. Anyone can call them, also
// without our page, so the key is checked again inside, on every call. Each call
// also counts the wrong tries of the visitor, see lib/manage-limits.ts.
// A file with "use server" at the top may export only async functions.

// Asks whether the key in the link fits the post, and what the post says now.
export async function checkManageLink(
  id: unknown,
  key: unknown,
): Promise<ManageReply> {
  const visitor = visitorKey(await headers());
  return checkOwnPostWithinLimits(id, key, visitor, manageLimits);
}

// Changes the status of the post, for example to "done".
export async function changePostStatus(
  id: unknown,
  key: unknown,
  status: unknown,
): Promise<ManageReply> {
  const visitor = visitorKey(await headers());
  return changeOwnPostStatusWithinLimits(id, key, status, visitor, manageLimits);
}

// Takes the post down. The page asks the person to confirm first, but this
// function does not rely on that: it only checks the key.
export async function removePost(
  id: unknown,
  key: unknown,
): Promise<RemoveReply> {
  const visitor = visitorKey(await headers());
  return removeOwnPostWithinLimits(id, key, visitor, manageLimits);
}
