import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { KindFilter } from "@/components/kind-filter";
import { KindBadge } from "@/components/kind-badge";
import { postKindIds } from "@/lib/post-kinds";

test("each choice of the filter has one picture, hidden from screen readers", () => {
  render(<KindFilter active={undefined} />);
  for (const link of screen.getAllByRole("link")) {
    const pictures = link.querySelectorAll("svg");
    expect(pictures.length).toBe(1);
    expect(pictures[0].getAttribute("aria-hidden")).toBe("true");
  }
});

test("the name of a choice is only its words, the picture adds nothing to it", () => {
  render(<KindFilter active="lend" />);
  expect(screen.getByRole("link", { name: "All posts" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Help wanted" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Offer" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Lend" })).toBeDefined();
});

test("only the chosen kind is filled, the others have an outline", () => {
  render(<KindFilter active="help" />);
  const filled = screen.getAllByRole("link").filter((link) => link.className.includes("bg-accent "));
  expect(filled.length).toBe(1);
  expect(filled[0].textContent).toBe("Help wanted");
  for (const link of screen.getAllByRole("link")) {
    if (link === filled[0]) continue;
    expect(link.className).toContain("border-line");
  }
});

test("each choice is tall enough to tap", () => {
  render(<KindFilter active={undefined} />);
  for (const link of screen.getAllByRole("link")) {
    expect(link.className).toContain("h-11");
  }
});

test("a badge shows its kind with one picture and its words", () => {
  for (const kind of postKindIds) {
    const { container, unmount } = render(<KindBadge kind={kind} />);
    expect(container.querySelectorAll("svg[aria-hidden='true']").length).toBe(1);
    expect(container.textContent?.length).toBeGreaterThan(3);
    unmount();
  }
});
