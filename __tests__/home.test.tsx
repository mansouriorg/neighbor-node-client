import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Home from "@/app/page";

// Finds the section that a heading belongs to.
function sectionOf(headingName: string): HTMLElement {
  const section = screen
    .getByRole("heading", { name: headingName })
    .closest("section");
  if (section === null) throw new Error(`No section found for "${headingName}"`);
  return section;
}

test("has one main heading that says what the app is for", () => {
  render(<Home />);
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings.length).toBe(1);
  expect(headings[0].textContent).toBe(
    "Ask for a hand. Offer one. Lend what you do not use.",
  );
});

test("lists the three kinds of posts", () => {
  render(<Home />);
  const items = within(sectionOf("Three kinds of posts")).getAllByRole(
    "listitem",
  );
  expect(items.length).toBe(3);
  expect(within(items[0]).getByText("Help wanted")).toBeDefined();
  expect(within(items[1]).getByText("Offer")).toBeDefined();
  expect(within(items[2]).getByText("Lend")).toBeDefined();
});

test("explains how it works in three steps", () => {
  render(<Home />);
  const section = sectionOf("How it works");
  expect(within(section).getAllByRole("listitem").length).toBe(3);
  expect(
    within(section).getByRole("heading", { level: 3, name: "Post it" }),
  ).toBeDefined();
  expect(
    within(section).getByRole("heading", { level: 3, name: "Mark it done" }),
  ).toBeDefined();
  expect(within(section).getByText(/Only you can read it/)).toBeDefined();
  expect(within(section).getByText(/Use your private link/)).toBeDefined();
});

test("has a button that opens the board", () => {
  render(<Home />);
  const link = screen.getByRole("link", { name: "Open the board" });
  expect(link.getAttribute("href")).toBe("/board");
});

test("has a second button that opens the form to write a post", () => {
  render(<Home />);
  const link = screen.getByRole("link", { name: "Write a post" });
  expect(link.getAttribute("href")).toBe("/board/new");
});

test("says plainly that this is an early version and what already works", () => {
  render(<Home />);
  const note = screen.getByText("Early version.").parentElement;
  expect(note?.textContent).toContain(
    "You can write a post, reply to one and report one.",
  );
  expect(note?.textContent).toContain("each post comes with a private link");
  expect(note?.textContent).toContain("made-up posts, marked Example");
});

test("does not promise things that already exist", () => {
  render(<Home />);
  expect(screen.queryByText(/for now/)).toBeNull();
  expect(screen.queryByText(/comes next/)).toBeNull();
  expect(screen.queryByText(/will show/)).toBeNull();
});

test("promises to show only a street or area", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", {
      level: 2,
      name: "Your address stays private",
    }),
  ).toBeDefined();
  expect(screen.getByText(/never an exact address/)).toBeDefined();
  expect(screen.getByText(/does not accept numbers/)).toBeDefined();
  expect(screen.getByText(/goes only to the author/)).toBeDefined();
});

test("is the target of the skip link and shows no starter text", () => {
  const { container } = render(<Home />);
  expect(container.querySelector("main")?.getAttribute("id")).toBe(
    "main-content",
  );
  expect(screen.queryByText(/To get started/)).toBeNull();
  expect(container.querySelector("img")).toBeNull();
});
