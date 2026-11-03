import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NewPostForm } from "@/components/new-post-form";
import type { Post } from "@/lib/posts";

// The real action talks to the server. These tests use a stand-in that they
// control, so no file is written and no network is used.
const mocks = { savePost: vi.fn() };
vi.mock("@/app/board/new/actions", () => ({
  savePost: (input: unknown) => mocks.savePost(input),
}));

beforeEach(() => {
  mocks.savePost.mockReset();
});

function savedPost(id: string): Post {
  return {
    id,
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, about one hour. Two floors, no lift.",
    area: "Olive Street",
    status: "open",
    postedLabel: "Today",
  };
}

const firstKey = "a".repeat(64);
const secondKey = "b".repeat(64);

async function writeAndSave() {
  fireEvent.click(screen.getByRole("radio", { name: /^Help wanted/ }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Help moving a sofa" } });
  fireEvent.change(screen.getByLabelText("Details"), {
    target: { value: "Saturday morning, about one hour. Two floors, no lift." },
  });
  fireEvent.change(screen.getByLabelText("Street or area"), { target: { value: "Olive Street" } });
  fireEvent.click(screen.getByRole("button", { name: "Save my post" }));
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
}

test("after saving, the private link is shown with the key the server sent", async () => {
  mocks.savePost.mockResolvedValue({ status: "saved", post: savedPost("post-1"), manageKey: firstKey });
  render(<NewPostForm />);
  await writeAndSave();
  expect(screen.getByRole("heading", { level: 3, name: "Your private link" })).toBeDefined();
  const box = screen.getByLabelText("Link to manage your post") as HTMLInputElement;
  expect(box.value).toBe(`${window.location.origin}/board/post-1/manage#${firstKey}`);
});

test("writing another post drops the old link, and the next post shows its own", async () => {
  mocks.savePost
    .mockResolvedValueOnce({ status: "saved", post: savedPost("post-1"), manageKey: firstKey })
    .mockResolvedValueOnce({ status: "saved", post: savedPost("post-2"), manageKey: secondKey });
  render(<NewPostForm />);
  await writeAndSave();
  fireEvent.click(screen.getByRole("button", { name: "Write another post" }));
  expect(screen.queryByLabelText("Link to manage your post")).toBeNull();
  expect(document.body.innerHTML.includes(firstKey)).toBe(false);
  await writeAndSave();
  const box = screen.getByLabelText("Link to manage your post") as HTMLInputElement;
  expect(box.value).toBe(`${window.location.origin}/board/post-2/manage#${secondKey}`);
  expect(document.body.innerHTML.includes(firstKey)).toBe(false);
});
