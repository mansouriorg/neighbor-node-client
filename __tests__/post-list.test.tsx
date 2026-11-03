import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostList } from "@/components/post-list";
import { samplePosts, type Post } from "@/lib/posts";

const savedPost: Post = {
  id: "post-7",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "Today",
};

test("shows one card for each post", () => {
  render(<PostList posts={samplePosts.slice(0, 3)} />);
  expect(screen.getAllByRole("listitem").length).toBe(3);
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(3);
});

test("shows a friendly message and no list when there are no posts", () => {
  render(<PostList posts={[]} />);
  expect(screen.getByText(/No posts here yet/)).toBeDefined();
  expect(screen.queryByRole("list")).toBeNull();
});

test("marks the sample posts as examples, and only them", () => {
  render(<PostList posts={[savedPost, ...samplePosts.slice(0, 2)]} />);
  expect(screen.getAllByText("Example").length).toBe(2);
  const first = screen.getAllByRole("listitem")[0];
  expect(first.textContent).toContain("A drill for the weekend");
  expect(first.textContent).not.toContain("Example");
});
