import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import NewPostPage, { metadata } from "@/app/board/new/page";

test("has a page title of its own", () => {
  expect(metadata.title).toBe("Write a post");
});

test("shows the heading, the early version notice and the form", () => {
  render(<NewPostPage />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Write a post" }),
  ).toBeDefined();
  expect(screen.getByText(/shows on the board at once/)).toBeDefined();
  expect(screen.getByRole("button", { name: "Save my post" })).toBeDefined();
});

test("has a link back to the board", () => {
  render(<NewPostPage />);
  const link = screen.getByRole("link", { name: /Back to the board/ });
  expect(link.getAttribute("href")).toBe("/board");
});

test("is the target of the skip link", () => {
  render(<NewPostPage />);
  expect(document.querySelector("main")?.getAttribute("id")).toBe(
    "main-content",
  );
});
