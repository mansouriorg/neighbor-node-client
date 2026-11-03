import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer, RemoveAnswer } from "@/lib/manage-post";
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

function post(status: PostStatus, title: string = "Help moving a sofa"): Post {
  return {
    id: "post-1",
    kind: "help",
    title,
    details: "Saturday morning, about one hour.",
    area: "Olive Street",
    status,
    postedLabel: "Today",
  };
}

function ok(status: PostStatus, title?: string): ManageAnswer {
  return { status: "ok", post: post(status, title), reports: { total: 0, byReason: [] } };
}

function button(name: RegExp | string) {
  return screen.getByRole("button", { name });
}

function questionGroup() {
  return screen.queryByRole("group", { name: question });
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

// Shows the panel, and opens the question "Really take this post down?".
async function openQuestion() {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Take this post down"));
}

test("the panel offers to take the post down, and asks the server nothing yet", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByRole("heading", { level: 3, name: "Take your post down" })).toBeDefined();
  expect(screen.getByText(/You cannot undo it from the site/)).toBeDefined();
  expect(button("Take this post down")).toBeDefined();
  expect(questionGroup()).toBeNull();
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("the offer is not shown while the link is checked, or when it does not fit", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  expect(screen.queryByRole("button", { name: "Take this post down" })).toBeNull();
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("button", { name: "Take this post down" })).toBeNull();
  expect(screen.getByText(/or the post was taken down already/)).toBeDefined();
});

test("pressing it opens the question, names the post, puts focus on the safe answer, and still asks nothing", async () => {
  await openQuestion();
  const group = await screen.findByRole("group", { name: question });
  expect(group.textContent).toContain("Help moving a sofa");
  expect(group.textContent).toContain("will disappear from the board");
  await waitFor(() => expect(document.activeElement).toBe(button("Keep my post")));
  expect(screen.queryByRole("button", { name: "Take this post down" })).toBeNull();
  expect(button("Yes, take it down")).toBeDefined();
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("the title is shown as text, never as markup", async () => {
  mocks.check.mockResolvedValue(ok("open", "<b>Sofa</b>"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Take this post down"));
  const group = await screen.findByRole("group", { name: question });
  expect(group.textContent).toContain("<b>Sofa</b>");
  expect(group.querySelector("b")).toBeNull();
});

test("the red button is the one that takes the post down", async () => {
  await openQuestion();
  expect(button("Yes, take it down").className).toContain("bg-danger");
  expect(button("Keep my post").className.includes("bg-danger")).toBe(false);
});

test("Keep my post closes the question, sends nothing, and focus goes back to the first button", async () => {
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Keep my post"));
  await waitFor(() => expect(questionGroup()).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button("Take this post down")));
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("the Escape key closes the question the same way", async () => {
  await openQuestion();
  const group = await screen.findByRole("group", { name: question });
  fireEvent.keyDown(group, { key: "Enter" });
  expect(questionGroup()).not.toBeNull();
  fireEvent.keyDown(group, { key: "Escape" });
  await waitFor(() => expect(questionGroup()).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button("Take this post down")));
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("the question can be opened again after it was closed", async () => {
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Keep my post"));
  await waitFor(() => expect(questionGroup()).toBeNull());
  fireEvent.click(button("Take this post down"));
  expect(await screen.findByRole("group", { name: question })).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(button("Keep my post")));
});

test("Yes sends the id and the key and nothing else, and then says the post was taken down", async () => {
  mocks.remove.mockResolvedValue({ status: "removed" });
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  const heading = await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.remove).toHaveBeenCalledWith("post-1", key);
  await waitFor(() => expect(document.activeElement).toBe(heading));
  expect(screen.getByRole("link", { name: "Back to the board" }).getAttribute("href")).toBe("/board");
  expect(screen.getByText(/your private link does not work any more/)).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Where does your post stand?" })).toBeNull();
  expect(document.body.innerHTML.includes(key)).toBe(false);
});

test("the text around the panel is shown until the post is taken down, and then it is gone", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.remove.mockResolvedValue({ status: "removed" });
  render(
    <ManagePostPanel
      postId="post-1"
      intro={<p>Words before</p>}
      note={<p>Words after</p>}
    />,
  );
  expect(screen.getByText("Words before")).toBeDefined();
  expect(screen.getByText("Words after")).toBeDefined();
  await shown();
  expect(screen.getByText("Words before")).toBeDefined();
  expect(screen.getByText("Words after")).toBeDefined();
  fireEvent.click(button("Take this post down"));
  fireEvent.click(await screen.findByRole("button", { name: "Yes, take it down" }));
  await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
  expect(screen.queryByText("Words before")).toBeNull();
  expect(screen.queryByText("Words after")).toBeNull();
});

test("while the take-down is on its way the buttons say busy, and nothing else can be pressed", async () => {
  let finish: (answer: RemoveAnswer) => void = () => {};
  mocks.remove.mockReturnValue(new Promise<RemoveAnswer>((resolve) => { finish = resolve; }));
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  const working = await screen.findByRole("button", { name: "Taking it down..." });
  expect(working.getAttribute("aria-disabled")).toBe("true");
  expect(button("Keep my post").getAttribute("aria-disabled")).toBe("true");
  expect(button(/^Done/).getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(working);
  fireEvent.click(button("Keep my post"));
  fireEvent.click(button(/^Done/));
  fireEvent.keyDown(screen.getByRole("group", { name: question }), { key: "Escape" });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(mocks.change).not.toHaveBeenCalled();
  expect(questionGroup()).not.toBeNull();
  finish({ status: "removed" });
  await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
});

test("while a status change is on its way, the first button does nothing, and it works again afterwards", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  let finish: (answer: ManageAnswer) => void = () => {};
  mocks.change.mockReturnValue(new Promise<ManageAnswer>((resolve) => { finish = resolve; }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button(/^Done/));
  await waitFor(() => expect(button("Take this post down").getAttribute("aria-disabled")).toBe("true"));
  fireEvent.click(button("Take this post down"));
  expect(questionGroup()).toBeNull();
  finish(ok("done"));
  await screen.findByText('Saved. Everyone now sees "Done".');
  expect(button("Take this post down").getAttribute("aria-disabled")).toBeNull();
  fireEvent.click(button("Take this post down"));
  expect(await screen.findByRole("group", { name: question })).toBeDefined();
});

test("a take-down that fails says so inside the question, keeps the post, and can be tried again", async () => {
  mocks.remove
    .mockResolvedValueOnce({ status: "failed" })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ status: "removed" });
  await openQuestion();
  await screen.findByRole("group", { name: question });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    fireEvent.click(button("Yes, take it down"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("The post was not taken down. Nothing was changed. Please try again.");
    expect(questionGroup()).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
    await waitFor(() => expect(button("Yes, take it down").getAttribute("aria-disabled")).toBeNull());
  }
  fireEvent.click(button("Yes, take it down"));
  await screen.findByRole("heading", { level: 1, name: "Your post was taken down" });
  expect(mocks.remove).toHaveBeenCalledTimes(3);
});

test("the message of a failed take-down goes away when the question is closed and opened again", async () => {
  mocks.remove.mockResolvedValue({ status: "failed" });
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  await screen.findByRole("alert");
  await waitFor(() => expect(button("Keep my post").getAttribute("aria-disabled")).toBeNull());
  fireEvent.click(button("Keep my post"));
  await waitFor(() => expect(questionGroup()).toBeNull());
  fireEvent.click(button("Take this post down"));
  await screen.findByRole("group", { name: question });
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a post that the server no longer knows shows the notice that the link does not fit", async () => {
  mocks.remove.mockResolvedValue({ status: "not-allowed" });
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  expect(await screen.findByRole("heading", { name: "This link does not match your post" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Your post was taken down" })).toBeNull();
});

test("a new key in the address closes the question", async () => {
  const other = "b".repeat(64);
  await openQuestion();
  await screen.findByRole("group", { name: question });
  window.location.hash = `#${other}`;
  await screen.findByText("Checking your link...");
  await shown();
  expect(mocks.check).toHaveBeenLastCalledWith("post-1", other);
  expect(questionGroup()).toBeNull();
  expect(button("Take this post down")).toBeDefined();
});

test("an answer that comes late for an old key does not hide the post of a new key", async () => {
  const other = "b".repeat(64);
  let late: (answer: RemoveAnswer) => void = () => {};
  mocks.remove.mockReturnValue(new Promise<RemoveAnswer>((resolve) => { late = resolve; }));
  await openQuestion();
  await screen.findByRole("group", { name: question });
  fireEvent.click(button("Yes, take it down"));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
  window.location.hash = `#${other}`;
  await screen.findByText("Checking your link...");
  await shown();
  late({ status: "removed" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByRole("heading", { name: "Your post was taken down" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
  await waitFor(() => expect(button("Take this post down").getAttribute("aria-disabled")).toBeNull());
});
