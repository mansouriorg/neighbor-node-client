import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusMessage } from "@/components/status-message";

test("the round picture at the top is only decoration, so screen readers skip it", () => {
  const { container } = render(<StatusMessage title="Hello" message="Text" />);
  const picture = container.querySelector("main > span[aria-hidden='true']");
  expect(picture).not.toBeNull();
  expect(picture?.querySelector("svg")).not.toBeNull();
  expect(picture?.textContent).toBe("");
});

test("the code is shown in a small pill, above the title", () => {
  const { container } = render(<StatusMessage code="404" title="Hello" message="Text" />);
  const code = screen.getByText("404");
  expect(code.className).toContain("rounded-full");
  const children = Array.from(container.querySelector("main")?.children ?? []);
  expect(children.indexOf(code)).toBeLessThan(children.indexOf(screen.getByRole("heading", { level: 1 })));
});

test("the page still says one thing: one main heading, one message", () => {
  render(<StatusMessage title="Post not found" message="It is gone." />);
  expect(screen.getAllByRole("heading").length).toBe(1);
  expect(screen.getByRole("heading", { level: 1, name: "Post not found" })).toBeDefined();
  expect(screen.getByText("It is gone.")).toBeDefined();
});
