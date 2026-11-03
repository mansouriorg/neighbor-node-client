import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { KindFilter } from "@/components/kind-filter";

test("has a link for all posts and one for each kind, pointing at the board", () => {
  render(<KindFilter active={undefined} />);
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual([
    "All posts",
    "Help wanted",
    "Offer",
    "Lend",
  ]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/board",
    "/board?kind=help",
    "/board?kind=offer",
    "/board?kind=lend",
  ]);
});

test("is a navigation landmark with a name", () => {
  render(<KindFilter active={undefined} />);
  expect(
    screen.getByRole("navigation", { name: "Filter posts by kind" }),
  ).toBeDefined();
});

test("marks All posts as current when no kind is chosen", () => {
  render(<KindFilter active={undefined} />);
  expect(
    screen.getByRole("link", { name: "All posts" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "Lend" }).getAttribute("aria-current"),
  ).toBeNull();
});

test("marks only the chosen kind as current", () => {
  render(<KindFilter active="offer" />);
  const current = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
  expect(current.length).toBe(1);
  expect(current[0].textContent).toBe("Offer");
});
