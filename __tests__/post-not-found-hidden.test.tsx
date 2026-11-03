import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import PostNotFound from "@/app/board/[id]/not-found";

// A visitor who opens the address of a hidden post gets this page. It must not
// say more than "not found", but it should tell the author what to do.
test("tells that a post can be missing because it was hidden after 30 days, and points the author to the private link", () => {
  render(<PostNotFound />);
  expect(screen.getByRole("heading", { level: 1, name: "Post not found" })).toBeDefined();
  const text = document.body.textContent ?? "";
  expect(text).toContain("does not exist");
  expect(text).toContain("taken down");
  expect(text).toContain("hidden because nothing happened to it for 30 days");
  expect(text).toContain("open your private link");
  expect(text).toContain("show it again from there");
});
