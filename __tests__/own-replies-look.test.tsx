import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnReplies } from "@/components/own-replies";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { load: vi.fn() };
vi.mock("@/app/board/[id]/manage/replies-actions", () => ({
  loadReplies: (...args: unknown[]) => mocks.load(...args),
}));

const key = "a".repeat(64);

beforeEach(() => {
  mocks.load.mockReset();
  window.location.hash = `#${key}`;
});

test("the heading has a speech bubble that screen readers skip", () => {
  mocks.load.mockReturnValue(new Promise(() => {}));
  render(<OwnReplies postId="post-1" />);
  const heading = screen.getByRole("heading", { level: 3, name: "Replies" });
  expect(heading.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("each reply has its own speech bubble, and its text is still only the words", async () => {
  mocks.load.mockResolvedValue({
    status: "ok",
    replies: [
      { message: "I can help on Saturday.", when: "Today", name: "Maria", contact: "maria@example.com" },
      { message: "Me too.", when: "Yesterday" },
    ],
  });
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 2 replies, the newest first.");
  const items = Array.from(document.querySelectorAll("li"));
  expect(items.length).toBe(2);
  for (const item of items) {
    expect(item.className).toContain("pl-16");
    const tile = item.querySelector("span[aria-hidden='true']");
    expect(tile?.querySelectorAll("svg").length).toBe(1);
    expect(tile?.textContent).toBe("");
  }
  expect(items[1].textContent).toBe("Me too.A neighbor wrote yesterday.No contact given.");
  expect(document.querySelectorAll("a").length).toBe(0);
});

test("the button that asks again has a picture, keeps its name, and shows the words while it checks", async () => {
  mocks.load.mockResolvedValue({ status: "ok", replies: [] });
  render(<OwnReplies postId="post-1" />);
  const button = await screen.findByRole("button", { name: "Check for new replies" });
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});
