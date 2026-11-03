import { reportReasonIds, type ReportReason } from "@/lib/report-reasons";

// How many times one reason was given.
export type ReportCount = {
  reason: ReportReason;
  count: number;
};

// What the author of a post may learn about its reports: how many there are,
// and how many for each reason. It is plain data, because it travels over the
// network, and it holds no time and nothing about who sent a report.
export type ReportSummary = {
  total: number;
  // Only the reasons that were given, always in the order of reportReasonIds.
  byReason: ReportCount[];
};

// Counts the reports of one post. A post that nobody reported has none.
export function summarizeReports(
  reports: ReadonlyArray<{ reason: ReportReason }> | undefined,
): ReportSummary {
  const list = reports ?? [];
  const byReason: ReportCount[] = [];
  for (const reason of reportReasonIds) {
    const count = list.filter((report) => report.reason === reason).length;
    if (count > 0) byReason.push({ reason, count });
  }
  return {
    total: byReason.reduce((sum, item) => sum + item.count, 0),
    byReason,
  };
}
