import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import PostNotFound from "@/app/board/[id]/not-found";

test("says the post was not found and links back to the board", () => {
  render(<PostNotFound />);
  expect(screen.getByText("404")).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 1, name: "Post not found" }),
  ).toBeDefined();
  const link = screen.getByRole("link", { name: "Back to the board" });
  expect(link.getAttribute("href")).toBe("/board");
});
