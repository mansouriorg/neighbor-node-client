import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import NewPostPage from "@/app/board/new/page";
import type { Post } from "@/lib/posts";
import { postKindIds } from "@/lib/post-kinds";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { savePost: vi.fn() };
vi.mock("@/app/board/new/actions", () => ({
  savePost: (input: unknown) => mocks.savePost(input),
}));

beforeEach(() => {
  mocks.savePost.mockReset();
});

const savedPost: Post = {
  id: "post-1",
  kind: "lend",
  title: "A ladder for the weekend",
  details: "Three meters, light, easy to carry.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "Today",
};

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

test("next to the form there is a short list of things to know, with a picture for each", () => {
  render(<NewPostPage />);
  const aside = document.querySelector("aside");
  expect(aside?.getAttribute("aria-labelledby")).toBe("before-you-post");
  expect(within(aside as HTMLElement).getByRole("heading", { level: 2, name: "Before you post" })).toBeDefined();
  const items = within(aside as HTMLElement).getAllByRole("listitem");
  expect(items.length).toBe(3);
  expect(items.map((item) => item.querySelectorAll("svg").length)).toEqual([1, 1, 1]);
  for (const item of items) {
    expect(item.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("the list says the things that are true: no numbers in the area, a private link, 30 days", () => {
  render(<NewPostPage />);
  const text = document.querySelector("aside")?.textContent ?? "";
  expect(text.includes("A street, never a number")).toBe(true);
  expect(text.includes("The area field does not accept numbers")).toBe(true);
  expect(text.includes("A private link")).toBe(true);
  expect(text.includes("it is shown only once")).toBe(true);
  expect(text.includes("30 days on the board")).toBe(true);
  expect(text.includes("hidden, never deleted")).toBe(true);
});

test("the early version notice has a picture that screen readers skip", () => {
  render(<NewPostPage />);
  const notice = screen.getByText("Early version.").closest("p");
  expect(notice?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the link back to the board has an arrow and keeps its name", () => {
  render(<NewPostPage />);
  const link = screen.getByRole("link", { name: "Back to the board" });
  expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the form is a card, and its fields are drawn on the soft background", () => {
  render(<NewPostPage />);
  const form = document.querySelector("form");
  expect(form?.className).toContain("shadow-card");
  expect(form?.className).toContain("rounded-3xl");
  for (const label of ["Title", "Details", "Street or area"]) {
    expect(screen.getByLabelText(label).className).toContain("bg-background");
  }
});

test("each kind of post has a card with the picture and the color of its kind", () => {
  render(<NewPostPage />);
  const radios = screen.getAllByRole("radio");
  expect(radios.length).toBe(3);
  const tiles = radios.map((radio) => radio.closest("label")?.querySelector("span[aria-hidden='true']"));
  postKindIds.forEach((id, index) => {
    expect(tiles[index]?.className).toContain(`bg-${id}-soft`);
    expect(tiles[index]?.querySelectorAll("svg").length).toBe(1);
  });
  const pictures = tiles.map((tile) => tile?.innerHTML);
  expect(new Set(pictures).size).toBe(3);
});

test("the cards still have the words of the kind as their name", () => {
  render(<NewPostPage />);
  expect(screen.getByRole("radio", { name: /^Help wanted/ })).toBeDefined();
  expect(screen.getByRole("radio", { name: /^Offer/ })).toBeDefined();
  expect(screen.getByRole("radio", { name: /^Lend/ })).toBeDefined();
});

test("the list of problems has a warning picture, and each message under a field has one too", () => {
  render(<NewPostPage />);
  fireEvent.click(screen.getByRole("button", { name: "Save my post" }));
  const alert = screen.getByRole("alert");
  const heading = within(alert).getByRole("heading", { name: "There are 4 things to fix" });
  expect(heading.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(within(alert).getAllByRole("link").length).toBe(4);
  for (const id of ["new-post-kind", "new-post-title", "new-post-details", "new-post-area"]) {
    const message = document.getElementById(`${id}-error`);
    expect(message?.querySelectorAll("svg").length).toBe(1);
    expect(message?.textContent?.startsWith("Error: ")).toBe(true);
  }
  expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
});

test("a post that is saved shows a check mark, and the box with the private link has a key", async () => {
  mocks.savePost.mockResolvedValue({ status: "saved", post: savedPost, manageKey: "k".repeat(64) });
  render(<NewPostPage />);
  fireEvent.click(screen.getByRole("radio", { name: /^Lend/ }));
  fill("Title", "A ladder for the weekend");
  fill("Details", "Three meters, light, easy to carry.");
  fill("Street or area", "Harbor Road area");
  fireEvent.click(screen.getByRole("button", { name: "Save my post" }));
  const heading = await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
  const section = heading.closest("section");
  expect(section?.className).toContain("shadow-card");
  expect(heading.parentElement?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  const box = screen.getByRole("heading", { level: 3, name: "Your private link" }).parentElement;
  expect(box?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});
