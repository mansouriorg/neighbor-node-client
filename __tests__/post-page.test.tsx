import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PostPage, { dynamic, generateMetadata } from "@/app/board/[id]/page";
import { samplePosts, type Post } from "@/lib/posts";

// notFound() works by throwing. Here it throws a plain error the tests can look for.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// No test may read the real file with the posts of the person who runs the
// tests. The file is replaced by a stand-in that each test controls.
const mocks = { readPosts: vi.fn(), report: vi.fn(), reply: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));

// The report button calls a server action. Here it is a stand-in that each
// test controls, so that no report is ever saved by a test.
vi.mock("@/app/board/[id]/actions", () => ({
  reportPost: (...args: unknown[]) => mocks.report(...args),
}));

// The reply form calls a server action too, with a stand-in in the same way.
vi.mock("@/app/board/[id]/reply-actions", () => ({
  replyToPost: (...args: unknown[]) => mocks.reply(...args),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.readPosts.mockResolvedValue([]);
  mocks.report.mockReset();
  mocks.reply.mockReset();
});

const savedLend: Post = {
  id: "post-b",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "Yesterday",
};

// The page is an async Server Component, so it is called like a function and awaited.
async function renderPost(id: string) {
  return render(await PostPage({ params: Promise.resolve({ id }) }));
}

test("is made fresh for every visit, so that the time words stay true", () => {
  expect(dynamic).toBe("force-dynamic");
});

test("shows the whole post with kind, status, area and time", async () => {
  const post = samplePosts[0];
  await renderPost(post.id);
  expect(
    screen.getByRole("heading", { level: 1, name: post.title }),
  ).toBeDefined();
  expect(screen.getByText(post.details)).toBeDefined();
  expect(screen.getByText("Help wanted")).toBeDefined();
  expect(screen.getByText("Open")).toBeDefined();
  expect(screen.getByText(post.area)).toBeDefined();
  expect(screen.getByText(post.postedLabel)).toBeDefined();
});

test("has a link back to the board", async () => {
  await renderPost("sample-2");
  const link = screen.getByRole("link", { name: /Back to the board/ });
  expect(link.getAttribute("href")).toBe("/board");
});

test("says that a sample post is a sample, and never opens the file for it", async () => {
  await renderPost("sample-3");
  expect(screen.getByText("Sample post.")).toBeDefined();
  expect(screen.queryByText("Early version.")).toBeNull();
  expect(mocks.readPosts).not.toHaveBeenCalled();
});

test("every sample post has a page that shows its title", async () => {
  for (const post of samplePosts) {
    const { unmount } = await renderPost(post.id);
    expect(
      screen.getByRole("heading", { level: 1, name: post.title }),
    ).toBeDefined();
    unmount();
  }
});

test("shows a saved post in full, with its own notice", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  await renderPost("post-b");
  expect(
    screen.getByRole("heading", { level: 1, name: savedLend.title }),
  ).toBeDefined();
  expect(screen.getByText(savedLend.details)).toBeDefined();
  expect(screen.getByText("Lend")).toBeDefined();
  expect(screen.getByText("Open")).toBeDefined();
  expect(screen.getByText(savedLend.area)).toBeDefined();
  expect(screen.getByText("Yesterday")).toBeDefined();
  expect(screen.getByText("Early version.")).toBeDefined();
  expect(screen.queryByText("Sample post.")).toBeNull();
});

test("a saved post has a button to report it", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  await renderPost("post-b");
  expect(
    screen.getByRole("button", { name: "Report this post" }),
  ).toBeDefined();
});

test("a sample post has no report button, because it is made up", async () => {
  await renderPost("sample-1");
  expect(
    screen.queryByRole("button", { name: "Report this post" }),
  ).toBeNull();
});

test("the report goes out with the id of this post and the chosen reason", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  mocks.report.mockResolvedValue({ status: "reported" });
  await renderPost("post-b");
  fireEvent.click(screen.getByRole("button", { name: "Report this post" }));
  fireEvent.click(
    screen.getByRole("radio", { name: "Looks like a scam, or asks for money" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send report" }));
  expect(
    await screen.findByRole("heading", {
      name: "Thank you. Your report was saved.",
    }),
  ).toBeDefined();
  expect(mocks.report).toHaveBeenCalledTimes(1);
  expect(mocks.report).toHaveBeenCalledWith("post-b", "scam");
});

test("is the target of the skip link", async () => {
  await renderPost("sample-1");
  expect(document.querySelector("main")?.getAttribute("id")).toBe(
    "main-content",
  );
});

test("asks Next to show the not-found page for an unknown id, without opening the file", async () => {
  await expect(
    PostPage({ params: Promise.resolve({ id: "nope" }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.readPosts).not.toHaveBeenCalled();
});

test("asks Next to show the not-found page for a saved-looking id that is not in the file", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  await expect(
    PostPage({ params: Promise.resolve({ id: "post-nope" }) }),
  ).rejects.toThrow("NOT_FOUND");
});

test("a file that cannot be read is an error, not a wrong 'not found'", async () => {
  mocks.readPosts.mockRejectedValue(new Error("boom, the file is damaged"));
  await expect(
    PostPage({ params: Promise.resolve({ id: "post-b" }) }),
  ).rejects.toThrow("boom");
});

test("the page title is the post title and the description is its text", async () => {
  const post = samplePosts[1];
  const metadata = await generateMetadata({
    params: Promise.resolve({ id: post.id }),
  });
  expect(metadata.title).toBe(post.title);
  expect(metadata.description).toBe(post.details);
});

test("the page title and description of a saved post come from the post", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  const metadata = await generateMetadata({
    params: Promise.resolve({ id: "post-b" }),
  });
  expect(metadata.title).toBe(savedLend.title);
  expect(metadata.description).toBe(savedLend.details);
});

test("no post page, sample or saved, can be listed by search engines", async () => {
  mocks.readPosts.mockResolvedValue([savedLend]);
  for (const id of ["sample-1", "post-b"]) {
    const metadata = await generateMetadata({ params: Promise.resolve({ id }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  }
});

test("an unknown id gets a plain page title", async () => {
  const metadata = await generateMetadata({
    params: Promise.resolve({ id: "nope" }),
  });
  expect(metadata.title).toBe("Post not found");
});
