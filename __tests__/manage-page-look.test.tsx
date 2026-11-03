import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagePostPage from "@/app/board/[id]/manage/page";
import type { Post } from "@/lib/posts";

// notFound() works by throwing. Here it throws a plain error the tests can look for.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// No test may read the real file with the posts of the person who runs the
// tests, or talk to the server. Both are replaced by stand-ins.
const mocks = { readPosts: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: async () => ({ status: "not-allowed" }),
  changePostStatus: async () => ({ status: "not-allowed" }),
  removePost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/renew-actions", () => ({
  renewPost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/edit-actions", () => ({
  editPost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/replies-actions", () => ({
  loadReplies: async () => ({ status: "not-allowed" }),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  window.location.hash = "";
});

const saved: Post = {
  id: "post-a",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "Yesterday",
};

async function renderManage() {
  mocks.readPosts.mockResolvedValue([saved]);
  return render(await ManagePostPage({ params: Promise.resolve({ id: "post-a" }) }));
}

test("the link back to the post has an arrow that screen readers skip, and keeps its name", async () => {
  await renderManage();
  const link = screen.getByRole("link", { name: "Back to your post" });
  expect(link.getAttribute("href")).toBe("/board/post-a");
  expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("the note about the private address has a lock, and says the same words", async () => {
  await renderManage();
  const note = screen.getByText("Keep this address private.").closest("p");
  expect(note?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(note?.className).toContain("max-w-3xl");
  expect(note?.textContent).toBe(
    "Keep this address private. Anyone who has it can edit your post, change its status or take it down, and it also opens the replies to your post.",
  );
});
