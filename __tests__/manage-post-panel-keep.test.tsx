import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer } from "@/lib/manage-post";
import type { Post, PostKeep, PostStatus } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), change: vi.fn(), renew: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: (...args: unknown[]) => mocks.change(...args),
  removePost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/renew-actions", () => ({
  renewPost: (...args: unknown[]) => mocks.renew(...args),
}));
vi.mock("@/app/board/[id]/manage/edit-actions", () => ({
  editPost: async () => ({ status: "not-allowed" }),
}));

const key = "a".repeat(64);

beforeEach(() => {
  mocks.check.mockReset();
  mocks.change.mockReset();
  mocks.renew.mockReset();
  window.location.hash = `#${key}`;
});

function post(status: PostStatus, keep: PostKeep | undefined): Post {
  const base: Post = {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status,
    postedLabel: "Today",
  };
  return keep === undefined ? base : { ...base, keep };
}

function ok(status: PostStatus, keep: PostKeep | undefined): ManageAnswer {
  return { status: "ok", post: post(status, keep), reports: { total: 0, byReason: [] } };
}

const normalHint = "Change it when things move on. The board shows the new status at once.";
const hiddenHint =
  "Change it when things move on. Your post is hidden now, but a post that you mark as done is on the board again, as done.";

function button(name: string | RegExp) {
  return screen.getByRole("button", { name });
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

test("the block comes after the link to the post and before the edit block, and says how long the post stays", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 12 }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const link = screen.getByRole("link", { name: "See your post" });
  const keep = screen.getByRole("heading", { level: 3, name: "Keep your post up" });
  const edit = screen.getByRole("heading", { level: 3, name: "Edit your post" });
  const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & 4) === 4;
  expect(follows(link, keep)).toBe(true);
  expect(follows(keep, edit)).toBe(true);
  expect(screen.getByText("Your post stays on the board for 12 more days.")).toBeDefined();
  expect(button("Keep my post up")).toBeDefined();
  expect(screen.getByText(normalHint)).toBeDefined();
});

test("an answer with no keep shows no block, as before", async () => {
  mocks.check.mockResolvedValue(ok("open", undefined));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.queryByRole("heading", { name: "Keep your post up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Keep my post up" })).toBeNull();
  expect(screen.getByRole("link", { name: "See your post" })).toBeDefined();
  expect(screen.getByText(normalHint)).toBeDefined();
});

test("there is no block without a key, for a link that does not fit, or when the server fails", async () => {
  window.location.hash = "";
  const first = render(<ManagePostPanel postId="post-1" />);
  expect(screen.queryByRole("heading", { name: "Keep your post up" })).toBeNull();
  first.unmount();
  window.location.hash = `#${key}`;
  mocks.check.mockResolvedValueOnce({ status: "not-allowed" });
  const second = render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("heading", { name: "Keep your post up" })).toBeNull();
  second.unmount();
  mocks.check.mockResolvedValueOnce({ status: "failed" });
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  expect(screen.queryByRole("heading", { name: "Keep your post up" })).toBeNull();
  expect(mocks.renew).not.toHaveBeenCalled();
});

test("pressing the button sends the id and the key from the address, and nothing else", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  mocks.renew.mockResolvedValue(ok("open", { state: "shown", daysLeft: 30 }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Keep my post up"));
  await screen.findByText("Done. Your post stays on the board for 30 more days.");
  expect(mocks.renew).toHaveBeenCalledTimes(1);
  expect(mocks.renew).toHaveBeenCalledWith("post-1", key);
});

test("after the press, the days come from the answer of the server", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  mocks.renew.mockResolvedValue(ok("open", { state: "shown", daysLeft: 30 }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByText("Your post stays on the board for 3 more days.")).toBeDefined();
  fireEvent.click(button("Keep my post up"));
  await screen.findByText("Your post stays on the board for 30 more days.");
  expect(screen.queryByText("Your post stays on the board for 3 more days.")).toBeNull();
});

test("a hidden post has no link to the post page, a hint that says why, and a button to show it again", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "hidden" }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.queryByRole("link", { name: "See your post" })).toBeNull();
  expect(screen.getByText(hiddenHint)).toBeDefined();
  expect(screen.queryByText(normalHint)).toBeNull();
  expect(screen.getByText("Your post is hidden from the board.")).toBeDefined();
  expect(button("Show my post again")).toBeDefined();
});

test("showing a hidden post again brings the link and the usual hint back", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "hidden" }));
  mocks.renew.mockResolvedValue(ok("open", { state: "shown", daysLeft: 30 }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Show my post again"));
  await screen.findByText("Done. Your post is on the board again for 30 more days.");
  expect(screen.getByRole("link", { name: "See your post" }).getAttribute("href")).toBe("/board/post-1");
  expect(screen.getByText(normalHint)).toBeDefined();
  expect(screen.queryByText(hiddenHint)).toBeNull();
  expect(button("Keep my post up")).toBeDefined();
});

test("changing the status of a hidden post says that the post is still hidden, and how to bring it back", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "hidden" }));
  mocks.change.mockResolvedValue(ok("in-progress", { state: "hidden" }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^In progress/));
  const message = 'Saved. Your post is now "In progress". It is hidden from the board. To bring it back, use "Show my post again" below.';
  expect(await screen.findByText(message)).toBeDefined();
  expect(screen.queryByRole("link", { name: "See your post" })).toBeNull();
  expect(button("Show my post again")).toBeDefined();
});

test("marking a hidden post as done puts it back on the board: the usual message and the link appear", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "hidden" }));
  mocks.change.mockResolvedValue(ok("done", { state: "done" }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  expect(await screen.findByText('Saved. Everyone now sees "Done".')).toBeDefined();
  expect(screen.getByRole("link", { name: "See your post" })).toBeDefined();
  expect(screen.getByText("Your post is marked as done.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Keep my post up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Show my post again" })).toBeNull();
});

test("opening an old post that was done again hides it, and the panel says so", async () => {
  mocks.check.mockResolvedValue(ok("done", { state: "done" }));
  mocks.change.mockResolvedValue(ok("open", { state: "hidden" }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByRole("link", { name: "See your post" })).toBeDefined();
  fireEvent.click(button(/^Open/));
  await screen.findByText(/It is hidden from the board/);
  expect(screen.queryByRole("link", { name: "See your post" })).toBeNull();
  expect(button("Show my post again")).toBeDefined();
});

test("a post that is done shows the block without a button", async () => {
  mocks.check.mockResolvedValue(ok("done", { state: "done" }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByText("Your post is marked as done.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Keep my post up" })).toBeNull();
  expect(mocks.renew).not.toHaveBeenCalled();
});

test("an answer that the link does not match replaces the whole panel", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  mocks.renew.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Keep my post up"));
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("heading", { name: "Keep your post up" })).toBeNull();
});

test("too many tries: the panel stays, and the block says how long to wait", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  mocks.renew.mockResolvedValue({ status: "limited", minutes: 4 });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Please wait about 4 minutes");
  expect(screen.getByText("Your post stays on the board for 3 more days.")).toBeDefined();
});

test("a failed answer changes nothing in the panel and says nothing was changed", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  mocks.renew.mockResolvedValue({ status: "failed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Nothing was changed");
  expect(screen.getByText("Your post stays on the board for 3 more days.")).toBeDefined();
});

test("while a status change is on its way, the block does not send, and says so", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  let finish: (value: ManageAnswer) => void = () => undefined;
  mocks.change.mockReturnValue(
    new Promise<ManageAnswer>((resolve) => {
      finish = resolve;
    }),
  );
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  await waitFor(() => expect(button("Keep my post up").getAttribute("aria-disabled")).toBe("true"));
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Another change is still on its way.");
  expect(mocks.renew).not.toHaveBeenCalled();
  finish(ok("done", { state: "done" }));
  await screen.findByText('Saved. Everyone now sees "Done".');
});

test("while the block is sending, a status button does not send, and the block is not asked twice", async () => {
  mocks.check.mockResolvedValue(ok("open", { state: "shown", daysLeft: 3 }));
  let finish: (value: ManageAnswer) => void = () => undefined;
  mocks.renew.mockReturnValue(
    new Promise<ManageAnswer>((resolve) => {
      finish = resolve;
    }),
  );
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Keep my post up"));
  await waitFor(() => expect(button(/^Done/).getAttribute("aria-disabled")).toBe("true"));
  fireEvent.click(button(/^Done/));
  expect(mocks.change).not.toHaveBeenCalled();
  expect(mocks.renew).toHaveBeenCalledTimes(1);
  finish(ok("open", { state: "shown", daysLeft: 30 }));
  await screen.findByText("Done. Your post stays on the board for 30 more days.");
  expect(button(/^Done/).getAttribute("aria-disabled")).toBeNull();
});
