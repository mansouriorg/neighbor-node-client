import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer } from "@/lib/manage-post";
import type { Post, PostStatus } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), remove: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: async () => ({ status: "not-allowed" }),
  removePost: (...args: unknown[]) => mocks.remove(...args),
}));
vi.mock("@/app/board/[id]/manage/renew-actions", () => ({
  renewPost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/edit-actions", () => ({
  editPost: async () => ({ status: "not-allowed" }),
}));

const key = "a".repeat(64);

beforeEach(() => {
  mocks.check.mockReset();
  mocks.remove.mockReset();
  window.location.hash = `#${key}`;
});

function post(status: PostStatus): Post {
  return {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, about one hour.",
    area: "Olive Street",
    status,
    postedLabel: "Today",
  };
}

function ok(status: PostStatus): ManageAnswer {
  return { status: "ok", post: post(status), reports: { total: 0, byReason: [] } };
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

function hidden(element: Element | null | undefined) {
  return element?.querySelector("svg")?.getAttribute("aria-hidden");
}

test("a link without a key and a link that does not fit have a warning picture in front of the title", async () => {
  window.location.hash = "";
  const first = render(<ManagePostPanel postId="post-1" />);
  expect(hidden(screen.getByRole("heading", { name: "This link is incomplete" }))).toBe("true");
  first.unmount();
  window.location.hash = `#${key}`;
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  const heading = await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(hidden(heading)).toBe("true");
});

test("while the link is checked, a small wheel turns, and screen readers hear only the words", () => {
  mocks.check.mockReturnValue(new Promise(() => {}));
  render(<ManagePostPanel postId="post-1" />);
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("Checking your link...");
  const wheel = status.querySelector("span[aria-hidden='true']");
  expect(wheel?.className).toContain("animate-spin");
});

test("the three status buttons each have their own picture, and keep their names", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const buttons = screen.getAllByRole("button", { pressed: undefined }).filter((item) => item.hasAttribute("aria-pressed"));
  expect(buttons.length).toBe(3);
  expect(buttons.map((item) => item.querySelector("span.font-semibold")?.textContent)).toEqual(["Open", "In progress", "Done"]);
  const pictures = buttons.map((item) => item.querySelector("span[aria-hidden='true']")?.innerHTML);
  expect(new Set(pictures).size).toBe(3);
  for (const item of buttons) {
    expect(hidden(item)).toBe("true");
  }
});

test("the picture of the chosen status turns to the accent color", async () => {
  mocks.check.mockResolvedValue(ok("done"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const chosen = screen.getByRole("button", { name: /^Done/ });
  expect(chosen.getAttribute("aria-pressed")).toBe("true");
  expect(chosen.className.split(" ").includes("group")).toBe(true);
  expect(chosen.className).toContain("aria-pressed:border-accent");
  expect(chosen.className).toContain("aria-pressed:bg-accent-soft");
  expect(chosen.querySelector("span[aria-hidden='true']")?.className).toContain("group-aria-pressed:bg-accent");
});

test("everything is in one card, and each block has a picture in front of its heading", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const card = document.querySelector("section");
  expect(card?.className).toContain("shadow-card");
  expect(card?.className).toContain("max-w-3xl");
  expect(hidden(screen.getByRole("heading", { level: 3, name: "Reports" }))).toBe("true");
  expect(hidden(screen.getByRole("heading", { level: 3, name: "Take your post down" }))).toBe("true");
});

test("taking the post down sits behind a red line, apart from the other blocks", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const block = screen.getByRole("heading", { level: 3, name: "Take your post down" }).parentElement;
  const words = (block?.className ?? "").split(" ");
  expect(words.includes("border-t")).toBe(true);
  expect(words.includes("border-danger/40")).toBe(true);
});

test("a post that was taken down is confirmed with a check mark, and focus goes to the heading", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.remove.mockResolvedValue({ status: "removed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(screen.getByRole("button", { name: "Take this post down" }));
  fireEvent.click(await screen.findByRole("button", { name: "Yes, take it down" }));
  const heading = await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
  expect(heading.parentElement?.querySelector("span[aria-hidden='true'] svg")).not.toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(heading));
});
