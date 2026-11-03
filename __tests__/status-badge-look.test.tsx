import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { StatusBadge } from "@/components/status-badge";
import { postStatusIds } from "@/lib/posts";

function look(status: (typeof postStatusIds)[number]) {
  const { container, unmount } = render(<StatusBadge status={status} />);
  const badge = container.querySelector("span");
  const dot = badge?.querySelector("span[aria-hidden='true']");
  const result = { badge: badge?.className ?? "", dot: dot?.className ?? "" };
  unmount();
  return result;
}

test("each status has its own colors, and its own dot", () => {
  const looks = postStatusIds.map((status) => look(status));
  expect(new Set(looks.map((item) => item.badge)).size).toBe(3);
  expect(new Set(looks.map((item) => item.dot)).size).toBe(3);
});

test("the badge is a pill with a border, so it also shows in high contrast mode", () => {
  for (const status of postStatusIds) {
    const words = look(status).badge.split(" ");
    expect(words.includes("rounded-full")).toBe(true);
    expect(words.includes("border")).toBe(true);
  }
});

test("a finished post gets the quiet colors, an open post gets the accent", () => {
  expect(look("done").badge).toContain("text-muted");
  expect(look("open").badge).toContain("text-accent");
  expect(look("in-progress").badge).toContain("text-help");
});

test("the dot is only decoration, and the words are not inside it", () => {
  const { container } = render(<StatusBadge status="in-progress" />);
  const dot = container.querySelector("span[aria-hidden='true']");
  expect(dot).not.toBeNull();
  expect(dot?.textContent).toBe("");
  expect(container.textContent).toBe("In progress");
});
