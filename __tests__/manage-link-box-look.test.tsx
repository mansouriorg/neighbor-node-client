import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManageLinkBox } from "@/components/manage-link-box";

const key = "b".repeat(64);

test("the heading has a key in front of it, and the picture is hidden from screen readers", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  const heading = screen.getByRole("heading", { level: 3, name: "Your private link" });
  const picture = heading.parentElement?.querySelector("svg");
  expect(picture?.getAttribute("aria-hidden")).toBe("true");
});

test("the copy button and the link to the private page have a picture, and keep their names", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  expect(screen.getByRole("button", { name: "Copy link" }).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByRole("link", { name: "Open your private page" }).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the link is shown in a field that cannot be edited, in letters of equal width", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  const field = screen.getByLabelText("Link to manage your post") as HTMLInputElement;
  expect(field.readOnly).toBe(true);
  expect(field.className).toContain("font-mono");
});

test("the box keeps a place for the message about copying, so a screen reader hears it", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  expect(screen.getByRole("status").textContent).toBe("");
});
