import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/post-card";
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

test("shows the title as a heading, with kind, status, area and time", () => {
  const post = samplePosts[0];
  render(
    <ul>
      <PostCard post={post} />
    </ul>,
  );
  expect(
    screen.getByRole("heading", { level: 2, name: post.title }),
  ).toBeDefined();
  expect(screen.getByText("Help wanted")).toBeDefined();
  expect(screen.getByText("Open")).toBeDefined();
  expect(screen.getByText(post.details)).toBeDefined();
  expect(screen.getByText(post.area)).toBeDefined();
  expect(screen.getByText(post.postedLabel)).toBeDefined();
});

test("the title is a link to the page of that post", () => {
  const post = samplePosts[3];
  render(
    <ul>
      <PostCard post={post} />
    </ul>,
  );
  const link = screen.getByRole("link", { name: post.title });
  expect(link.getAttribute("href")).toBe("/board/sample-4");
});

test("a saved post links to its own page too", () => {
  render(
    <ul>
      <PostCard post={savedPost} />
    </ul>,
  );
  const link = screen.getByRole("link", { name: savedPost.title });
  expect(link.getAttribute("href")).toBe("/board/post-7");
});

test("an example carries the small Example label", () => {
  render(
    <ul>
      <PostCard post={samplePosts[0]} example />
    </ul>,
  );
  expect(screen.getByText("Example")).toBeDefined();
});

test("a post without the example mark has no Example label", () => {
  render(
    <ul>
      <PostCard post={savedPost} />
    </ul>,
  );
  expect(screen.queryByText("Example")).toBeNull();
});

test("a very long word in a post is allowed to break, so the card keeps its width", () => {
  const long: Post = { ...savedPost, title: "W".repeat(80), details: "x".repeat(300) };
  render(
    <ul>
      <PostCard post={long} />
    </ul>,
  );
  const card = screen.getByRole("listitem");
  expect(card.className).toContain("[overflow-wrap:anywhere]");
});
