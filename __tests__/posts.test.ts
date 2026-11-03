import { expect, test } from "vitest";
import { postKindIds } from "@/lib/post-kinds";
import {
  filterPosts,
  findPost,
  parseKind,
  postStatusIds,
  postStatusLabels,
  samplePosts,
} from "@/lib/posts";

test("there are nine sample posts with different ids", () => {
  expect(samplePosts.length).toBe(9);
  expect(new Set(samplePosts.map((post) => post.id)).size).toBe(9);
});

test("each kind has three sample posts", () => {
  for (const kind of postKindIds) {
    expect(samplePosts.filter((post) => post.kind === kind).length).toBe(3);
  }
});

test("every sample post is complete and uses a known kind and status", () => {
  for (const post of samplePosts) {
    expect(postKindIds).toContain(post.kind);
    expect(postStatusIds).toContain(post.status);
    expect(post.title.length).toBeGreaterThan(0);
    expect(post.details.length).toBeGreaterThan(0);
    expect(post.area.length).toBeGreaterThan(0);
    expect(post.postedLabel.length).toBeGreaterThan(0);
  }
});

test("areas never contain a number, so no exact address can slip in", () => {
  for (const post of samplePosts) {
    expect(post.area).not.toMatch(/[0-9]/);
  }
});

test("the three statuses have readable labels", () => {
  expect(postStatusLabels).toEqual({
    open: "Open",
    "in-progress": "In progress",
    done: "Done",
  });
});

test("parseKind accepts a known kind", () => {
  expect(parseKind("help")).toBe("help");
  expect(parseKind("offer")).toBe("offer");
  expect(parseKind("lend")).toBe("lend");
});

test("parseKind ignores anything else", () => {
  expect(parseKind(undefined)).toBeUndefined();
  expect(parseKind("")).toBeUndefined();
  expect(parseKind("HELP")).toBeUndefined();
  expect(parseKind("nonsense")).toBeUndefined();
  expect(parseKind(["help", "offer"])).toBeUndefined();
});

test("filterPosts returns every post when no kind is given", () => {
  expect(filterPosts(samplePosts, undefined).length).toBe(9);
});

test("filterPosts returns only the posts of the chosen kind", () => {
  const lend = filterPosts(samplePosts, "lend");
  expect(lend.length).toBe(3);
  expect(lend.every((post) => post.kind === "lend")).toBe(true);
});

test("findPost returns the post with that id", () => {
  const post = findPost("sample-4");
  expect(post?.id).toBe("sample-4");
  expect(post?.kind).toBe("help");
});

test("findPost returns nothing for an id that does not exist", () => {
  expect(findPost("nope")).toBeUndefined();
  expect(findPost("")).toBeUndefined();
  expect(findPost("SAMPLE-1")).toBeUndefined();
  expect(findPost("sample-1/../sample-2")).toBeUndefined();
});
