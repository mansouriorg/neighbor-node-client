import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/post-card";
import { PostList } from "@/components/post-list";
import { samplePosts, type Post } from "@/lib/posts";
import { postKindIds } from "@/lib/post-kinds";

const base: Post = {
  id: "post-9",
  kind: "help",
  title: "Help with a ladder",
  details: "Just to hold it steady for ten minutes.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

// The thin bar at the top of a card. It is the only part of the card that is
// positioned on the very top edge.
function barOf(card: HTMLElement): HTMLElement | null {
  return card.querySelector("span[aria-hidden='true'].absolute");
}

test("the bar at the top of a card has the color of its kind, a different one for each kind", () => {
  const classes: string[] = [];
  for (const kind of postKindIds) {
    const { unmount } = render(
      <ul>
        <PostCard post={{ ...base, kind }} />
      </ul>,
    );
    const bar = barOf(screen.getByRole("listitem"));
    expect(bar).not.toBeNull();
    classes.push(bar?.className ?? "");
    expect(bar?.className).toContain(`bg-${kind}`);
    unmount();
  }
  expect(new Set(classes).size).toBe(3);
});

test("the bar is only decoration, so a screen reader skips it", () => {
  render(
    <ul>
      <PostCard post={base} />
    </ul>,
  );
  expect(barOf(screen.getByRole("listitem"))?.getAttribute("aria-hidden")).toBe("true");
});

test("a finished post looks quieter than an open one", () => {
  const open = render(
    <ul>
      <PostCard post={base} />
    </ul>,
  );
  const openCard = screen.getByRole("listitem");
  expect(openCard.className).toContain("bg-surface");
  expect(openCard.className).toContain("shadow-card");
  expect(barOf(openCard)?.className).not.toContain("opacity-40");
  expect(screen.getByRole("heading", { level: 2 }).className).not.toContain("text-muted");
  open.unmount();

  render(
    <ul>
      <PostCard post={{ ...base, status: "done" }} />
    </ul>,
  );
  const doneCard = screen.getByRole("listitem");
  expect(doneCard.className).toContain("bg-background");
  expect(doneCard.className).not.toContain("shadow-card");
  expect(barOf(doneCard)?.className).toContain("opacity-40");
  expect(screen.getByRole("heading", { level: 2 }).className).toContain("text-muted");
});

test("a long text is cut to three lines on the card, and the title stays the only link", () => {
  render(
    <ul>
      <PostCard post={{ ...base, details: "Very long words. ".repeat(60) }} />
    </ul>,
  );
  expect(screen.getByText(/Very long words/).className).toContain("line-clamp-3");
  expect(screen.getAllByRole("link").length).toBe(1);
});

test("the cards come in one after the other, but never wait for more than a short moment", () => {
  render(
    <ul>
      <PostCard post={base} index={0} />
      <PostCard post={{ ...base, id: "post-10" }} index={3} />
      <PostCard post={{ ...base, id: "post-11" }} index={40} />
    </ul>,
  );
  const delays = screen.getAllByRole("listitem").map((card) => card.style.animationDelay);
  expect(delays).toEqual(["0ms", "135ms", "360ms"]);
});

test("a list passes the place of each card on, so the cards come in one by one", () => {
  render(<PostList posts={samplePosts.slice(0, 3)} />);
  const delays = screen.getAllByRole("listitem").map((card) => card.style.animationDelay);
  expect(delays).toEqual(["0ms", "45ms", "90ms"]);
});

test("an empty list shows a picture that is hidden from screen readers, and the words", () => {
  const { container } = render(<PostList posts={[]} />);
  expect(screen.getByText(/No posts here yet/)).toBeDefined();
  expect(container.querySelectorAll("svg[aria-hidden='true']").length).toBe(1);
  expect(screen.queryByRole("list")).toBeNull();
});
