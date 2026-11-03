import { expect, test } from "vitest";
import { isPostId } from "@/lib/post-id";

test("accepts the ids of saved posts", () => {
  expect(isPostId("post-3f2a9c1e-8d4b-4c7a-9e51-0b6d2a7f4c11")).toBe(true);
  expect(isPostId("post-a")).toBe(true);
  expect(isPostId("post-A_b-9")).toBe(true);
});

test("the part after post- may be 1 to 64 characters long", () => {
  expect(isPostId(`post-${"a".repeat(64)}`)).toBe(true);
  expect(isPostId(`post-${"a".repeat(65)}`)).toBe(false);
  expect(isPostId("post-")).toBe(false);
});

test("sample ids and other texts are not ids of saved posts", () => {
  expect(isPostId("sample-1")).toBe(false);
  expect(isPostId("")).toBe(false);
  expect(isPostId("post")).toBe(false);
  expect(isPostId("Post-a")).toBe(false);
  expect(isPostId(" post-a")).toBe(false);
  expect(isPostId("post-a ")).toBe(false);
  expect(isPostId("post-a b")).toBe(false);
  expect(isPostId("post-../x")).toBe(false);
  expect(isPostId("post-a\n")).toBe(false);
});

test("anything that is not text is refused", () => {
  expect(isPostId(undefined)).toBe(false);
  expect(isPostId(null)).toBe(false);
  expect(isPostId(42)).toBe(false);
  expect(isPostId({ id: "post-a" })).toBe(false);
  expect(isPostId(["post-a"])).toBe(false);
});
