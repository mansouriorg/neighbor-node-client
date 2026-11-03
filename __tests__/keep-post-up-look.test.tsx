import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeepPostUp, percentLeft } from "@/components/keep-post-up";
import type { Post, PostKeep } from "@/lib/posts";

function postWith(keep: PostKeep): Post {
  return {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    postedLabel: "Today",
    keep,
  };
}

function show(keep: PostKeep) {
  return render(<KeepPostUp post={postWith(keep)} busy={false} onRenew={async () => null} />);
}

function bar() {
  return document.querySelector("div[aria-hidden='true'] > div") as HTMLElement | null;
}

test("the bar shows how much of the time is left, and never disappears", () => {
  expect(percentLeft(30)).toBe(100);
  expect(percentLeft(15)).toBe(50);
  expect(percentLeft(1)).toBe(4);
  expect(percentLeft(0)).toBe(4);
  expect(percentLeft(300)).toBe(100);
});

test("a post with days left has a bar of the right length, hidden from screen readers", () => {
  show({ state: "shown", daysLeft: 15 });
  expect(bar()?.style.width).toBe("50%");
  expect(bar()?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Your post stays on the board for 15 more days.")).toBeDefined();
});

test("a post that is hidden, or done, has no bar", () => {
  const first = show({ state: "hidden" });
  expect(bar()).toBeNull();
  first.unmount();
  show({ state: "done" });
  expect(bar()).toBeNull();
});

test("the heading and the button have a picture that screen readers skip, and the button keeps its name", () => {
  show({ state: "shown", daysLeft: 30 });
  const heading = screen.getByRole("heading", { level: 3, name: "Keep your post up" });
  expect(heading.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  const button = screen.getByRole("button", { name: "Keep my post up" });
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(button.className).toContain("h-11");
});
