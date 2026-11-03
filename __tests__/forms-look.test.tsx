import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReplyPostForm } from "@/components/reply-post-form";
import { ReportPostForm } from "@/components/report-post-form";
import { reportReasonIds } from "@/lib/report-reasons";

// The real actions talk to the server. These tests use stand-ins that they
// control, so no file is written and no network is used.
const mocks = { reply: vi.fn(), report: vi.fn() };
vi.mock("@/app/board/[id]/reply-actions", () => ({
  replyToPost: (...args: unknown[]) => mocks.reply(...args),
}));
vi.mock("@/app/board/[id]/actions", () => ({
  reportPost: (...args: unknown[]) => mocks.report(...args),
}));

beforeEach(() => {
  mocks.reply.mockReset();
  mocks.report.mockReset();
});

function button(name: string) {
  return screen.getByRole("button", { name });
}

function pictureOf(element: Element | null | undefined) {
  return element?.querySelector("svg");
}

test("the reply button has a speech bubble that screen readers skip, and keeps its name and size", () => {
  render(<ReplyPostForm postId="post-1" />);
  const open = button("Reply to this post");
  expect(pictureOf(open)?.getAttribute("aria-hidden")).toBe("true");
  expect(open.className).toContain("h-11");
});

test("the reply form is a card, with the same speech bubble in front of its heading", () => {
  render(<ReplyPostForm postId="post-1" />);
  fireEvent.click(button("Reply to this post"));
  const form = document.querySelector("form");
  expect(form?.className).toContain("shadow-card");
  const heading = screen.getByRole("heading", { level: 2, name: "Reply to this post" });
  expect(pictureOf(heading.parentElement)?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByLabelText("Your message").className).toContain("bg-background");
});

test("a reply without a message shows the message with a warning picture, and marks the field", () => {
  render(<ReplyPostForm postId="post-1" />);
  fireEvent.click(button("Reply to this post"));
  fireEvent.click(button("Send reply"));
  const message = document.getElementById("reply-message-error");
  expect(message?.querySelectorAll("svg").length).toBe(1);
  expect(message?.textContent?.startsWith("Error: ")).toBe(true);
  expect(screen.getByLabelText("Your message").getAttribute("aria-invalid")).toBe("true");
});

test("a reply that was sent is confirmed with a check mark, one that cannot be sent with an info mark", async () => {
  mocks.reply.mockResolvedValue({ status: "sent" });
  const first = render(<ReplyPostForm postId="post-1" />);
  fireEvent.click(button("Reply to this post"));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "I can help on Saturday." } });
  fireEvent.click(button("Send reply"));
  const sent = await screen.findByRole("heading", { name: "Thank you. Your reply was sent." });
  expect(pictureOf(sent.parentElement?.parentElement)?.getAttribute("aria-hidden")).toBe("true");
  const sentPicture = pictureOf(sent.parentElement?.parentElement)?.innerHTML;
  first.unmount();

  mocks.reply.mockResolvedValue({ status: "closed" });
  render(<ReplyPostForm postId="post-1" />);
  fireEvent.click(button("Reply to this post"));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "I can help on Saturday." } });
  fireEvent.click(button("Send reply"));
  const closed = await screen.findByRole("heading", { name: "This post is marked as done." });
  expect(pictureOf(closed.parentElement?.parentElement)?.innerHTML).not.toBe(sentPicture);
  await waitFor(() => expect(document.activeElement).toBe(closed));
});

test("the report button has a flag that screen readers skip, and keeps its name and size", () => {
  render(<ReportPostForm postId="post-1" />);
  const open = button("Report this post");
  expect(pictureOf(open)?.getAttribute("aria-hidden")).toBe("true");
  expect(open.className).toContain("min-h-11");
});

test("the report form is a card, and each reason is a card that shows when it is chosen", () => {
  render(<ReportPostForm postId="post-1" />);
  fireEvent.click(button("Report this post"));
  expect(document.querySelector("form")?.className).toContain("shadow-card");
  const radios = screen.getAllByRole("radio");
  expect(radios.length).toBe(reportReasonIds.length);
  for (const radio of radios) {
    const words = (radio.closest("label")?.className ?? "").split(" ");
    expect(words.includes("has-[:checked]:border-accent")).toBe(true);
    expect(words.includes("min-h-11")).toBe(true);
  }
});

test("a report that was saved is confirmed with a check mark, and focus goes to the thanks", async () => {
  mocks.report.mockResolvedValue({ status: "reported" });
  render(<ReportPostForm postId="post-1" />);
  fireEvent.click(button("Report this post"));
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(button("Send report"));
  const thanks = await screen.findByRole("heading", { name: "Thank you. Your report was saved." });
  expect(pictureOf(thanks.parentElement?.parentElement)?.getAttribute("aria-hidden")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(thanks));
});

test("a report on a post that is gone gets an info mark, and a report that was saved gets a check mark", async () => {
  mocks.report.mockResolvedValue({ status: "reported" });
  const first = render(<ReportPostForm postId="post-1" />);
  fireEvent.click(button("Report this post"));
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(button("Send report"));
  const saved = await screen.findByRole("heading", { name: "Thank you. Your report was saved." });
  const savedPicture = pictureOf(saved.parentElement?.parentElement)?.innerHTML;
  expect((savedPicture ?? "").length > 0).toBe(true);
  first.unmount();

  mocks.report.mockResolvedValue({ status: "not-found" });
  render(<ReportPostForm postId="post-1" />);
  fireEvent.click(button("Report this post"));
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(button("Send report"));
  const gone = await screen.findByRole("heading", { name: "This post is no longer on the board." });
  expect(pictureOf(gone.parentElement?.parentElement)?.innerHTML).not.toBe(savedPicture);
});
