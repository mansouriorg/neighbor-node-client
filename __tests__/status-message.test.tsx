import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusMessage } from "@/components/status-message";

test("shows the title as the main heading", () => {
  render(<StatusMessage title="Hello" message="A short message." />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Hello" }),
  ).toBeDefined();
});

test("shows the message", () => {
  render(<StatusMessage title="Hello" message="A short message." />);
  expect(screen.getByText("A short message.")).toBeDefined();
});

test("shows the code only when one is given", () => {
  const { rerender } = render(<StatusMessage title="Hello" message="Text" />);
  expect(screen.queryByText("404")).toBeNull();
  rerender(<StatusMessage code="404" title="Hello" message="Text" />);
  expect(screen.getByText("404")).toBeDefined();
});

test("shows the actions it is given", () => {
  render(
    <StatusMessage title="Hello" message="Text">
      <button type="button">Do it</button>
    </StatusMessage>,
  );
  expect(screen.getByRole("button", { name: "Do it" })).toBeDefined();
});

test("has no empty actions area when there are no actions", () => {
  const { container } = render(<StatusMessage title="Hello" message="Text" />);
  expect(container.querySelector("main div")).toBeNull();
});
