import { beforeEach, expect, test, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NewPostForm } from "@/components/new-post-form";
import type { Post } from "@/lib/posts";
import type { SavePostResult } from "@/lib/save-post";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { savePost: vi.fn() };
vi.mock("@/app/board/new/actions", () => ({
  savePost: (input: unknown) => mocks.savePost(input),
}));

beforeEach(() => {
  mocks.savePost.mockReset();
});

const savedPost: Post = {
  id: "post-1",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, about one hour. Two floors, no lift.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save my post" }));
}

function fillEverything() {
  fireEvent.click(screen.getByRole("radio", { name: /^Help wanted/ }));
  fill("Title", "  Help moving a sofa  ");
  fill("Details", "Saturday morning, about one hour. Two floors, no lift.");
  fill("Street or area", "Olive Street");
}

function answerLimited(minutes: number) {
  const result: SavePostResult = { status: "limited", minutes };
  mocks.savePost.mockResolvedValue(result);
}

test("when saving is paused, it says so and for how long, and the text stays", async () => {
  answerLimited(12);
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "Saving is paused for now" }),
  ).toBeDefined();
  expect(within(alert).getByText(/Too many posts were saved in the last hour/)).toBeDefined();
  expect(within(alert).getByText("Please try again in about 12 minutes.")).toBeDefined();
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "  Help moving a sofa  ",
  );
  expect((screen.getByLabelText("Street or area") as HTMLInputElement).value).toBe(
    "Olive Street",
  );
  await waitFor(() => expect(document.activeElement).toBe(alert));
  expect(
    screen.getByRole("button", { name: "Save my post" }).getAttribute("aria-disabled"),
  ).toBeNull();
});

test("one minute is written in the singular", async () => {
  answerLimited(1);
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Please try again in about 1 minute.")).toBeDefined();
});

test("the other notices do not mention a time to wait", async () => {
  mocks.savePost.mockResolvedValue({ status: "full" });
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(within(alert).queryByText(/Please try again in about/)).toBeNull();
});

test("trying again clears the notice, and a later try can work", async () => {
  mocks.savePost
    .mockResolvedValueOnce({ status: "limited", minutes: 5 })
    .mockResolvedValueOnce({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  render(<NewPostForm />);
  fillEverything();
  save();
  await screen.findByRole("heading", { name: "Saving is paused for now" });
  save();
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
  expect(mocks.savePost).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
});
