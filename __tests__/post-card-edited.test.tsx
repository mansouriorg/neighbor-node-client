import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/post-card";
import { samplePosts, type Post } from "@/lib/posts";

const saved: Post = {
  id: "post-7",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "3 days ago",
};

// The line at the bottom of a card: the area, the time, and maybe a label.
// Each part is one child, so the tests can check the order without checking
// how the parts are drawn.
function partsOf(footer: Element | null | undefined): string[] {
  return Array.from(footer?.children ?? []).map((part) => part.textContent ?? "");
}

test("a post that was edited says so next to the time it was posted", () => {
  render(
    <ul>
      <PostCard post={{ ...saved, editedLabel: "Edited today" }} />
    </ul>,
  );
  expect(screen.getByText("3 days ago")).toBeDefined();
  expect(screen.getByText("Edited today")).toBeDefined();
  const footer = screen.getByText("Edited today").parentElement;
  expect(partsOf(footer)).toEqual(["Harbor Road area", "3 days ago", "Edited today"]);
});

test("the little pictures in the footer are only for the eyes, not for a screen reader", () => {
  render(
    <ul>
      <PostCard post={{ ...saved, editedLabel: "Edited yesterday" }} />
    </ul>,
  );
  const footer = screen.getByText("Edited yesterday").parentElement;
  const pictures = footer?.querySelectorAll("svg") ?? [];
  const hidden = footer?.querySelectorAll('svg[aria-hidden="true"]') ?? [];
  expect(pictures.length).toBe(2);
  expect(hidden.length).toBe(2);
});

test("a post that was never edited shows no label and only the area and the time", () => {
  render(
    <ul>
      <PostCard post={saved} />
    </ul>,
  );
  expect(screen.queryByText(/Edited/)).toBeNull();
  const footer = screen.getByText("3 days ago").parentElement?.parentElement;
  expect(partsOf(footer)).toEqual(["Harbor Road area", "3 days ago"]);
});

test("a sample post has no label, and an example mark still sits at the end", () => {
  render(
    <ul>
      <PostCard post={samplePosts[0]} example />
    </ul>,
  );
  expect(screen.queryByText(/Edited/)).toBeNull();
  expect(screen.getByText("Example")).toBeDefined();
});

test("an edited example keeps the Example mark after the label", () => {
  render(
    <ul>
      <PostCard post={{ ...saved, editedLabel: "Edited today" }} example />
    </ul>,
  );
  const footer = screen.getByText("Edited today").parentElement;
  expect(footer?.lastElementChild?.textContent).toBe("Example");
  expect(partsOf(footer)).toEqual(["Harbor Road area", "3 days ago", "Edited today", "Example"]);
});
