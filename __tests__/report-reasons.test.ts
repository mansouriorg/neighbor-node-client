import { expect, test } from "vitest";
import {
  isReportReason,
  reportReasonIds,
  reportReasonLabels,
} from "@/lib/report-reasons";

test("there are five reasons, in this order", () => {
  expect([...reportReasonIds]).toEqual([
    "spam",
    "private",
    "scam",
    "unsafe",
    "other",
  ]);
});

test("every reason has its own words, written for a person", () => {
  const words = reportReasonIds.map((id) => reportReasonLabels[id]);
  expect(words.length).toBe(5);
  expect(new Set(words).size).toBe(5);
  for (const text of words) {
    expect(text.length).toBeGreaterThan(5);
    expect(text).toBe(text.trim());
  }
  expect(Object.keys(reportReasonLabels).sort()).toEqual([...reportReasonIds].sort());
});

test("the known reasons are accepted", () => {
  for (const id of reportReasonIds) expect(isReportReason(id)).toBe(true);
});

test("anything else is refused, also texts that nearly fit", () => {
  expect(isReportReason("")).toBe(false);
  expect(isReportReason("Spam")).toBe(false);
  expect(isReportReason("spam ")).toBe(false);
  expect(isReportReason("rude")).toBe(false);
  expect(isReportReason("constructor")).toBe(false);
  expect(isReportReason("__proto__")).toBe(false);
  expect(isReportReason(undefined)).toBe(false);
  expect(isReportReason(null)).toBe(false);
  expect(isReportReason(1)).toBe(false);
  expect(isReportReason(["spam"])).toBe(false);
  expect(isReportReason({ reason: "spam" })).toBe(false);
});
