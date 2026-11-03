import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BoardPage, { dynamic, metadata } from "@/app/board/page";
import type { Post } from "@/lib/posts";

// No test may read the real file with the posts of the person who runs the
// tests. The file is replaced by a stand-in that each test controls.
const mocks = { readPosts: vi.fn() };
vi.mock("@/lib/post-store", () => ({
  defaultPostsFile: () => "no-real-file-is-read-in-tests",
  readPosts: (...args: unknown[]) => mocks.readPosts(...args),
}));

beforeEach(() => {
  mocks.readPosts.mockReset();
  mocks.readPosts.mockResolvedValue([]);
});

const savedHelp: Post = {
  id: "post-a",
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
  status: "open",
  postedLabel: "Today",
};

const savedLend: Post = {
  id: "post-b",
  kind: "lend",
  title: "A drill for the weekend",
  details: "With a set of bits. Please bring it back clean.",
  area: "Harbor Road area",
  status: "open",
  postedLabel: "Yesterday",
};

type Query = { [key: string]: string | string[] | undefined };

// The page is an async Server Component, so it is called like a function and awaited.
async function renderBoard(query: Query = {}) {
  render(await BoardPage({ searchParams: Promise.resolve(query) }));
}

function currentFilter(): string | null {
  const link = screen
    .getAllByRole("link")
    .find((item) => item.getAttribute("aria-current") === "page");
  return link ? link.textContent : null;
}

test("has a page title of its own", () => {
  expect(metadata.title).toBe("The board");
});

test("is made fresh for every visit, because the saved posts change", () => {
  expect(dynamic).toBe("force-dynamic");
});

test("with no saved posts, shows the heading and says the posts are samples", async () => {
  await renderBoard();
  expect(
    screen.getByRole("heading", { level: 1, name: "The board" }),
  ).toBeDefined();
  expect(screen.getByText("Sample posts.")).toBeDefined();
  expect(screen.queryByText("Real posts and examples.")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("with no saved posts, shows all nine examples, each marked Example", async () => {
  await renderBoard();
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(9);
  expect(screen.getAllByText("Example").length).toBe(9);
  expect(screen.getByText("Showing 9 of 9 posts")).toBeDefined();
  expect(currentFilter()).toBe("All posts");
});

test("saved posts show first, and the examples stay marked", async () => {
  mocks.readPosts.mockResolvedValue([savedHelp, savedLend]);
  await renderBoard();
  const titles = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
  expect(titles.length).toBe(11);
  expect(titles[0]).toBe("Help moving a sofa");
  expect(titles[1]).toBe("A drill for the weekend");
  expect(screen.getByText("Showing 11 of 11 posts")).toBeDefined();
  expect(screen.getAllByText("Example").length).toBe(9);
  expect(screen.getByText("Real posts and examples.")).toBeDefined();
  expect(screen.queryByText("Sample posts.")).toBeNull();
});

test("the kind filter works on saved posts and examples together", async () => {
  mocks.readPosts.mockResolvedValue([savedHelp, savedLend]);
  await renderBoard({ kind: "help" });
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(4);
  expect(screen.getByText("Showing 4 of 11 posts")).toBeDefined();
  expect(currentFilter()).toBe("Help wanted");
});

test("shows only the posts of the kind in the address", async () => {
  await renderBoard({ kind: "lend" });
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(3);
  expect(screen.getByText("Showing 3 of 9 posts")).toBeDefined();
  expect(currentFilter()).toBe("Lend");
});

test("shows everything when the kind is unknown", async () => {
  await renderBoard({ kind: "nonsense" });
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(9);
  expect(currentFilter()).toBe("All posts");
});

test("shows everything when the kind is given twice", async () => {
  await renderBoard({ kind: ["help", "offer"] });
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(9);
});

test("links each post to its own page, saved posts too", async () => {
  mocks.readPosts.mockResolvedValue([savedHelp]);
  await renderBoard();
  const hrefs = screen
    .getAllByRole("link")
    .map((item) => item.getAttribute("href") ?? "")
    .filter(
      (href) => href.startsWith("/board/sample-") || href.startsWith("/board/post-"),
    );
  expect(hrefs.length).toBe(10);
  expect(new Set(hrefs).size).toBe(10);
  expect(hrefs).toContain("/board/post-a");
  expect(hrefs).toContain("/board/sample-1");
  expect(hrefs).toContain("/board/sample-9");
});

test("a post that repeats an id is shown once", async () => {
  mocks.readPosts.mockResolvedValue([
    savedHelp,
    { ...savedHelp, title: "The same id again" },
  ]);
  await renderBoard();
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(10);
  expect(screen.queryByText("The same id again")).toBeNull();
});

test("when the saved posts cannot be read, the board still opens and says so", async () => {
  mocks.readPosts.mockRejectedValue(new Error("boom, the file is damaged"));
  const original = console.error;
  console.error = () => {};
  try {
    await renderBoard();
  } finally {
    console.error = original;
  }
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Saved posts could not be loaded.");
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(9);
  expect(screen.getAllByText("Example").length).toBe(9);
  expect(screen.queryByText("Sample posts.")).toBeNull();
  expect(screen.queryByText(/boom/)).toBeNull();
});

test("has a button that opens the form to write a post", async () => {
  await renderBoard();
  const link = screen.getByRole("link", { name: "Write a post" });
  expect(link.getAttribute("href")).toBe("/board/new");
});

test("is the target of the skip link", async () => {
  await renderBoard();
  expect(document.querySelector("main")?.getAttribute("id")).toBe(
    "main-content",
  );
});
