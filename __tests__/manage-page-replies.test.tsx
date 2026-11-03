import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
const mocks = { readPosts: vi.fn(), check: vi.fn(), load: vi.fn() };
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
vi.mock("@/app/board/[id]/manage/replies-actions", () => ({
  loadReplies: (...args: unknown[]) => mocks.load(...args),
}));

const key = "a".repeat(64);

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.check.mockReset();
  mocks.load.mockReset();
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  mocks.load.mockResolvedValue({ status: "ok", replies: [] });
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

test("when the link fits, the page shows the replies of this post, asked with this id and this key", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  mocks.check.mockResolvedValue({
    status: "ok",
    post: saved,
    reports: { total: 0, byReason: [] },
  });
  mocks.load.mockResolvedValue({
    status: "ok",
    replies: [{ message: "I could use it on Saturday.", name: "Karim", when: "Today" }],
  });
  window.location.hash = `#${key}`;
  await renderManage("post-a");
  expect(await screen.findByRole("heading", { level: 3, name: "Replies" })).toBeDefined();
  expect(await screen.findByText("I could use it on Saturday.")).toBeDefined();
  expect(mocks.load).toHaveBeenCalledWith("post-a", key);
});

test("the note under the panel says that the address also opens the replies", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  await renderManage("post-a");
  const note = screen.getByText(/Keep this address private/).parentElement;
  expect(note?.textContent).toContain("can edit your post, change its status or take it down");
  expect(note?.textContent).toContain("it also opens the replies to your post");
});

test("when the link does not fit, the replies are never asked for", async () => {
  mocks.readPosts.mockResolvedValue([saved]);
  window.location.hash = `#${key}`;
  await renderManage("post-a");
  await screen.findByRole("heading", { name: "This link does not match your post" });
  await waitFor(() => expect(mocks.check).toHaveBeenCalled());
  expect(mocks.load).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Replies" })).toBeNull();
});
