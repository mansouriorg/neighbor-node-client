import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Home from "@/app/page";
import { postKindIds } from "@/lib/post-kinds";

function sectionOf(headingName: string): HTMLElement {
  const section = screen
    .getByRole("heading", { name: headingName })
    .closest("section");
  if (section === null) throw new Error(`No section found for "${headingName}"`);
  return section;
}

function heroOf(): HTMLElement {
  const hero = screen.getByRole("heading", { level: 1 }).closest("section");
  if (hero === null) throw new Error("No section around the main heading");
  return hero;
}

test("the last sentence of the main heading has the accent color, and the words stay whole", () => {
  render(<Home />);
  const heading = screen.getByRole("heading", { level: 1 });
  const accent = heading.querySelector("span");
  expect(accent?.textContent).toBe("Lend what you do not use.");
  expect(accent?.className).toContain("text-accent");
  expect(heading.textContent).toBe("Ask for a hand. Offer one. Lend what you do not use.");
});

test("three short facts sit under the buttons, each with a check mark that screen readers skip", () => {
  render(<Home />);
  const items = within(heroOf()).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "No account needed",
    "Only a street or an area is shown",
    "Every post has a private link",
  ]);
  for (const item of items) {
    expect(item.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("the top of the page has the picture of the board, and only two links and no button", () => {
  const { container } = render(<Home />);
  const hero = heroOf();
  expect(hero.querySelectorAll("a").length).toBe(2);
  expect(hero.querySelectorAll("button").length).toBe(0);
  const picture = hero.querySelector("[aria-hidden='true'].isolate");
  expect(picture).not.toBeNull();
  expect(picture?.textContent).toContain("Help wanted");
  expect(container.querySelector("img")).toBeNull();
});

test("each kind of post has a link that opens the board with that kind chosen", () => {
  render(<Home />);
  const links = within(sectionOf("Three kinds of posts")).getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual([
    "See who needs a hand",
    "See what neighbors offer",
    "See what you can borrow",
  ]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    postKindIds.map((id) => `/board?kind=${id}`),
  );
});

test("each card of a kind has the bar of its color", () => {
  render(<Home />);
  const items = within(sectionOf("Three kinds of posts")).getAllByRole("listitem");
  postKindIds.forEach((id, index) => {
    const bar = items[index].querySelector("span[aria-hidden='true'].absolute");
    expect(bar?.className).toContain(`bg-${id}`);
  });
});

test("the steps are numbered 1, 2 and 3, and a line joins each step to the next", () => {
  render(<Home />);
  const section = sectionOf("How it works");
  const numbers = Array.from(section.querySelectorAll("li > span[aria-hidden='true']"))
    .filter((span) => (span.textContent ?? "").length > 0)
    .map((span) => span.textContent);
  expect(numbers).toEqual(["1", "2", "3"]);
  expect(section.querySelectorAll("span.border-dashed").length).toBe(2);
});

test("the box about the address has a lock that screen readers skip, and one heading", () => {
  render(<Home />);
  const section = sectionOf("Your address stays private");
  expect(section.querySelectorAll("svg[aria-hidden='true']").length).toBe(1);
  expect(within(section).getAllByRole("heading").length).toBe(1);
});

test("the two buttons at the top still have only their words as names", () => {
  render(<Home />);
  expect(screen.getAllByRole("link", { name: "Open the board" }).length).toBe(1);
  expect(screen.getAllByRole("link", { name: "Write a post" }).length).toBe(1);
});
