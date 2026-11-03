import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReplyPostForm } from "@/components/reply-post-form";
import type { ReplyReply } from "@/lib/reply-limits";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { reply: vi.fn() };
vi.mock("@/app/board/[id]/reply-actions", () => ({
  replyToPost: (...args: unknown[]) => mocks.reply(...args),
}));

beforeEach(() => {
  mocks.reply.mockReset();
});

const messageLabel = "Your message";
const nameLabel = "Your first name (optional)";
const contactLabel = "How to reach you (optional)";
const thanks = "Thank you. Your reply was sent.";

function answer(value: ReplyReply) {
  mocks.reply.mockResolvedValue(value);
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

function openForm() {
  fireEvent.click(button("Reply to this post"));
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function field(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function send() {
  fireEvent.click(button("Send reply"));
}

test("starts closed: only the button is there, and nothing is sent", () => {
  render(<ReplyPostForm postId="post-1" />);
  expect(button("Reply to this post")).toBeDefined();
  expect(screen.queryByLabelText(messageLabel)).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.reply).not.toHaveBeenCalled();
});

test("the button is easy to hit with a thumb", () => {
  render(<ReplyPostForm postId="post-1" />);
  expect(button("Reply to this post").className).toContain("h-11");
});

test("opens a short form with three empty fields and focus on the message", async () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  expect(screen.getByRole("heading", { level: 2, name: "Reply to this post" })).toBeDefined();
  expect(screen.getAllByRole("textbox").length).toBe(3);
  expect(field(messageLabel).tagName).toBe("TEXTAREA");
  expect(field(messageLabel).value).toBe("");
  expect(field(nameLabel).value).toBe("");
  expect(field(contactLabel).value).toBe("");
  expect(button("Send reply")).toBeDefined();
  expect(button("Cancel")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Reply to this post" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(field(messageLabel)));
});

test("says what is saved and who can read it", () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Only the person who wrote the post can read your reply.");
  expect(text).toContain("We save your message, the name and the contact you choose to write, and the time.");
  expect(text).toContain("The person who runs this site can read the saved file too.");
});

test("the name and the contact are marked as optional and the message as required", () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  expect(field(messageLabel).getAttribute("aria-required")).toBe("true");
  expect(field(nameLabel).getAttribute("aria-required")).toBeNull();
  expect(field(contactLabel).getAttribute("aria-required")).toBeNull();
  expect(document.body.textContent).toContain("Up to 300 characters.");
  expect(document.body.textContent).toContain("Up to 40 characters.");
  expect(document.body.textContent).toContain("Up to 100 characters.");
});

test("sends the id of the post and the clean fields, then thanks the person and moves focus there", async () => {
  answer({ status: "sent" });
  render(<ReplyPostForm postId="post-7" />);
  openForm();
  fill(messageLabel, "  I can help on Saturday.  ");
  fill(nameLabel, " Maria ");
  fill(contactLabel, "maria@example.org");
  send();
  const done = await screen.findByRole("heading", { name: thanks });
  expect(mocks.reply).toHaveBeenCalledTimes(1);
  expect(mocks.reply).toHaveBeenCalledWith("post-7", {
    message: "I can help on Saturday.",
    name: "Maria",
    contact: "maria@example.org",
  });
  expect(screen.getByText(/Only the person who wrote the post can read it/)).toBeDefined();
  expect(screen.getByText(/Nobody is told that a reply arrived/)).toBeDefined();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Send reply" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(done));
});

test("a message alone is sent without a name and without a contact", async () => {
  answer({ status: "sent" });
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I have a ladder.");
  send();
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.reply).toHaveBeenCalledWith("post-1", { message: "I have a ladder." });
});

test("an empty message is refused here, says so next to the field, puts focus there and sends nothing", async () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  button("Send reply").focus();
  send();
  const message = field(messageLabel);
  expect(screen.getByText("Write a short message.")).toBeDefined();
  expect(message.getAttribute("aria-invalid")).toBe("true");
  expect(message.getAttribute("aria-describedby")).toBe("reply-message-hint reply-message-error");
  expect(document.getElementById("reply-message-error")?.textContent).toContain("Write a short message.");
  expect(mocks.reply).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(message));
});

test("every problem is shown at once, and focus goes to the first field in page order", async () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "Fine words here.");
  fill(nameLabel, "n".repeat(41));
  fill(contactLabel, "c".repeat(101));
  send();
  expect(screen.getByText("This is too long. Use at most 40 characters.")).toBeDefined();
  expect(screen.getByText("This is too long. Use at most 100 characters.")).toBeDefined();
  expect(field(messageLabel).getAttribute("aria-invalid")).toBeNull();
  expect(mocks.reply).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(field(nameLabel)));
});

test("writing in a field takes its message away, and only its message", () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(nameLabel, "n".repeat(41));
  fill(contactLabel, "c".repeat(101));
  send();
  fill(nameLabel, "Maria");
  expect(screen.queryByText("This is too long. Use at most 40 characters.")).toBeNull();
  expect(field(nameLabel).getAttribute("aria-invalid")).toBeNull();
  expect(screen.getByText("This is too long. Use at most 100 characters.")).toBeDefined();
});

test("the other endings replace the form with a few plain words", async () => {
  const endings: Array<[ReplyReply, string]> = [
    [{ status: "enough" }, "This post has many replies already."],
    [{ status: "closed" }, "This post is marked as done."],
    [{ status: "not-found" }, "This post is no longer on the board."],
  ];
  for (const [value, title] of endings) {
    mocks.reply.mockReset();
    answer(value);
    const { unmount } = render(<ReplyPostForm postId="post-1" />);
    openForm();
    fill(messageLabel, "I can help on Saturday.");
    send();
    const heading = await screen.findByRole("heading", { name: title });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount();
  }
});

test("when the server finds a problem the browser did not, it shows it at the field and keeps what was typed", async () => {
  answer({ status: "invalid", errors: { contact: "This is too long. Use at most 100 characters." } });
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  fill(contactLabel, "0123");
  send();
  expect(await screen.findByText("This is too long. Use at most 100 characters.")).toBeDefined();
  expect(field(contactLabel).getAttribute("aria-invalid")).toBe("true");
  expect(field(messageLabel).value).toBe("I can help on Saturday.");
  await waitFor(() => expect(document.activeElement).toBe(field(contactLabel)));
});

test("a visitor who sent too many replies is told how long to wait, and keeps what was typed", async () => {
  answer({ status: "limited", minutes: 12 });
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  send();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Too many replies from you just now.");
  expect(alert.textContent).toContain("Please wait about 12 minutes and try again.");
  expect(field(messageLabel).value).toBe("I can help on Saturday.");
  expect(button("Send reply")).toBeDefined();
});

test("one minute is written in the singular", async () => {
  answer({ status: "limited", minutes: 1 });
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  send();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("about 1 minute and");
  expect(alert.textContent).not.toContain("1 minutes");
});

test("a failure on the server, or a request that cannot be sent, keeps the form and what was typed, and a second try can work", async () => {
  mocks.reply.mockResolvedValueOnce({ status: "failed" });
  mocks.reply.mockRejectedValueOnce(new Error("offline"));
  mocks.reply.mockResolvedValueOnce({ status: "sent" });
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  send();
  const first = await screen.findByRole("alert");
  expect(first.textContent).toContain("Your reply was not sent. What you wrote is still here.");
  expect(field(messageLabel).value).toBe("I can help on Saturday.");
  send();
  await waitFor(() => expect(mocks.reply).toHaveBeenCalledTimes(2));
  // While the request is on its way the button says "Sending...", so waiting for
  // "Send reply" means that the second try is over.
  await screen.findByRole("button", { name: "Send reply" });
  expect(screen.getByRole("alert").textContent).toContain("was not sent");
  expect(field(messageLabel).value).toBe("I can help on Saturday.");
  send();
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.reply).toHaveBeenCalledTimes(3);
});

test("a second press while the first is on its way does nothing, and the button says it is busy", async () => {
  let finish: (value: ReplyReply) => void = () => {};
  mocks.reply.mockReturnValueOnce(new Promise<ReplyReply>((resolve) => { finish = resolve; }));
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  send();
  fireEvent.click(button("Sending..."));
  fireEvent.click(button("Sending..."));
  expect(mocks.reply).toHaveBeenCalledTimes(1);
  expect(button("Sending...").getAttribute("aria-disabled")).toBe("true");
  expect(button("Cancel").getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(button("Cancel"));
  expect(field(messageLabel).value).toBe("I can help on Saturday.");
  finish({ status: "sent" });
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.reply).toHaveBeenCalledTimes(1);
});

test("Cancel closes the form, throws away what was typed and puts focus back on the button", async () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "I can help on Saturday.");
  fill(nameLabel, "Maria");
  fireEvent.click(button("Cancel"));
  expect(screen.queryByRole("textbox")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(button("Reply to this post")));
  expect(mocks.reply).not.toHaveBeenCalled();
  openForm();
  expect(field(messageLabel).value).toBe("");
  expect(field(nameLabel).value).toBe("");
});

test("the Escape key does not throw away a message that someone is writing", () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  fill(messageLabel, "A long message that took a while to write.");
  fireEvent.keyDown(field(messageLabel), { key: "Escape" });
  expect(field(messageLabel).value).toBe("A long message that took a while to write.");
  expect(button("Send reply")).toBeDefined();
});

test("a form that was cancelled after an error shows no old messages when it opens again", () => {
  render(<ReplyPostForm postId="post-1" />);
  openForm();
  send();
  expect(screen.getByText("Write a short message.")).toBeDefined();
  fireEvent.click(button("Cancel"));
  openForm();
  expect(screen.queryByText("Write a short message.")).toBeNull();
  expect(field(messageLabel).getAttribute("aria-invalid")).toBeNull();
});
