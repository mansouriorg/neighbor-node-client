import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageReply } from "@/lib/manage-limits";
import type { Post } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), remove: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: async () => ({ status: "not-allowed" }),
  removePost: (...args: unknown[]) => mocks.remove(...args),
}));

// The edit form and the block that keeps the post up call their own server actions, stand-ins as well.
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

const post: Post = {
  id: "post-1",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, about one hour.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

const fits: ManageReply = {
  status: "ok",
  post,
  reports: { total: 0, byReason: [] },
};

const block = <p>THE REPLIES BLOCK</p>;

test("shows the block once the link was checked, between the status choices and the reports", async () => {
  mocks.check.mockResolvedValue(fits);
  render(<ManagePostPanel postId="post-1" replies={block} />);
  const replies = await screen.findByText("THE REPLIES BLOCK");
  const link = screen.getByRole("link", { name: "See your post" });
  const reports = screen.getByRole("heading", { level: 3, name: "Reports" });
  const follows = Node.DOCUMENT_POSITION_FOLLOWING;
  expect(link.compareDocumentPosition(replies) & follows).toBe(follows);
  expect(replies.compareDocumentPosition(reports) & follows).toBe(follows);
});

test("the block sits in a part of its own, with a line above it like the other parts", async () => {
  mocks.check.mockResolvedValue(fits);
  render(<ManagePostPanel postId="post-1" replies={block} />);
  const replies = await screen.findByText("THE REPLIES BLOCK");
  const part = replies.parentElement;
  expect(part?.className).toContain("border-t");
  expect(part?.parentElement?.contains(screen.getByRole("heading", { level: 3, name: "Reports" }))).toBe(true);
});

test("without a block nothing is added", async () => {
  mocks.check.mockResolvedValue(fits);
  const { container } = render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Where does your post stand?" });
  expect(container.textContent).not.toContain("THE REPLIES BLOCK");
  const parts = container.querySelectorAll("div.border-t");
  // The edit form, the reports and the take-down.
  expect(parts.length).toBe(3);
});

test("while the link is checked, the block is not there yet", async () => {
  let finish: (value: ManageReply) => void = () => {};
  mocks.check.mockReturnValueOnce(new Promise<ManageReply>((resolve) => { finish = resolve; }));
  render(<ManagePostPanel postId="post-1" replies={block} />);
  expect(screen.getByText("Checking your link...")).toBeDefined();
  expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull();
  finish(fits);
  await screen.findByText("THE REPLIES BLOCK");
});

test("a link that does not fit, a link without a key and a failure show no block", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  const { unmount } = render(<ManagePostPanel postId="post-1" replies={block} />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull();
  unmount();

  mocks.check.mockResolvedValue({ status: "failed" });
  const second = render(<ManagePostPanel postId="post-1" replies={block} />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull();
  second.unmount();

  mocks.check.mockResolvedValue({ status: "limited", minutes: 3 });
  const third = render(<ManagePostPanel postId="post-1" replies={block} />);
  await screen.findByRole("heading", { name: "Please wait a little" });
  expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull();
  third.unmount();

  window.location.hash = "";
  render(<ManagePostPanel postId="post-1" replies={block} />);
  expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeDefined();
  expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull();
});

test("once the post is taken down the block is gone too", async () => {
  mocks.check.mockResolvedValue(fits);
  mocks.remove.mockResolvedValue({ status: "removed" });
  render(<ManagePostPanel postId="post-1" replies={block} />);
  await screen.findByText("THE REPLIES BLOCK");
  fireEvent.click(screen.getByRole("button", { name: "Take this post down" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, take it down" }));
  await screen.findByRole("heading", { name: "Your post was taken down" });
  await waitFor(() => expect(screen.queryByText("THE REPLIES BLOCK")).toBeNull());
});
