"use server";

import { headers } from "next/headers";
import { reportLimits } from "@/lib/live-report-limits";
import { visitorKey } from "@/lib/post-limits";
import { reportPostWithinLimits, type ReportReply } from "@/lib/report-limits";

// The post page calls this when someone sends a report about a post.
// Anyone can call it, also without our form, so the id and the reason are
// checked again inside, and so is the limit on how many reports one visitor can
// send in an hour. A file with "use server" at the top may export only async
// functions.
export async function reportPost(
  id: unknown,
  reason: unknown,
): Promise<ReportReply> {
  const visitor = visitorKey(await headers());
  return reportPostWithinLimits(id, reason, visitor, reportLimits);
}
