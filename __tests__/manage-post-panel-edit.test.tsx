import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer } from "@/lib/manage-post";
import type { Post, PostStatus } from "@/lib/posts";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { check: vi.fn(), change: vi.fn(), edit: vi.fn(), remove: vi.fn() };
vi.mock("@/app/board/[id]/manage/actions", () => ({
  checkManageLink: (...args: unknown[]) => mocks.check(...args),
  changePostStatus: (...args: unknown[]) => mocks.change(...args),
  removePost: (...args: unknown[]) => mocks.remove(...args),
}));
// The block that keeps the post up calls its own server action, a stand-in as well.
vi.mock("@/app/board/[id]/manage/renew-actions", () => ({
  renewPost: async () => ({ status: "not-allowed" }),
}));
vi.mock("@/app/board/[id]/manage/edit-actions", () => ({
  editPost: (...args: unknown[]) => mocks.edit(...args),
}));

const key = "a".repeat(64);

beforeEach(() => {
  mocks.check.mockReset();
  mocks.change.mockReset();
  mocks.edit.mockReset();
  mocks.remove.mockReset();
  window.location.hash = `#${key}`;
});

function post(status: PostStatus, more: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status,
    postedLabel: "Today",
    ...more,
  };
}

function ok(status: PostStatus, more: Partial<Post> = {}): ManageAnswer {
  return { status: "ok", post: post(status, more), reports: { total: 0, byReason: [] } };
}

const edited = {
  title: "Help moving a sofa and a table",
  details: "Saturday afternoon now, three people.",
  area: "Fig Lane",
};

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

// Opens the form and writes the new texts of the example.
function writeEdit() {
  fireEvent.click(button("Edit my post"));
  fill("Title", edited.title);
  fill("Details", edited.details);
  fill("Street or area", edited.area);
}

test("the edit block is part of the panel once the link fits: after the link to the post, before the reports", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const status = screen.getByRole("heading", { name: "Where does your post stand?" });
  const link = screen.getByRole("link", { name: "See your post" });
  const edit = screen.getByRole("heading", { level: 3, name: "Edit your post" });
  const reports = screen.getByRole("heading", { name: "Reports" });
  const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & 4) === 4;
  expect(follows(status, link)).toBe(true);
  expect(follows(link, edit)).toBe(true);
  expect(follows(edit, reports)).toBe(true);
  expect(button("Edit my post")).toBeDefined();
});

test("there is no edit block without a key, for a link that does not fit, or when the server fails", async () => {
  window.location.hash = "";
  const first = render(<ManagePostPanel postId="post-1" />);
  expect(screen.queryByRole("heading", { name: "Edit your post" })).toBeNull();
  first.unmount();
  window.location.hash = `#${key}`;
  mocks.check.mockResolvedValueOnce({ status: "not-allowed" });
  const second = render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("heading", { name: "Edit your post" })).toBeNull();
  second.unmount();
  mocks.check.mockResolvedValueOnce({ status: "failed" });
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  expect(screen.queryByRole("heading", { name: "Edit your post" })).toBeNull();
  expect(mocks.edit).not.toHaveBeenCalled();
});

test("the form starts with the texts of the post as the server says them", async () => {
  mocks.check.mockResolvedValue(ok("open", edited));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(button("Edit my post"));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(edited.title);
  expect((screen.getByLabelText("Details") as HTMLTextAreaElement).value).toBe(edited.details);
  expect((screen.getByLabelText("Street or area") as HTMLInputElement).value).toBe(edited.area);
});

test("saving sends the id, the key from the address and the three texts, and nothing else", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValue(ok("open", edited));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(mocks.edit).toHaveBeenCalledTimes(1);
  expect(mocks.edit).toHaveBeenCalledWith("post-1", key, edited);
  expect(mocks.change).not.toHaveBeenCalled();
});

test("after a saved edit the panel shows the new texts: the title of the page and the question about taking the post down", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValue(ok("open", edited));
  render(<ManagePostPanel postId="post-1" postTitle="Help moving a sofa" />);
  await shown();
  expect(screen.getByText("Help moving a sofa")).toBeDefined();
  writeEdit();
  fireEvent.click(button("Save changes"));
  await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(screen.getByText(edited.title)).toBeDefined();
  expect(screen.queryByText("Help moving a sofa")).toBeNull();
  fireEvent.click(button("Take this post down"));
  const question = screen.getByText("Really take this post down?").parentElement;
  expect(question?.textContent).toContain(edited.title);
  fireEvent.click(button("Edit my post"));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(edited.title);
});

test("the status buttons still work after an edit, and keep the edit", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValue(ok("open", edited));
  mocks.change.mockResolvedValue(ok("done", edited));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(screen.getByRole("button", { name: /^Done/ }).getAttribute("aria-disabled")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
  await screen.findByText('Saved. Everyone now sees "Done".');
  expect(mocks.change).toHaveBeenCalledWith("post-1", key, "done");
  fireEvent.click(button("Edit my post"));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(edited.title);
});

test("the words about a status change go away when an edit starts", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.change.mockResolvedValue(ok("in-progress"));
  mocks.edit.mockResolvedValue(ok("in-progress", edited));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  fireEvent.click(screen.getByRole("button", { name: /^In progress/ }));
  await screen.findByText('Saved. Everyone now sees "In progress".');
  writeEdit();
  fireEvent.click(button("Save changes"));
  await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(screen.queryByText('Saved. Everyone now sees "In progress".')).toBeNull();
});

test("while an edit is on its way a status button does nothing", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  let finish: (value: ManageAnswer) => void = () => {};
  mocks.edit.mockReturnValueOnce(new Promise<ManageAnswer>((resolve) => { finish = resolve; }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
  fireEvent.click(button("Take this post down"));
  expect(mocks.change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /^Done/ }).getAttribute("aria-disabled")).toBe("true");
  finish(ok("open", edited));
  await screen.findByText(/Saved\. Everyone now sees the new text/);
  expect(mocks.change).not.toHaveBeenCalled();
});

test("while a status change is on its way, Save says that another change is on its way and sends nothing", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  let finish: (value: ManageAnswer) => void = () => {};
  mocks.change.mockReturnValueOnce(new Promise<ManageAnswer>((resolve) => { finish = resolve; }));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
  expect(button("Save changes").getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(button("Save changes"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Another change is still on its way.");
  expect(mocks.edit).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Street or area") as HTMLInputElement).value).toBe(edited.area);
  finish(ok("done"));
  await screen.findByText('Saved. Everyone now sees "Done".');
});

test("if the link does not fit when saving, the whole panel says so", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValue({ status: "not-allowed" });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("heading", { name: "Edit your post" })).toBeNull();
});

test("a visitor who tried too often is told so in the form, and the panel stays", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValue({ status: "limited", minutes: 7 });
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Please wait about 7 minutes and try again.");
  expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(edited.title);
});

test("a failure keeps the panel and the form, and a request that cannot be sent too", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.edit.mockResolvedValueOnce({ status: "failed" });
  mocks.edit.mockRejectedValueOnce(new Error("offline"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  writeEdit();
  fireEvent.click(button("Save changes"));
  expect((await screen.findByRole("alert")).textContent).toContain("The change was not saved.");
  fireEvent.click(button("Save changes"));
  await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(2));
  await screen.findByRole("button", { name: "Save changes" });
  expect(screen.getByRole("alert").textContent).toContain("The change was not saved.");
  expect(screen.getByRole("heading", { name: "Where does your post stand?" })).toBeDefined();
});

test("the line about the page names the post: the title from the page at first, then the title the server sends", async () => {
  mocks.check.mockResolvedValue(ok("open", { title: "The newest title here" }));
  render(<ManagePostPanel postId="post-1" postTitle="The title from the page" />);
  const line = screen.getByText(/This page is for your post/);
  expect(line.textContent).toBe("This page is for your post The title from the page.");
  await shown();
  expect(screen.getByText(/This page is for your post/).textContent).toBe("This page is for your post The newest title here.");
});

test("the line about the page is there also when the link does not fit, and it is left out when the page gives no title", async () => {
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  const first = render(<ManagePostPanel postId="post-1" postTitle="The title from the page" />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.getByText(/This page is for your post/).textContent).toBe("This page is for your post The title from the page.");
  first.unmount();
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByText(/This page is for your post/)).toBeNull();
});

test("the line about the page goes away with the rest when the post is taken down", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  mocks.remove.mockResolvedValue({ status: "removed" });
  render(<ManagePostPanel postId="post-1" postTitle="Help moving a sofa" intro={<h1>Manage your post</h1>} />);
  await shown();
  fireEvent.click(button("Take this post down"));
  fireEvent.click(button("Yes, take it down"));
  await screen.findByRole("heading", { name: "Your post was taken down" });
  expect(screen.queryByText(/This page is for your post/)).toBeNull();
  expect(screen.queryByRole("heading", { name: "Edit your post" })).toBeNull();
});
