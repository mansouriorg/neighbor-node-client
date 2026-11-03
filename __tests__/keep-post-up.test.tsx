import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeepPostUp } from "@/components/keep-post-up";
import type { ManageReply } from "@/lib/manage-limits";
import type { Post, PostKeep } from "@/lib/posts";

// The panel does the sending. Here it is a stand-in that each test controls, so
// no file is written and no network is used.
const mocks = { renew: vi.fn() };

beforeEach(() => {
  mocks.renew.mockReset();
});

function postWith(keep: PostKeep | undefined): Post {
  const post: Post = {
    id: "post-1",
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    postedLabel: "Today",
  };
  if (keep) post.keep = keep;
  return post;
}

const shown30 = postWith({ state: "shown", daysLeft: 30 });
const hidden = postWith({ state: "hidden" });
const done = postWith({ state: "done" });

function okReply(keep: PostKeep): ManageReply {
  return {
    status: "ok",
    post: postWith(keep),
    reports: { total: 0, byReason: [] },
  };
}

function answer(value: ManageReply | null) {
  mocks.renew.mockResolvedValue(value);
}

function show(post: Post, busy: boolean = false) {
  return render(
    <KeepPostUp post={post} busy={busy} onRenew={(...args: unknown[]) => mocks.renew(...args)} />,
  );
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

test("a post without the information shows nothing at all", () => {
  const { container } = show(postWith(undefined));
  expect(container.textContent).toBe("");
  expect(screen.queryByRole("button")).toBeNull();
});

test("a post with its full time: a heading, how long it stays, a few words, the button, and nothing is sent", () => {
  show(shown30);
  expect(screen.getByRole("heading", { level: 3, name: "Keep your post up" })).toBeDefined();
  expect(screen.getByText("Your post stays on the board for 30 more days.")).toBeDefined();
  expect(screen.getByText(/A post that nobody touches for 30 days is hidden from the board\./)).toBeDefined();
  expect(screen.getByText(/Nothing is deleted\./)).toBeDefined();
  expect(screen.getByText(/or editing your post, starts the 30 days again\./)).toBeDefined();
  expect(button("Keep my post up")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Show my post again" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.renew).not.toHaveBeenCalled();
});

test("the days left are written in plain words, and one day is in the singular", () => {
  const first = show(postWith({ state: "shown", daysLeft: 12 }));
  expect(screen.getByText("Your post stays on the board for 12 more days.")).toBeDefined();
  first.unmount();
  const second = show(postWith({ state: "shown", daysLeft: 1 }));
  expect(screen.getByText("Your post stays on the board for 1 more day.")).toBeDefined();
  expect(screen.queryByText(/1 more days/)).toBeNull();
  second.unmount();
});

test("a hidden post says so, says that nothing was deleted, and the button shows it again", () => {
  show(hidden);
  expect(screen.getByText("Your post is hidden from the board.")).toBeDefined();
  expect(screen.getByText(/Nothing was deleted, and this page still works\./)).toBeDefined();
  expect(screen.getByText(/Press the button to show it again for 30 more days\./)).toBeDefined();
  expect(button("Show my post again")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Keep my post up" })).toBeNull();
});

test("a post that is done says it is never hidden, and has no button", () => {
  show(done);
  expect(screen.getByRole("heading", { level: 3, name: "Keep your post up" })).toBeDefined();
  expect(screen.getByText("Your post is marked as done.")).toBeDefined();
  expect(screen.getByText(/never hidden, so there is nothing to do here/)).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

test("the button is easy to hit with a thumb, in both states", () => {
  const first = show(shown30);
  expect(button("Keep my post up").className).toContain("h-11");
  first.unmount();
  show(hidden);
  expect(button("Show my post again").className).toContain("h-11");
});

test("the button of a hidden post is the main action, and the other one is quiet", () => {
  const first = show(shown30);
  const quiet = button("Keep my post up").className;
  first.unmount();
  show(hidden);
  expect(button("Show my post again").className).not.toBe(quiet);
  expect(button("Show my post again").className).toContain("bg-accent text-on-accent");
  expect(quiet).not.toContain("bg-accent text-on-accent");
});

test("one press sends one request and says that it worked, as a status for screen readers", async () => {
  answer(okReply({ state: "shown", daysLeft: 30 }));
  show(postWith({ state: "shown", daysLeft: 20 }));
  fireEvent.click(button("Keep my post up"));
  const message = await screen.findByText("Done. Your post stays on the board for 30 more days.");
  expect(message.getAttribute("role")).toBe("status");
  expect(mocks.renew).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a hidden post that is shown again says so", async () => {
  answer(okReply({ state: "shown", daysLeft: 30 }));
  show(hidden);
  fireEvent.click(button("Show my post again"));
  await screen.findByText("Done. Your post is on the board again for 30 more days.");
  expect(mocks.renew).toHaveBeenCalledTimes(1);
});

test("if the post turned out to be done, the message says that it is never hidden and does not promise 30 days", async () => {
  answer(okReply({ state: "done" }));
  show(postWith({ state: "shown", daysLeft: 20 }));
  fireEvent.click(button("Keep my post up"));
  await screen.findByText("Your post is marked as done, so it is never hidden. Nothing had to be changed.");
  expect(screen.queryByText(/Done\. Your post stays/)).toBeNull();
});

test("after the answer the button keeps its place, so the focus is not lost", async () => {
  answer(okReply({ state: "shown", daysLeft: 30 }));
  const view = show(hidden);
  const before = button("Show my post again");
  before.focus();
  fireEvent.click(before);
  await screen.findByText(/Done\./);
  view.rerender(<KeepPostUp post={shown30} busy={false} onRenew={(...args: unknown[]) => mocks.renew(...args)} />);
  const after = button("Keep my post up");
  expect(after).toBe(before);
  expect(document.activeElement).toBe(after);
});

test("while the request is on its way the button says it is busy, and a second press does nothing", async () => {
  let finish: (value: ManageReply | null) => void = () => {};
  mocks.renew.mockReturnValueOnce(new Promise<ManageReply | null>((resolve) => { finish = resolve; }));
  show(postWith({ state: "shown", daysLeft: 20 }));
  fireEvent.click(button("Keep my post up"));
  fireEvent.click(button("Working..."));
  fireEvent.click(button("Working..."));
  expect(mocks.renew).toHaveBeenCalledTimes(1);
  expect(button("Working...").getAttribute("aria-disabled")).toBe("true");
  finish(okReply({ state: "shown", daysLeft: 30 }));
  await screen.findByText(/Done\./);
  expect(mocks.renew).toHaveBeenCalledTimes(1);
  expect(button("Keep my post up").getAttribute("aria-disabled")).toBeNull();
});

test("when the panel is busy with another change, the button waits", () => {
  show(shown30, true);
  expect(button("Keep my post up").getAttribute("aria-disabled")).toBe("true");
});

test("when another change is still on its way the block says so", async () => {
  answer(null);
  show(shown30, true);
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Another change is still on its way.");
  expect(alert.textContent).toContain("Please wait a moment and try again.");
  expect(screen.queryByRole("status")?.textContent ?? "").toBe("");
});

test("a visitor who tried too often is told how long to wait", async () => {
  answer({ status: "limited", minutes: 12 });
  show(shown30);
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Too many tries just now.");
  expect(alert.textContent).toContain("Nothing was changed.");
  expect(alert.textContent).toContain("Please wait about 12 minutes and try again.");
  expect(button("Keep my post up")).toBeDefined();
});

test("one minute is written in the singular", async () => {
  answer({ status: "limited", minutes: 1 });
  show(shown30);
  fireEvent.click(button("Keep my post up"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("about 1 minute and");
  expect(alert.textContent).not.toContain("1 minutes");
});

test("a failure on the server, or a request that cannot be sent, is told, and a later try can work and clears the message", async () => {
  mocks.renew.mockResolvedValueOnce({ status: "failed" });
  mocks.renew.mockRejectedValueOnce(new Error("offline"));
  mocks.renew.mockResolvedValueOnce(okReply({ state: "shown", daysLeft: 30 }));
  show(postWith({ state: "shown", daysLeft: 20 }));
  fireEvent.click(button("Keep my post up"));
  const first = await screen.findByRole("alert");
  expect(first.textContent).toContain("This did not work. Nothing was changed.");
  fireEvent.click(button("Keep my post up"));
  await waitFor(() => expect(mocks.renew).toHaveBeenCalledTimes(2));
  await screen.findByRole("button", { name: "Keep my post up" });
  expect(screen.getByRole("alert").textContent).toContain("This did not work.");
  fireEvent.click(button("Keep my post up"));
  await screen.findByText(/Done\./);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.renew).toHaveBeenCalledTimes(3);
});

test("a message about a success goes away when the button is pressed again", async () => {
  mocks.renew.mockResolvedValueOnce(okReply({ state: "shown", daysLeft: 30 }));
  let finish: (value: ManageReply | null) => void = () => {};
  mocks.renew.mockReturnValueOnce(new Promise<ManageReply | null>((resolve) => { finish = resolve; }));
  show(postWith({ state: "shown", daysLeft: 20 }));
  fireEvent.click(button("Keep my post up"));
  await screen.findByText(/Done\./);
  fireEvent.click(button("Keep my post up"));
  expect(screen.queryByText(/Done\./)).toBeNull();
  finish({ status: "failed" });
  await screen.findByRole("alert");
});

test("a link that does not fit is left to the panel: the block shows nothing of its own", async () => {
  answer({ status: "not-allowed" });
  show(shown30);
  fireEvent.click(button("Keep my post up"));
  await waitFor(() => expect(mocks.renew).toHaveBeenCalledTimes(1));
  await screen.findByRole("button", { name: "Keep my post up" });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/Done\./)).toBeNull();
});

test("nothing is sent before the button is pressed, and pressing sends no data of its own", async () => {
  answer(okReply({ state: "shown", daysLeft: 30 }));
  const view = show(shown30);
  expect(mocks.renew).not.toHaveBeenCalled();
  fireEvent.click(button("Keep my post up"));
  await screen.findByText(/Done\./);
  expect(mocks.renew.mock.calls[0]).toEqual([]);
  view.unmount();
});
