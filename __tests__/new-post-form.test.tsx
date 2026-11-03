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

function answer(result: SavePostResult) {
  mocks.savePost.mockResolvedValue(result);
}

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

test("starts with an empty form and no messages", () => {
  render(<NewPostForm />);
  expect(screen.getAllByRole("radio").length).toBe(3);
  expect(screen.getByLabelText("Title")).toBeDefined();
  expect(screen.getByLabelText("Details")).toBeDefined();
  expect(screen.getByLabelText("Street or area")).toBeDefined();
  expect(screen.getByRole("button", { name: "Save my post" })).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("choosing a kind selects only that kind", () => {
  render(<NewPostForm />);
  const help = screen.getByRole("radio", { name: /^Help wanted/ });
  const offer = screen.getByRole("radio", { name: /^Offer/ });
  fireEvent.click(help);
  expect((help as HTMLInputElement).checked).toBe(true);
  fireEvent.click(offer);
  expect((help as HTMLInputElement).checked).toBe(false);
  expect((offer as HTMLInputElement).checked).toBe(true);
});

test("an empty form lists one message for each field and moves focus to the list", () => {
  render(<NewPostForm />);
  save();
  const alert = screen.getByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "There are 4 things to fix" }),
  ).toBeDefined();
  expect(within(alert).getAllByRole("link").length).toBe(4);
  expect(
    within(alert).getByText("Choose what kind of post this is."),
  ).toBeDefined();
  expect(within(alert).getByText("Write a short title.")).toBeDefined();
  expect(within(alert).getByText("Say a little more about it.")).toBeDefined();
  expect(within(alert).getByText("Write the street or area.")).toBeDefined();
  expect(document.activeElement).toBe(alert);
  expect(mocks.savePost).not.toHaveBeenCalled();
});

test("each message is linked to its field for screen readers", () => {
  render(<NewPostForm />);
  save();
  const title = screen.getByLabelText("Title");
  expect(title.getAttribute("aria-invalid")).toBe("true");
  const ids = (title.getAttribute("aria-describedby") ?? "").split(" ");
  const described = ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  expect(described).toContain("Write a short title.");
});

test("fixing a field removes its message", () => {
  render(<NewPostForm />);
  save();
  fill("Title", "Help moving a sofa");
  expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBeNull();
  const alert = screen.getByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "There are 3 things to fix" }),
  ).toBeDefined();
  expect(within(alert).queryByText("Write a short title.")).toBeNull();
});

test("an area with a house number is refused, and nothing is sent", () => {
  render(<NewPostForm />);
  fillEverything();
  fill("Street or area", "Olive Street 12");
  save();
  const alert = screen.getByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "There is 1 thing to fix" }),
  ).toBeDefined();
  expect(
    within(alert).getByText(
      "Write only a street or an area, without a house number.",
    ),
  ).toBeDefined();
  expect(mocks.savePost).not.toHaveBeenCalled();
});

test("a good post is sent to the server, with clean text", async () => {
  answer({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  render(<NewPostForm />);
  fillEverything();
  save();
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
  expect(mocks.savePost).toHaveBeenCalledTimes(1);
  expect(mocks.savePost).toHaveBeenCalledWith({
    kind: "help",
    title: "Help moving a sofa",
    details: "Saturday morning, about one hour. Two floors, no lift.",
    area: "Olive Street",
  });
});

test("while saving, the button says so and a second press does nothing", async () => {
  let finish: (result: SavePostResult) => void = () => {};
  mocks.savePost.mockReturnValue(
    new Promise<SavePostResult>((resolve) => {
      finish = resolve;
    }),
  );
  render(<NewPostForm />);
  fillEverything();
  save();
  const button = await screen.findByRole("button", { name: "Saving..." });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("status").textContent).toBe("Saving your post...");
  fireEvent.click(button);
  expect(mocks.savePost).toHaveBeenCalledTimes(1);
  finish({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
});

test("after saving, shows the post and links to it and to the board", async () => {
  answer({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  render(<NewPostForm />);
  fillEverything();
  save();
  const heading = await screen.findByRole("heading", {
    level: 2,
    name: "Your post is saved",
  });
  await waitFor(() =>
    expect(document.activeElement).toBe(heading.closest("section")),
  );
  expect(screen.getByText(/It is on the board now/)).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 2, name: "Help moving a sofa" }),
  ).toBeDefined();
  expect(screen.getByText("Olive Street")).toBeDefined();
  expect(screen.getByText("Today")).toBeDefined();
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.getByRole("link", { name: "See it on the board" }).getAttribute("href"),
  ).toBe("/board");
  expect(
    screen.getByRole("link", { name: "Help moving a sofa" }).getAttribute("href"),
  ).toBe("/board/post-1");
});

test("write another post: an empty form comes back and focus goes to its start", async () => {
  answer({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  render(<NewPostForm />);
  fillEverything();
  save();
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
  fireEvent.click(screen.getByRole("button", { name: "Write another post" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  const help = screen.getByRole("radio", { name: /^Help wanted/ });
  expect((help as HTMLInputElement).checked).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(help));
  expect(screen.queryByText("Your post is saved")).toBeNull();
});

test("when the server finds a problem, its messages are shown and the text stays", async () => {
  answer({
    status: "invalid",
    errors: { title: "The title is too short. Use at least 5 characters." },
  });
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "There is 1 thing to fix" }),
  ).toBeDefined();
  const title = screen.getByLabelText("Title") as HTMLInputElement;
  expect(title.getAttribute("aria-invalid")).toBe("true");
  expect(title.value).toBe("  Help moving a sofa  ");
  await waitFor(() => expect(document.activeElement).toBe(alert));
});

test("a full board is explained, and the text stays", async () => {
  answer({ status: "full" });
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "The board is full" }),
  ).toBeDefined();
  expect(
    (screen.getByLabelText("Street or area") as HTMLInputElement).value,
  ).toBe("Olive Street");
  await waitFor(() => expect(document.activeElement).toBe(alert));
  expect(
    screen.getByRole("button", { name: "Save my post" }).getAttribute("aria-disabled"),
  ).toBeNull();
});

test("a failure is explained, and trying again can work", async () => {
  mocks.savePost
    .mockResolvedValueOnce({ status: "failed" })
    .mockResolvedValueOnce({ status: "saved", post: savedPost, manageKey: "a".repeat(64) });
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "Your post was not saved" }),
  ).toBeDefined();
  expect(screen.getByText(/What you wrote is still here/)).toBeDefined();
  save();
  await screen.findByRole("heading", { level: 2, name: "Your post is saved" });
  expect(mocks.savePost).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("when the server cannot be reached, it says so without showing the error", async () => {
  mocks.savePost.mockRejectedValue(new Error("connection reset by peer"));
  render(<NewPostForm />);
  fillEverything();
  save();
  const alert = await screen.findByRole("alert");
  expect(
    within(alert).getByRole("heading", { name: "Your post was not saved" }),
  ).toBeDefined();
  expect(screen.queryByText(/connection reset/)).toBeNull();
  expect(
    (screen.getByLabelText("Title") as HTMLInputElement).value,
  ).toBe("  Help moving a sofa  ");
});
