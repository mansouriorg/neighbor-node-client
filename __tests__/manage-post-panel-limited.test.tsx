import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { LimitedAnswer, ManageReply } from "@/lib/manage-limits";
import type { Post, PostStatus } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), change: vi.fn(), remove: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: (...args: unknown[]) => mocks.change(...args),
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
const question = "Really take this post down?";

beforeEach(() => {
  mocks.check.mockReset();
  mocks.change.mockReset();
  mocks.remove.mockReset();
  window.location.hash = `#${key}`;
});

function post(status: PostStatus): Post {
  return {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, about one hour.",
    area: "Olive Street",
    status,
    postedLabel: "Today",
  };
}

function ok(status: PostStatus): ManageReply {
  return { status: "ok", post: post(status), reports: { total: 0, byReason: [] } };
}

function limited(minutes: number): LimitedAnswer {
  return { status: "limited", minutes };
}

function button(name: RegExp | string) {
  return screen.getByRole("button", { name });
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

test("a limited check says so, tells the wait, and shows nothing of the post", async () => {
  mocks.check.mockResolvedValue(limited(10));
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Please wait a little" });
  expect(
    screen.getByText(
      "Too many tries just now. Nothing was changed. Please wait about 10 minutes and try again.",
    ),
  ).toBeDefined();
  expect(button("Try again")).toBeDefined();
  expect(screen.queryByRole("button", { name: /^Done/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Take this post down" })).toBeNull();
  expect(screen.queryByText("Help moving a sofa")).toBeNull();
  expect(mocks.change).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("one minute is written in the singular", async () => {
  mocks.check.mockResolvedValue(limited(1));
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Please wait a little" });
  expect(screen.getByText(/Please wait about 1 minute and try again/)).toBeDefined();
  expect(screen.queryByText(/1 minutes/)).toBeNull();
});

test("Try again asks again with the same id and key, and shows the post when the visitor may try again", async () => {
  mocks.check.mockResolvedValueOnce(limited(2)).mockResolvedValueOnce(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Please wait a little" });
  fireEvent.click(button("Try again"));
  await shown();
  expect(mocks.check).toHaveBeenCalledTimes(2);
  expect(mocks.check).toHaveBeenLastCalledWith("post-1", key);
  expect(screen.queryByRole("heading", { name: "Please wait a little" })).toBeNull();
});

test("a failure on our side still has its own words", async () => {
  mocks.check.mockResolvedValue({ status: "failed" });
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  expect(screen.getByText("Nothing was changed. Please try again in a moment.")).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Please wait a little" })).toBeNull();
});

test("a limited status change says so under the buttons, keeps the post as it was, and works again later", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change.mockResolvedValueOnce(limited(5)).mockResolvedValueOnce(ok("done"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Too many tries just now. Nothing was changed. Please wait about 5 minutes and try again.",
  );
  expect(button(/^Done/).getAttribute("aria-pressed")).toBe("false");
  expect(button(/^Open/).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText(/^Saved/)).toBeNull();
  await waitFor(() => expect(button(/^Done/).getAttribute("aria-disabled")).toBeNull());
  fireEvent.click(button(/^Done/));
  await screen.findByText('Saved. Everyone now sees "Done".');
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.change).toHaveBeenCalledTimes(2);
});

test("a limited take-down says so inside the question, keeps the question and the post, and can be tried again", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.remove.mockResolvedValueOnce(limited(3)).mockResolvedValueOnce({ status: "removed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Take this post down"));
  const group = await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Too many tries just now. Nothing was changed. Please wait about 3 minutes and try again.",
  );
  expect(group.contains(alert)).toBe(true);
  expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Your post was taken down" })).toBeNull();
  await waitFor(() => expect(button("Yes, take it down").getAttribute("aria-disabled")).toBeNull());
  fireEvent.click(button("Yes, take it down"));
  await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});

test("a limited answer for an old key does not show for a new key", async () => {
  const other = "b".repeat(64);
  let late: (answer: ManageReply) => void = () => {};
  mocks.check.mockReturnValueOnce(new Promise<ManageReply>((resolve) => { late = resolve; }));
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
  window.location.hash = `#${other}`;
  await shown();
  expect(mocks.check).toHaveBeenLastCalledWith("post-1", other);
  late(limited(9));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("heading", { name: "Please wait a little" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
});
