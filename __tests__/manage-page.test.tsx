import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ManagePostPage, { dynamic, metadata } from "@/app/board/[id]/manage/page";
import type { Post } from "@/lib/posts";

// notFound() works by throwing. Here it throws a plain error the tests can look for.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// No test may read the real file with the posts of the person who runs the
// tests, or talk to the server. Both are replaced by stand-ins.
const mocks = { readPosts: vi.fn(), check: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: async () => ({ status: "not-allowed" }),
  removePost: async () => ({ status: "not-allowed" }),
}));
// The edit form and the block that keeps the post up call their own server actions, stand-ins as well.
vi.mock("@/app/board/[id]/manage/renew-actions", () => ({
  renewPost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/edit-actions", () => ({
  editPost: async () => ({ status: "not-allowed" }),
}));
// The block with the replies calls its own server action, a stand-in as well.
vi.mock("@/app/board/[id]/manage/replies-actions", () => ({
  loadReplies: async () => ({ status: "not-allowed" }),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.check.mockReset();
  mocks.check.mockResolvedValue({ status: "not-allowed" });
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

async function renderManage(id: string) {
  return render(await ManagePostPage({ params: Promise.resolve({ id }) }));
}

test("is private: made fresh for every visit, and hidden from search engines", () => {
  expect(dynamic).toBe("force-dynamic");
  expect(metadata.title).toBe("Manage your post");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test("shows the heading, the title of the post, a way back and the panel", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  await renderManage("post-a");
  expect(screen.getByRole("heading", { level: 1, name: "Manage your post" })).toBeDefined();
  expect(screen.getByText("A drill for the weekend")).toBeDefined();
  expect(screen.getByRole("link", { name: /Back to your post/ }).getAttribute("href")).toBe("/board/post-a");
  expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeDefined();
  expect(screen.getByText(/Keep this address private/)).toBeDefined();
  expect(screen.getByText(/can edit your post, change its status or take it down/)).toBeDefined();
  expect(document.querySelector("main")?.getAttribute("id")).toBe("main-content");
});

test("the panel is given the id of the post, and asks about that post with the key in the address", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  const key = "a".repeat(64);
  window.location.hash = `#${key}`;
  await renderManage("post-a");
  await waitFor(() => expect(mocks.check).toHaveBeenCalledWith("post-a", key));
});

test("a sample post and an unknown post have no private page", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  await expect(renderManage("sample-1")).rejects.toThrow("NOT_FOUND");
  await expect(renderManage("post-zzz")).rejects.toThrow("NOT_FOUND");
});
