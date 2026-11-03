import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer } from "@/lib/manage-post";
import type { Post, PostStatus } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), change: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: (...args: unknown[]) => mocks.change(...args),
  removePost: async () => ({ status: "not-allowed" }),
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
  mocks.change.mockReset();
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

function ok(status: PostStatus): ManageAnswer {
  return { status: "ok", post: post(status), reports: { total: 0, byReason: [] } };
}

function button(name: RegExp) {
  return screen.getByRole("button", { name });
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

test("without a key in the address it says the link is incomplete and asks nothing", () => {
  window.location.hash = "";
  render(<ManagePostPanel postId="post-1" />);
  expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeDefined();
  expect(mocks.check).not.toHaveBeenCalled();
});

test("with a key it checks the link, then shows where the post stands", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  expect(screen.getByText("Checking your link...")).toBeDefined();
  await shown();
  expect(mocks.check).toHaveBeenCalledTimes(1);
  expect(mocks.check).toHaveBeenCalledWith("post-1", key);
  expect(button(/^Open/).getAttribute("aria-pressed")).toBe("true");
  expect(button(/^In progress/).getAttribute("aria-pressed")).toBe("false");
  expect(button(/^Done/).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("link", { name: "See your post" }).getAttribute("href")).toBe("/board/post-1");
});

test("choosing another status saves it and shows it", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change.mockResolvedValue(ok("done"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  expect(await screen.findByText('Saved. Everyone now sees "Done".')).toBeDefined();
  expect(mocks.change).toHaveBeenCalledWith("post-1", key, "done");
  expect(button(/^Done/).getAttribute("aria-pressed")).toBe("true");
  expect(button(/^Open/).getAttribute("aria-pressed")).toBe("false");
});

test("each choice sends its own status", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change.mockImplementation(async (_id: string, _key: string, status: PostStatus) => ok(status));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const choices = [
    { name: /^In progress/, status: "in-progress" },
    { name: /^Done/, status: "done" },
    { name: /^Open/, status: "open" },
  ];
  for (const choice of choices) {
    fireEvent.click(button(choice.name));
    await waitFor(() => expect(mocks.change).toHaveBeenLastCalledWith("post-1", key, choice.status));
    await waitFor(() => expect(button(choice.name).getAttribute("aria-pressed")).toBe("true"));
  }
  expect(mocks.change).toHaveBeenCalledTimes(3);
});

test("pressing the status that is already chosen sends nothing", async () => {
  mocks.check.mockResolvedValue(ok("in-progress"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^In progress/));
  expect(mocks.change).not.toHaveBeenCalled();
});

test("while a change is on its way the buttons say busy, and a second press does nothing", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  let finish: (answer: ManageAnswer) => void = () => {};
  mocks.change.mockReturnValue(new Promise<ManageAnswer>((resolve) => { finish = resolve; }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  await waitFor(() => expect(button(/^Done/).getAttribute("aria-disabled")).toBe("true"));
  fireEvent.click(button(/^In progress/));
  expect(mocks.change).toHaveBeenCalledTimes(1);
  finish(ok("done"));
  await screen.findByText('Saved. Everyone now sees "Done".');
  expect(button(/^Done/).getAttribute("aria-disabled")).toBeNull();
});

test("a link that does not fit shows no buttons", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  expect(await screen.findByRole("heading", { name: "This link does not match your post" })).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

test("a problem on the server, or a server that cannot be reached, offers another try", async () => {
  mocks.check
    .mockResolvedValueOnce({ status: "failed" })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(2));
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await shown();
  expect(mocks.check).toHaveBeenCalledTimes(3);
});

test("a change that is not saved says so, keeps the old status, and can be tried again", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change
    .mockResolvedValueOnce({ status: "failed" })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(ok("done"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    fireEvent.click(button(/^Done/));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("The change was not saved. Nothing was changed. Please try again.");
    expect(button(/^Open/).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(button(/^Done/).getAttribute("aria-disabled")).toBeNull());
  }
  fireEvent.click(button(/^Done/));
  await screen.findByText('Saved. Everyone now sees "Done".');
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a saved message does not stay next to a later change that fails", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change
    .mockResolvedValueOnce(ok("done"))
    .mockRejectedValueOnce(new Error("offline"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  await screen.findByText('Saved. Everyone now sees "Done".');
  fireEvent.click(button(/^In progress/));
  await screen.findByRole("alert");
  expect(screen.queryByText('Saved. Everyone now sees "Done".')).toBeNull();
  expect(button(/^Done/).getAttribute("aria-pressed")).toBe("true");
});

test("a change that the server refuses shows the notice that the link does not fit", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  expect(await screen.findByRole("heading", { name: "This link does not match your post" })).toBeDefined();
});

test("a new key in the address is checked, and the old answer is not shown meanwhile", async () => {
  const other = "b".repeat(64);
  let answerForOther: (answer: ManageAnswer) => void = () => {};
  mocks.check
    .mockResolvedValueOnce(ok("open"))
    .mockReturnValueOnce(new Promise<ManageAnswer>((resolve) => { answerForOther = resolve; }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  window.location.hash = `#${other}`;
  expect(await screen.findByText("Checking your link...")).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Where does your post stand?" })).toBeNull();
  expect(mocks.check).toHaveBeenLastCalledWith("post-1", other);
  answerForOther({ status: "not-allowed" });
  expect(await screen.findByRole("heading", { name: "This link does not match your post" })).toBeDefined();
});

test("an answer that comes late for an old key is not shown", async () => {
  const other = "b".repeat(64);
  let late: (answer: ManageAnswer) => void = () => {};
  mocks.check
    .mockReturnValueOnce(new Promise<ManageAnswer>((resolve) => { late = resolve; }))
    .mockResolvedValueOnce({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  await waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(1));
  window.location.hash = `#${other}`;
  expect(await screen.findByRole("heading", { name: "This link does not match your post" })).toBeDefined();
  late(ok("open"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("heading", { name: "Where does your post stand?" })).toBeNull();
  expect(screen.getByRole("heading", { name: "This link does not match your post" })).toBeDefined();
});

test("the key is never written into the page", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(document.body.innerHTML.includes(key)).toBe(false);
});
