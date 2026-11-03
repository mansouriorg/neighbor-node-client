import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PostPage from "@/app/board/[id]/page";
import type { Post } from "@/lib/posts";

// notFound() works by throwing. Here it throws a plain error the tests can look for.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// No test may read the real file with the posts of the person who runs the
// tests. The file is replaced by a stand-in that each test controls.
const mocks = { readPosts: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));

// The report and the reply forms call server actions, with stand-ins here.
vi.mock("@/app/board/[id]/actions", () => ({
  reportPost: async () => ({ status: "failed" }),
}));
vi.mock("@/app/board/[id]/reply-actions", () => ({
  replyToPost: async () => ({ status: "failed" }),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.readPosts.mockResolvedValue([]);
});

const saved: Post = {
  id: "post-b",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "3 days ago",
};

async function renderPost(post: Post) {
  mocks.readPosts.mockResolvedValue([post]);
  return render(await PostPage({ params: Promise.resolve({ id: post.id }) }));
}

test("a post that was edited says so under the time it was posted", async () => {
  await renderPost({ ...saved, editedLabel: "Edited today" });
  const group = screen.getByText("Posted").parentElement;
  const answers = Array.from(group?.querySelectorAll("dd") ?? []).map((item) => item.textContent);
  expect(answers).toEqual(["3 days ago", "Edited today"]);
});

test("the label is shown as text of the page, once", async () => {
  await renderPost({ ...saved, editedLabel: "Edited yesterday" });
  expect(screen.getAllByText("Edited yesterday").length).toBe(1);
});

test("a post that was never edited shows no label", async () => {
  await renderPost(saved);
  expect(screen.queryByText(/Edited/)).toBeNull();
  const group = screen.getByText("Posted").parentElement;
  expect(group?.querySelectorAll("dd").length).toBe(1);
});

test("the label does not change where the area and the other words are", async () => {
  await renderPost({ ...saved, editedLabel: "Edited 2 days ago" });
  expect(screen.getByRole("heading", { level: 1, name: saved.title })).toBeDefined();
  expect(screen.getByText(saved.details)).toBeDefined();
  expect(screen.getByText("Harbor Road area")).toBeDefined();
  expect(screen.getByText("Where")).toBeDefined();
});
