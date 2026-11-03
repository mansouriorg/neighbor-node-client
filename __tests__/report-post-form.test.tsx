import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportPostForm } from "@/components/report-post-form";
import type { LimitedAnswer } from "@/lib/manage-limits";
import type { ReportAnswer } from "@/lib/report-post";
import {
  reportReasonIds,
  reportReasonLabels,
  type ReportReason,
} from "@/lib/report-reasons";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { report: vi.fn() };
vi.mock("@/app/board/[id]/actions", () => ({
  reportPost: (...args: unknown[]) => mocks.report(...args),
}));

beforeEach(() => {
  mocks.report.mockReset();
});

const heading = "Why are you reporting this post?";
const thanks = "Thank you. Your report was saved.";

function answer(status: ReportAnswer["status"]): ReportAnswer {
  return { status } as ReportAnswer;
}

function limited(minutes: number): LimitedAnswer {
  return { status: "limited", minutes };
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

function radio(reason: ReportReason) {
  return screen.getByRole("radio", { name: reportReasonLabels[reason] });
}

function isChecked(reason: ReportReason): boolean {
  return (radio(reason) as HTMLInputElement).checked;
}

function openForm() {
  fireEvent.click(button("Report this post"));
}

test("starts closed: only the button is there, and nothing is sent", () => {
  render(<ReportPostForm postId="post-1" />);
  expect(button("Report this post")).toBeDefined();
  expect(screen.queryByText(heading)).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(mocks.report).not.toHaveBeenCalled();
});

test("the button is easy to hit with a thumb", () => {
  render(<ReportPostForm postId="post-1" />);
  expect(button("Report this post").className).toContain("min-h-11");
});

test("opens a question with the five reasons, none chosen, and focus on the first one", async () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  const legend = screen.getByText(heading);
  expect(legend.tagName).toBe("LEGEND");
  expect(legend.closest("fieldset")).not.toBeNull();
  expect(screen.getAllByRole("radio").length).toBe(5);
  for (const id of reportReasonIds) {
    expect(radio(id)).toBeDefined();
    expect(isChecked(id)).toBe(false);
  }
  expect(button("Send report")).toBeDefined();
  expect(button("Cancel")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Report this post" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(radio("spam")));
});

test("says what is saved and who can read it, and ties it to the question", () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  const hint = screen.getByText(/We save the reason and the time, not who you are/);
  expect(hint.textContent).toContain("The person who runs this site can read it.");
  const fieldset = screen.getByText(heading).closest("fieldset");
  expect(fieldset?.getAttribute("aria-describedby")).toBe(hint.id);
});

test("choosing a reason selects only that one", () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("scam"));
  expect(isChecked("scam")).toBe(true);
  fireEvent.click(radio("other"));
  expect(isChecked("scam")).toBe(false);
  expect(isChecked("other")).toBe(true);
});

test("sends the id of the post and the chosen reason, then thanks the person and moves focus there", async () => {
  mocks.report.mockResolvedValue(answer("reported"));
  render(<ReportPostForm postId="post-7" />);
  openForm();
  fireEvent.click(radio("private"));
  fireEvent.click(button("Send report"));
  const done = await screen.findByRole("heading", { name: thanks });
  expect(mocks.report).toHaveBeenCalledTimes(1);
  expect(mocks.report).toHaveBeenCalledWith("post-7", "private");
  expect(screen.getByText(/The post stays on the board until they decide what to do/)).toBeDefined();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(done));
});

test("each reason is sent as its own id", async () => {
  mocks.report.mockResolvedValue(answer("reported"));
  for (const id of reportReasonIds) {
    const { unmount } = render(<ReportPostForm postId="post-1" />);
    openForm();
    fireEvent.click(radio(id));
    fireEvent.click(button("Send report"));
    await screen.findByRole("heading", { name: thanks });
    expect(mocks.report).toHaveBeenLastCalledWith("post-1", id);
    unmount();
  }
  expect(mocks.report).toHaveBeenCalledTimes(5);
});

test("sending without a reason says so, sends nothing and puts focus on the first reason", async () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  button("Send report").focus();
  fireEvent.click(button("Send report"));
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe("Please choose a reason first.");
  expect(mocks.report).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(radio("spam")));
});

test("choosing a reason takes the message away", () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(button("Send report"));
  expect(screen.getByRole("alert")).toBeDefined();
  fireEvent.click(radio("unsafe"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("Cancel closes the question, sends nothing, forgets the choice and gives focus back to the button", async () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("scam"));
  fireEvent.click(button("Cancel"));
  expect(screen.queryByText(heading)).toBeNull();
  expect(mocks.report).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(button("Report this post")));
  openForm();
  for (const id of reportReasonIds) expect(isChecked(id)).toBe(false);
});

test("the Escape key closes the question like Cancel", async () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("scam"));
  fireEvent.keyDown(radio("scam"), { key: "Escape" });
  expect(screen.queryByText(heading)).toBeNull();
  expect(mocks.report).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(button("Report this post")));
});

test("another key does not close the question", () => {
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.keyDown(radio("spam"), { key: "Enter" });
  fireEvent.keyDown(radio("spam"), { key: "a" });
  expect(screen.getByText(heading)).toBeDefined();
});

test("a second press while the first is on its way does nothing", async () => {
  let finish: (value: ReportAnswer) => void = () => {};
  mocks.report.mockReturnValue(
    new Promise<ReportAnswer>((resolve) => {
      finish = resolve;
    }),
  );
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("spam"));
  fireEvent.click(button("Send report"));
  const busy = await screen.findByRole("button", { name: "Sending..." });
  expect(busy.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(busy);
  fireEvent.click(button("Cancel"));
  expect(mocks.report).toHaveBeenCalledTimes(1);
  expect(screen.getByText(heading)).toBeDefined();
  finish(answer("reported"));
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.report).toHaveBeenCalledTimes(1);
});

test("a post with enough reports already says so", async () => {
  mocks.report.mockResolvedValue(answer("enough"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("spam"));
  fireEvent.click(button("Send report"));
  const done = await screen.findByRole("heading", {
    name: "Thank you. This post was reported many times already.",
  });
  expect(screen.getByText("Nothing more was saved. The person who runs this site can read the reports.")).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(done));
});

test("a post that is gone says so", async () => {
  mocks.report.mockResolvedValue(answer("not-found"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("spam"));
  fireEvent.click(button("Send report"));
  await screen.findByRole("heading", { name: "This post is no longer on the board." });
  expect(screen.getByText("So there is nothing to report.")).toBeDefined();
});

test("a limited report tells the wait, keeps the question and the choice, and works again later", async () => {
  mocks.report.mockResolvedValueOnce(limited(12)).mockResolvedValueOnce(answer("reported"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("scam"));
  fireEvent.click(button("Send report"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "Too many reports from you just now. Nothing was saved. Please wait about 12 minutes and try again.",
  );
  expect(screen.getByText(heading)).toBeDefined();
  expect(isChecked("scam")).toBe(true);
  await waitFor(() => expect(button("Send report").getAttribute("aria-disabled")).toBeNull());
  fireEvent.click(button("Send report"));
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.report).toHaveBeenCalledTimes(2);
  expect(mocks.report).toHaveBeenLastCalledWith("post-1", "scam");
});

test("one minute is written in the singular", async () => {
  mocks.report.mockResolvedValue(limited(1));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("spam"));
  fireEvent.click(button("Send report"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Please wait about 1 minute and try again.");
  expect(alert.textContent).not.toContain("1 minutes");
});

test("a failure on our side keeps the question and says that nothing was saved", async () => {
  mocks.report.mockResolvedValue(answer("failed"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("other"));
  fireEvent.click(button("Send report"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("The report was not saved. Please try again in a moment.");
  expect(screen.getByText(heading)).toBeDefined();
  expect(isChecked("other")).toBe(true);
});

test("a reason the server does not know is told like a failure", async () => {
  mocks.report.mockResolvedValue(answer("invalid"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("other"));
  fireEvent.click(button("Send report"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("The report was not saved. Please try again in a moment.");
});

test("a call that breaks is told like a failure, and the button works again", async () => {
  mocks.report.mockRejectedValueOnce(new Error("the network is down"));
  mocks.report.mockResolvedValueOnce(answer("reported"));
  render(<ReportPostForm postId="post-1" />);
  openForm();
  fireEvent.click(radio("other"));
  fireEvent.click(button("Send report"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("The report was not saved. Please try again in a moment.");
  await waitFor(() => expect(button("Send report").getAttribute("aria-disabled")).toBeNull());
  fireEvent.click(button("Send report"));
  await screen.findByRole("heading", { name: thanks });
  expect(mocks.report).toHaveBeenCalledTimes(2);
});
