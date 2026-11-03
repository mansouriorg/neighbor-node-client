import { expect, test } from "vitest";
import { kindBarClassName } from "@/components/kind-colors";
import { postKindIds } from "@/lib/post-kinds";

test("every kind of post has a color for its bar, and the three colors differ", () => {
  const colors = postKindIds.map((id) => kindBarClassName[id]);
  expect(colors.length).toBe(3);
  expect(new Set(colors).size).toBe(3);
});

test("the color of each bar is the color of its kind", () => {
  for (const id of postKindIds) {
    expect(kindBarClassName[id]).toBe(`bg-${id}`);
  }
});

test("there is a color for the three kinds and for nothing else", () => {
  expect(Object.keys(kindBarClassName).sort()).toEqual([...postKindIds].sort());
});
