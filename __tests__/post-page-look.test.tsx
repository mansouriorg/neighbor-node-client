import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PostPage from "@/app/board/[id]/page";
import type { Post } from "@/lib/posts";
import { postKindIds } from "@/lib/post-kinds";

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

async function renderSample(id: string) {
  return render(await PostPage({ params: Promise.resolve({ id }) }));
}

test("the bar at the top of the post has the color of its kind, a different one for each kind", async () => {
  const classes: string[] = [];
  for (const kind of postKindIds) {
    const { unmount } = await renderPost({ ...saved, kind });
    const bar = screen.getByRole("article").querySelector("span[aria-hidden='true'].absolute");
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain(`bg-${kind}`);
    classes.push(bar?.className ?? "");
    unmount();
  }
  expect(new Set(classes).size).toBe(3);
});

test("the area and the time each have a picture that screen readers skip", async () => {
  await renderPost(saved);
  for (const word of ["Where", "Posted"]) {
    const picture = screen.getByText(word).querySelector("svg");
    expect(picture?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("the reply form and the report button are next to the post, not inside it", async () => {
  await renderPost(saved);
  const article = screen.getByRole("article");
  expect(article.querySelector("button")).toBeNull();
  expect(screen.getByRole("button", { name: "Reply to this post" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Report this post" })).toBeDefined();
});

test("the notice of a saved post and the notice of a sample post have different pictures", async () => {
  const first = await renderPost(saved);
  const savedNotice = screen.getByText("Early version.").closest("p");
  expect(savedNotice?.querySelectorAll("svg").length).toBe(1);
  const savedPicture = savedNotice?.querySelector("svg")?.innerHTML;
  first.unmount();

  await renderSample("sample-1");
  const sampleNotice = screen.getByText("Sample post.").closest("p");
  expect(sampleNotice?.querySelectorAll("svg").length).toBe(1);
  expect(sampleNotice?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(sampleNotice?.querySelector("svg")?.innerHTML).not.toBe(savedPicture);
});

test("a post that is done says so with a check mark, and has no reply form", async () => {
  await renderPost({ ...saved, status: "done" });
  const notice = screen.getByText("This post is done.").closest("p");
  expect(notice?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByRole("button", { name: "Reply to this post" })).toBeNull();
});

test("the link back to the board has an arrow that screen readers skip, and keeps its name", async () => {
  await renderPost(saved);
  const link = screen.getByRole("link", { name: "Back to the board" });
  expect(link.getAttribute("href")).toBe("/board");
  expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

test("a very long word in a post breaks, so the page keeps its width", async () => {
  await renderPost({ ...saved, title: "W".repeat(90), details: "x".repeat(300), area: "A".repeat(80) });
  expect(screen.getByRole("heading", { level: 1 }).className).toContain("break-words");
  expect(screen.getByText("x".repeat(300)).className).toContain("break-words");
  expect(screen.getByText("A".repeat(80)).className).toContain("break-words");
  expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
});
