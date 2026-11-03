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
// tests, or talk to the server. Both are replaced by stand-ins. The stand-in
// of readPosts writes down what it was asked, so the tests can look at it.
const asked: unknown[][] = [];
const mocks = { posts: [] as Post[] };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: async (...args: unknown[]) => {
    asked.push(args);
    return mocks.posts;
  },
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
  asked.length = 0;
  mocks.posts = [];
  window.location.hash = "";
});

const base: Post = {
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

test("asks the store for the hidden posts too, because the author needs the page of a hidden post", async () => {
  mocks.posts = [base];
  await renderManage("post-a");
  expect(asked.length).toBe(1);
  expect(asked[0][2]).toEqual({ includeHidden: true });
});

test("a hidden post still has its private page, with the heading and the title, but no way back to the post page", async () => {
  mocks.posts = [{ ...base, keep: { state: "hidden" } }];
  await renderManage("post-a");
  expect(screen.getByRole("heading", { level: 1, name: "Manage your post" })).toBeDefined();
  expect(screen.getByText("A drill for the weekend")).toBeDefined();
  expect(screen.queryByRole("link", { name: /Back to your post/ })).toBeNull();
  expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeDefined();
});

test("a post that is shown has the way back", async () => {
  mocks.posts = [{ ...base, keep: { state: "shown", daysLeft: 12 } }];
  await renderManage("post-a");
  expect(screen.getByRole("link", { name: /Back to your post/ }).getAttribute("href")).toBe("/board/post-a");
});

test("a post that is done has the way back", async () => {
  mocks.posts = [{ ...base, status: "done", keep: { state: "done" } }];
  await renderManage("post-a");
  expect(screen.getByRole("link", { name: /Back to your post/ }).getAttribute("href")).toBe("/board/post-a");
});

test("a post with no keep has the way back, as before", async () => {
  mocks.posts = [base];
  await renderManage("post-a");
  expect(screen.getByRole("link", { name: /Back to your post/ }).getAttribute("href")).toBe("/board/post-a");
});

test("a sample post and an unknown post still have no private page, and the file is not asked about a sample", async () => {
  mocks.posts = [{ ...base, keep: { state: "hidden" } }];
  await expect(renderManage("sample-1")).rejects.toThrow("NOT_FOUND");
  expect(asked.length).toBe(0);
  await expect(renderManage("post-zzz")).rejects.toThrow("NOT_FOUND");
  expect(asked.length).toBe(1);
});
