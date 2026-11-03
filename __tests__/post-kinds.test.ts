import { expect, test } from "vitest";
import { postKindIds, postKindInfo } from "@/lib/post-kinds";

test("there are three kinds: help, offer and lend", () => {
  expect([...postKindIds]).toEqual(["help", "offer", "lend"]);
});

test("every kind has a label, a summary and an example", () => {
  for (const id of postKindIds) {
    expect(postKindInfo[id].label.length).toBeGreaterThan(0);
    expect(postKindInfo[id].summary.length).toBeGreaterThan(0);
    expect(postKindInfo[id].example.length).toBeGreaterThan(0);
  }
});

test("labels are different from each other", () => {
  const labels = postKindIds.map((id) => postKindInfo[id].label);
  expect(new Set(labels).size).toBe(postKindIds.length);
});
