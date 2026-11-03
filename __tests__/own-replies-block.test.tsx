import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OwnReplies } from "@/components/own-replies";
import { repliesKeptPerPost } from "@/lib/new-reply";
import type { OwnRepliesReply } from "@/lib/own-replies-limits";
import type { OwnReply } from "@/lib/post-store";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { load: vi.fn() };
vi.mock("@/app/board/[id]/manage/replies-actions", () => ({
  loadReplies: (...args: unknown[]) => mocks.load(...args),
}));

const key = "a".repeat(64);
const otherKey = "b".repeat(64);

beforeEach(() => {
  mocks.load.mockReset();
  window.location.hash = `#${key}`;
});

function reply(message: string, more: Partial<OwnReply> = {}): OwnReply {
  return { message, when: "Today", ...more };
}

function ok(replies: OwnReply[]): OwnRepliesReply {
  return { status: "ok", replies };
}

function listItems(): string[] {
  return Array.from(document.querySelectorAll("li")).map((item) => item.textContent ?? "");
}

test("without a key in the address it shows nothing and asks nothing", () => {
  window.location.hash = "";
  const { container } = render(<OwnReplies postId="post-1" />);
  expect(container.textContent).toBe("");
  expect(mocks.load).not.toHaveBeenCalled();
});

test("asks the server with the id of the post and the key from the address, and says it is loading", async () => {
  let finish: (value: OwnRepliesReply) => void = () => {};
  mocks.load.mockReturnValueOnce(new Promise<OwnRepliesReply>((resolve) => { finish = resolve; }));
  render(<OwnReplies postId="post-1" />);
  expect(screen.getByRole("heading", { level: 3, name: "Replies" })).toBeDefined();
  expect(screen.getByText("Loading the replies...")).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
  await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("post-1", key));
  finish(ok([]));
  await screen.findByText("Nobody has replied yet.");
  expect(screen.queryByText("Loading the replies...")).toBeNull();
});

test("a post that nobody replied to says so and shows no list, but the button to look again", async () => {
  mocks.load.mockResolvedValue(ok([]));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("Nobody has replied yet.");
  expect(document.querySelector("ul")).toBeNull();
  expect(screen.getByRole("button", { name: "Check for new replies" })).toBeDefined();
});

test("shows each reply with the words, the name, the time and the contact, in the order the server gave", async () => {
  mocks.load.mockResolvedValue(
    ok([
      reply("The second reply.", { name: "Karim", contact: "0123 456", when: "Yesterday" }),
      reply("The first reply.", { name: "Maria", when: "3 days ago" }),
    ]),
  );
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 2 replies, the newest first.");
  expect(listItems()).toEqual([
    "The second reply.Karim wrote yesterday.Contact: 0123 456",
    "The first reply.Maria wrote 3 days ago.No contact given.",
  ]);
});

test("one reply is written in the singular, and a reply without a name is from a neighbor", async () => {
  mocks.load.mockResolvedValue(ok([reply("I have a ladder.", { when: "Last week" })]));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 1 reply, the newest first.");
  expect(document.body.textContent).not.toContain("1 replies");
  expect(listItems()).toEqual(["I have a ladder.A neighbor wrote last week.No contact given."]);
});

test("a contact is plain text and never a link, whatever it looks like", async () => {
  const contacts = [
    "maria@example.org",
    "https://example.org/me",
    "javascript:alert(1)",
    "<a href=\"https://example.org\">click</a>",
  ];
  mocks.load.mockResolvedValue(ok(contacts.map((contact) => reply("Hello there.", { contact }))));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 4 replies, the newest first.");
  expect(document.querySelectorAll("a").length).toBe(0);
  for (const contact of contacts) {
    expect(document.body.textContent).toContain(contact);
  }
});

test("words that look like markup are shown as words", async () => {
  const message = "<img src=x onerror=alert(1)> and <script>alert(2)</script>";
  mocks.load.mockResolvedValue(ok([reply(message, { name: "<b>Maria</b>" })]));
  const { container } = render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 1 reply, the newest first.");
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(document.body.textContent).toContain(message);
  expect(document.body.textContent).toContain("<b>Maria</b>");
});

test("line breaks and long words in a message do not break the page", async () => {
  mocks.load.mockResolvedValue(ok([reply("First line.\nSecond line.")]));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 1 reply, the newest first.");
  const paragraph = screen.getByText(/First line/);
  expect(paragraph.className).toContain("whitespace-pre-line");
  expect(paragraph.className).toContain("break-words");
});

test("warns the author to be careful, only when there are replies to read", async () => {
  mocks.load.mockResolvedValue(ok([reply("Hello there.")]));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 1 reply, the newest first.");
  expect(document.body.textContent).toContain("Only you can read these replies.");
  expect(document.body.textContent).toContain("be careful with people you do not know");
  expect(document.body.textContent).toContain("Do not send money");
});

test("with no replies there is no warning, only the plain words that nobody has replied", async () => {
  mocks.load.mockResolvedValue(ok([]));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("Nobody has replied yet.");
  expect(document.body.textContent).not.toContain("Only you can read these replies.");
  expect(document.body.textContent).not.toContain("Do not send money");
});

test("tells the author when the post has reached the most replies it keeps", async () => {
  const full = Array.from({ length: repliesKeptPerPost }, (_, index) => reply(`Reply number ${index + 1}.`));
  mocks.load.mockResolvedValue(ok(full));
  const { unmount } = render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 20 replies, the newest first.");
  expect(document.body.textContent).toContain("A post keeps at most 20 replies. Later ones are not saved.");
  unmount();
  mocks.load.mockResolvedValue(ok(full.slice(0, 19)));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 19 replies, the newest first.");
  expect(document.body.textContent).not.toContain("A post keeps at most");
});

test("when the link does not fit it says so and offers no button", async () => {
  mocks.load.mockResolvedValue({ status: "not-allowed" });
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("The replies cannot be shown now. The link may not work any more.");
  expect(screen.queryByRole("button")).toBeNull();
  expect(document.querySelector("ul")).toBeNull();
});

test("a failure on the server, or a request that cannot be sent, shows an alert and a way to try again", async () => {
  mocks.load.mockResolvedValueOnce({ status: "failed" });
  mocks.load.mockRejectedValueOnce(new Error("offline"));
  mocks.load.mockResolvedValueOnce(ok([reply("Hello there.")]));
  render(<OwnReplies postId="post-1" />);
  const first = await screen.findByRole("alert");
  expect(first.textContent).toBe("The replies could not be loaded. Please try again in a moment.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  // While the server is asked the button says "Checking...", so waiting for
  // "Try again" means that the second answer has arrived.
  const again = await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
  fireEvent.click(again);
  await screen.findByText("You have 1 reply, the newest first.");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.load).toHaveBeenCalledTimes(3);
});

test("too many wrong tries say how long to wait, with one minute in the singular", async () => {
  mocks.load.mockResolvedValueOnce({ status: "limited", minutes: 7 });
  mocks.load.mockResolvedValueOnce({ status: "limited", minutes: 1 });
  render(<OwnReplies postId="post-1" />);
  const first = await screen.findByRole("alert");
  expect(first.textContent).toBe("Too many tries just now. Please wait about 7 minutes and try again.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("about 1 minute and"));
});

test("the button asks again, keeps the old replies in view while it checks, and then shows the new ones", async () => {
  let finish: (value: OwnRepliesReply) => void = () => {};
  mocks.load.mockResolvedValueOnce(ok([reply("The old reply.")]));
  mocks.load.mockReturnValueOnce(new Promise<OwnRepliesReply>((resolve) => { finish = resolve; }));
  render(<OwnReplies postId="post-1" />);
  await screen.findByText("You have 1 reply, the newest first.");
  fireEvent.click(screen.getByRole("button", { name: "Check for new replies" }));
  const busy = await screen.findByRole("button", { name: "Checking..." });
  expect(busy.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("The old reply.")).toBeDefined();
  fireEvent.click(busy);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  finish(ok([reply("A new reply."), reply("The old reply.")]));
  await screen.findByText("You have 2 replies, the newest first.");
  expect(listItems().length).toBe(2);
  expect(screen.getByRole("button", { name: "Check for new replies" }).getAttribute("aria-disabled")).toBeNull();
  expect(mocks.load).toHaveBeenCalledTimes(2);
});

test("when the key in the address changes it asks again, and a late answer for the old key is ignored", async () => {
  let late: (value: OwnRepliesReply) => void = () => {};
  mocks.load.mockReturnValueOnce(new Promise<OwnRepliesReply>((resolve) => { late = resolve; }));
  mocks.load.mockResolvedValueOnce(ok([reply("For the other post.")]));
  render(<OwnReplies postId="post-1" />);
  await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("post-1", key));
  window.location.hash = `#${otherKey}`;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("post-1", otherKey));
  await screen.findByText("For the other post.");
  late(ok([reply("From the old key.")]));
  await Promise.resolve();
  expect(screen.queryByText("From the old key.")).toBeNull();
  expect(screen.getByText("For the other post.")).toBeDefined();
});
