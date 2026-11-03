import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { describedBy, FieldError } from "@/components/field-error";

test("shows nothing when the field is fine", () => {
  const { container } = render(<FieldError id="post-title" message={undefined} />);
  expect(container.firstChild).toBeNull();
});

test("shows the message under the field, with the word Error for screen readers", () => {
  const { container } = render(<FieldError id="post-title" message="Write a short title." />);
  const message = container.querySelector("p");
  expect(message?.getAttribute("id")).toBe("post-title-error");
  expect(message?.textContent).toBe("Error: Write a short title.");
  expect(message?.querySelector("span.sr-only")?.textContent).toBe("Error: ");
});

test("has a warning picture that screen readers skip", () => {
  const { container } = render(<FieldError id="post-title" message="Write a short title." />);
  const pictures = container.querySelectorAll("svg");
  expect(pictures.length).toBe(1);
  expect(pictures[0].getAttribute("aria-hidden")).toBe("true");
});

test("the message is red", () => {
  const { container } = render(<FieldError id="a" message="x" />);
  expect(container.querySelector("p")?.className).toContain("text-danger");
});

test("a field is tied to its hint, and to its message when it has one", () => {
  expect(describedBy("reply-name", undefined)).toBe("reply-name-hint");
  expect(describedBy("reply-name", "Too long.")).toBe("reply-name-hint reply-name-error");
});
