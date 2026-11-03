import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PostPage from "@/app/board/[id]/page";
import type { Post } from "@/lib/posts";

// notFound() works by throwing. Here it throws a plain error the tests can look for.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// No test may read the real file with the posts of the person who runs the
// tests, and no reply or report may ever be saved by a test. The file and the
// two server actions are replaced by stand-ins that each test controls.
const mocks = { readPosts: vi.fn(), report: vi.fn(), reply: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));
vi.mock("@/app/board/[id]/actions", () => ({
  reportPost: (...args: unknown[]) => mocks.report(...args),
}));
vi.mock("@/app/board/[id]/reply-actions", () => ({
  replyToPost: (...args: unknown[]) => mocks.reply(...args),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.readPosts.mockResolvedValue([]);
  mocks.report.mockReset();
  mocks.reply.mockReset();
});

function saved(status: Post["status"]): Post {
  return {
    id: "post-b",
    kind: "lend",
    title: "A drill for the weekend",
    details: "With a set of bits. Please bring it back clean.",
    area: "Harbor Road area",
    status,
    postedLabel: "Yesterday",
  };
}

// The page is an async Server Component, so it is called like a function and awaited.
async function renderPost(id: string) {
  return render(await PostPage({ params: Promise.resolve({ id }) }));
}

test("a saved post that is open has a button to reply, and one to report", async () => {
  mocks.readPosts.mockResolvedValue([saved("open")]);
  await renderPost("post-b");
  expect(screen.getByRole("button", { name: "Reply to this post" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Report this post" })).toBeDefined();
});

test("a post that is in progress still takes replies", async () => {
  mocks.readPosts.mockResolvedValue([saved("in-progress")]);
  await renderPost("post-b");
  expect(screen.getByRole("button", { name: "Reply to this post" })).toBeDefined();
});

test("a post that is done takes no replies, says so, and can still be reported", async () => {
  mocks.readPosts.mockResolvedValue([saved("done")]);
  await renderPost("post-b");
  expect(screen.queryByRole("button", { name: "Reply to this post" })).toBeNull();
  expect(screen.getByText("This post is done.")).toBeDefined();
  expect(document.body.textContent).toContain("It takes no more replies.");
  expect(screen.getByRole("button", { name: "Report this post" })).toBeDefined();
});

test("a sample post is made up, so it takes no replies and has no report button", async () => {
  await renderPost("sample-1");
  expect(screen.queryByRole("button", { name: "Reply to this post" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Report this post" })).toBeNull();
  expect(screen.getByText("Sample post.")).toBeDefined();
  expect(document.body.textContent).toContain("so it takes no replies");
  expect(mocks.readPosts).not.toHaveBeenCalled();
});

test("the notice says that there are no accounts yet and that a reply goes only to the author", async () => {
  mocks.readPosts.mockResolvedValue([saved("open")]);
  await renderPost("post-b");
  expect(screen.getByText("Early version.")).toBeDefined();
  expect(document.body.textContent).toContain("There are no accounts yet.");
  expect(document.body.textContent).toContain("A reply goes only to the person who wrote the post.");
  expect(document.body.textContent).not.toContain("comes later, together with accounts");
});

test("the reply comes before the report, and both come after the post", async () => {
  mocks.readPosts.mockResolvedValue([saved("open")]);
  await renderPost("post-b");
  const heading = screen.getByRole("heading", { level: 1, name: "A drill for the weekend" });
  const reply = screen.getByRole("button", { name: "Reply to this post" });
  const report = screen.getByRole("button", { name: "Report this post" });
  const follows = Node.DOCUMENT_POSITION_FOLLOWING;
  expect(heading.compareDocumentPosition(reply) & follows).toBe(follows);
  expect(reply.compareDocumentPosition(report) & follows).toBe(follows);
});

test("the reply goes out with the id of this post and the words that were written", async () => {
  mocks.readPosts.mockResolvedValue([saved("open")]);
  mocks.reply.mockResolvedValue({ status: "sent" });
  await renderPost("post-b");
  fireEvent.click(screen.getByRole("button", { name: "Reply to this post" }));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "I could use it on Saturday." } });
  fireEvent.change(screen.getByLabelText("Your first name (optional)"), { target: { value: "Karim" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
  expect(await screen.findByRole("heading", { name: "Thank you. Your reply was sent." })).toBeDefined();
  expect(mocks.reply).toHaveBeenCalledTimes(1);
  expect(mocks.reply).toHaveBeenCalledWith("post-b", { message: "I could use it on Saturday.", name: "Karim" });
  expect(mocks.report).not.toHaveBeenCalled();
});

test("nothing that anyone replied is ever on the post page", async () => {
  mocks.readPosts.mockResolvedValue([saved("open")]);
  await renderPost("post-b");
  expect(document.body.textContent).not.toContain("Check for new replies");
  expect(document.body.textContent).not.toContain("You have");
  expect(document.querySelector("ul")).toBeNull();
});
