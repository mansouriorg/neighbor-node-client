import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagePostPanel } from "@/components/manage-post-panel";
import type { ManageAnswer } from "@/lib/manage-post";
import type { Post, PostStatus } from "@/lib/posts";
import type { ReportSummary } from "@/lib/report-summary";

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

const none: ReportSummary = { total: 0, byReason: [] };

function ok(status: PostStatus, reports: ReportSummary = none): ManageAnswer {
  return { status: "ok", post: post(status), reports };
}

async function shown() {
  await screen.findByRole("heading", { name: "Where does your post stand?" });
}

function listItems(): string[] {
  return Array.from(document.querySelectorAll("li")).map(
    (item) => item.textContent ?? "",
  );
}

test("says that nobody reported the post, and shows no list", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByRole("heading", { level: 3, name: "Reports" })).toBeDefined();
  expect(screen.getByText("Nobody has reported your post.")).toBeDefined();
  expect(document.querySelector("ul")).toBeNull();
  expect(document.body.textContent?.includes("A report says why")).toBe(false);
});

test("one report is written in the singular, with its reason", async () => {
  const reports: ReportSummary = { total: 1, byReason: [{ reason: "spam", count: 1 }] };
  mocks.check.mockResolvedValue(ok("open", reports));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByText("Your post was reported 1 time.")).toBeDefined();
  expect(listItems()).toEqual(["Spam or an advertisement1 report"]);
  expect(document.body.textContent?.includes("1 reports")).toBe(false);
});

test("several reports: the total, and each reason with its count in the order of the reasons", async () => {
  const reports: ReportSummary = {
    total: 5,
    byReason: [
      { reason: "spam", count: 2 },
      { reason: "scam", count: 1 },
      { reason: "other", count: 2 },
    ],
  };
  mocks.check.mockResolvedValue(ok("open", reports));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByText("Your post was reported 5 times.")).toBeDefined();
  expect(listItems()).toEqual([
    "Spam or an advertisement2 reports",
    "Looks like a scam, or asks for money1 report",
    "Something else2 reports",
  ]);
});

test("says what a report is and what it is not, and who decides", async () => {
  const reports: ReportSummary = { total: 2, byReason: [{ reason: "unsafe", count: 2 }] };
  mocks.check.mockResolvedValue(ok("open", reports));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const text = document.body.textContent ?? "";
  expect(text.includes("A report says why, never who.")).toBe(true);
  expect(text.includes("It does not remove your post by itself, and a report can be wrong.")).toBe(true);
  expect(text.includes("The person who runs this site decides what to do.")).toBe(true);
  expect(text.includes("You can also take your post down yourself, below.")).toBe(true);
});

test("the block sits between the status choices and the way to take the post down", async () => {
  mocks.check.mockResolvedValue(ok("open"));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  const status = screen.getByRole("heading", { name: "Where does your post stand?" });
  const reports = screen.getByRole("heading", { name: "Reports" });
  const takeDown = screen.getByRole("heading", { name: "Take your post down" });
  expect(Boolean(status.compareDocumentPosition(reports) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  expect(Boolean(reports.compareDocumentPosition(takeDown) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
});

test("a change of status shows the counts that came with its answer", async () => {
  const before: ReportSummary = { total: 1, byReason: [{ reason: "spam", count: 1 }] };
  const after: ReportSummary = {
    total: 2,
    byReason: [
      { reason: "spam", count: 1 },
      { reason: "private", count: 1 },
    ],
  };
  mocks.check.mockResolvedValue(ok("open", before));
  mocks.change.mockResolvedValue(ok("done", after));
  render(<ManagePostPanel postId="post-1" />);
  await shown();
  expect(screen.getByText("Your post was reported 1 time.")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
  await waitFor(() => expect(screen.getByText("Your post was reported 2 times.")).toBeDefined());
  expect(listItems().length).toBe(2);
});

test("an incomplete link, a link that does not fit and a failure show no reports", async () => {
  window.location.hash = "";
  const incomplete = render(<ManagePostPanel postId="post-1" />);
  expect(screen.getByRole("heading", { name: "This link is incomplete" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Reports" })).toBeNull();
  incomplete.unmount();

  window.location.hash = `#${key}`;
  mocks.check.mockResolvedValue({ status: "not-allowed" });
  const refused = render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "This link does not match your post" });
  expect(screen.queryByRole("heading", { name: "Reports" })).toBeNull();
  refused.unmount();

  mocks.check.mockResolvedValue({ status: "failed" });
  render(<ManagePostPanel postId="post-1" />);
  await screen.findByRole("heading", { name: "Something went wrong on our side" });
  expect(screen.queryByRole("heading", { name: "Reports" })).toBeNull();
});
