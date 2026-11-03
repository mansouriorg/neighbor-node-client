import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditPostForm } from "@/components/edit-post-form";
import { iconNames } from "@/components/icons";
import type { Post } from "@/lib/posts";

const post: Post = {
  id: "post-1",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

function show() {
  return render(<EditPostForm post={post} busy={false} onSave={async () => null} />);
}

test("the new pictures of the private page exist", () => {
  for (const name of ["pencil", "trash", "refresh"]) {
    expect(iconNames.includes(name as (typeof iconNames)[number])).toBe(true);
  }
});

test("the heading and the button have a pencil that screen readers skip, and the button keeps its name", () => {
  show();
  const heading = screen.getByRole("heading", { level: 3, name: "Edit your post" });
  expect(heading.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  const button = screen.getByRole("button", { name: "Edit my post" });
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(button.className).toContain("h-11");
});

test("the fields of the edit form look like the fields of every other form", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Edit my post" }));
  for (const label of ["Title", "Details", "Street or area"]) {
    const field = screen.getByLabelText(label);
    expect(field.className).toContain("bg-background");
    expect(field.className).toContain("aria-invalid:border-danger");
  }
});

test("an empty title is shown with a warning picture, and the field is marked", () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Edit my post" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  const message = document.getElementById("edit-post-title-error");
  expect(message?.querySelectorAll("svg").length).toBe(1);
  expect(message?.textContent?.startsWith("Error: ")).toBe(true);
  expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
});
