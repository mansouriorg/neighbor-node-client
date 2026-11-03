import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

test("the header stays at the top while the page scrolls", () => {
  render(<SiteHeader />);
  const header = screen.getByRole("banner");
  expect(header.className).toContain("sticky");
  expect(header.className).toContain("top-0");
});

test("the header has a main navigation with the board in it, and a brand link", () => {
  render(<SiteHeader />);
  const nav = screen.getByRole("navigation", { name: "Main" });
  expect(nav.querySelectorAll("a").length).toBe(1);
  expect(screen.getAllByRole("link").length).toBe(2);
});

test("the little house in the brand is only decoration, so the link is named by its words", () => {
  render(<SiteHeader />);
  const brand = screen.getByRole("link", { name: "Neighbor Node" });
  const tile = brand.querySelector("[aria-hidden='true']");
  expect(tile).not.toBeNull();
  expect(tile?.textContent).toBe("");
});

test("the footer has links to the home page, the board and the page to write a post", () => {
  render(<SiteFooter />);
  const nav = screen.getByRole("navigation", { name: "Footer" });
  const links = Array.from(nav.querySelectorAll("a"));
  expect(links.map((link) => link.textContent)).toEqual(["Home", "The board", "Write a post"]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/board", "/board/new"]);
});

test("the footer says it is an early version once, and says the posts show only an area", () => {
  render(<SiteFooter />);
  expect(screen.getAllByText(/early version/).length).toBe(1);
  expect(screen.getByText(/only a street or an area/)).toBeDefined();
  expect(screen.getByText("Your privacy")).toBeDefined();
});

test("each link of the footer is tall enough to tap", () => {
  render(<SiteFooter />);
  for (const link of screen.getAllByRole("link")) {
    expect(link.className).toContain("min-h-11");
  }
});
