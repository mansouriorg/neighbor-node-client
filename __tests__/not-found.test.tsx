import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

test("shows a 404 message with a link back to the home page", () => {
  render(<NotFound />);
  expect(screen.getByText("404")).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeDefined();
  const link = screen.getByRole("link", { name: "Back to home" });
  expect(link.getAttribute("href")).toBe("/");
});
