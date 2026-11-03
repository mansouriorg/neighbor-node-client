// The reasons a visitor can give when reporting a post. One place for the ids
// and the words, so the form, the server and the file always agree.
export const reportReasonIds = [
  "spam",
  "private",
  "scam",
  "unsafe",
  "other",
] as const;

export type ReportReason = (typeof reportReasonIds)[number];

export const reportReasonLabels: Record<ReportReason, string> = {
  spam: "Spam or an advertisement",
  private: "Shows an exact address or private details",
  scam: "Looks like a scam, or asks for money",
  unsafe: "Unkind, unsafe or against the law",
  other: "Something else",
};

export function isReportReason(value: unknown): value is ReportReason {
  return reportReasonIds.some((known) => known === value);
}
