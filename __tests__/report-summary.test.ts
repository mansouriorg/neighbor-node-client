import { expect, test } from "vitest";
import { summarizeReports } from "@/lib/report-summary";
import type { ReportReason } from "@/lib/report-reasons";

function reports(...reasons: ReportReason[]) {
  return reasons.map((reason) => ({ reason }));
}

test("no reports at all gives zero and an empty list", () => {
  expect(summarizeReports(undefined)).toEqual({ total: 0, byReason: [] });
  expect(summarizeReports([])).toEqual({ total: 0, byReason: [] });
});

test("counts every reason on its own and the total", () => {
  const summary = summarizeReports(reports("spam", "scam", "spam", "spam"));
  expect(summary.total).toBe(4);
  expect(summary.byReason).toEqual([
    { reason: "spam", count: 3 },
    { reason: "scam", count: 1 },
  ]);
});

test("lists only the reasons that were given", () => {
  const summary = summarizeReports(reports("other"));
  expect(summary.byReason.length).toBe(1);
  expect(summary.byReason[0]).toEqual({ reason: "other", count: 1 });
});

test("the order of the list is the order of the reasons, not the order of the reports", () => {
  const summary = summarizeReports(
    reports("other", "unsafe", "scam", "private", "spam"),
  );
  expect(summary.byReason.map((item) => item.reason)).toEqual([
    "spam",
    "private",
    "scam",
    "unsafe",
    "other",
  ]);
});

test("the total is the sum of the counts", () => {
  const summary = summarizeReports(
    reports("spam", "spam", "private", "other", "other", "other"),
  );
  expect(summary.total).toBe(6);
  expect(summary.byReason.reduce((sum, item) => sum + item.count, 0)).toBe(6);
});

test("the answer is plain data with the time and nothing else left out", () => {
  const given = [
    { reason: "spam" as const, at: "2026-10-25T10:00:00.000Z" },
    { reason: "scam" as const, at: "2026-10-25T11:00:00.000Z" },
  ];
  const summary = summarizeReports(given);
  expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  expect(Object.keys(summary).sort()).toEqual(["byReason", "total"]);
  expect(JSON.stringify(summary).includes("2026")).toBe(false);
});

test("the list that was given is not changed", () => {
  const given = reports("scam", "spam");
  summarizeReports(given);
  expect(given).toEqual([{ reason: "scam" }, { reason: "spam" }]);
});
