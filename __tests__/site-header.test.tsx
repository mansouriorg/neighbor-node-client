import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

test("the header has a brand link to the home page", () => {
  render(<SiteHeader />);
  const link = screen.getByRole("link", { name: "Neighbor Node" });
  expect(link.getAttribute("href")).toBe("/");
});

test("the header links to the board", () => {
  render(<SiteHeader />);
  const link = screen.getByRole("link", { name: "Board" });
  expect(link.getAttribute("href")).toBe("/board");
});

test("the header tells visitors this is an early version", () => {
  render(<SiteHeader />);
  expect(screen.getByText("Early version")).toBeDefined();
});

test("the footer is a landmark with a short note", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("contentinfo")).toBeDefined();
  expect(screen.getByText(/early version/)).toBeDefined();
});
