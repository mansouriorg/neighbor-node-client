import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ManageLinkBox, manageLinkFor } from "@/components/manage-link-box";

// If the box used the Link of Next, this stand-in would stop it. The private page has
// to open from a plain link, so that the page loads fresh and reads the key after the "#".
vi.mock("next/link", () => ({
  default: () => {
    throw new Error("The link box must use a plain <a>, not the Link of Next.");
  },
}));

const key = "a".repeat(64);
const expectedLink = `${window.location.origin}/board/post-1/manage#${key}`;

// jsdom has no clipboard, so each test puts in the one it needs.
function useClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
}

test("the private address is the site, the post, and the key after a #", () => {
  expect(manageLinkFor("https://neighbors.example", "post-7", "abc")).toBe(
    "https://neighbors.example/board/post-7/manage#abc",
  );
});

test("shows the link in a box that cannot be edited, and says it is shown once", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  expect(screen.getByRole("heading", { level: 3, name: "Your private link" })).toBeDefined();
  const box = screen.getByLabelText("Link to manage your post") as HTMLInputElement;
  expect(box.value).toBe(expectedLink);
  expect(box.readOnly).toBe(true);
  expect(screen.getByText(/It is shown only now/)).toBeDefined();
});

test("has a plain link that opens the private page, with the key after the #", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  const link = screen.getByRole("link", { name: "Open your private page" });
  expect(link.getAttribute("href")).toBe(`/board/post-1/manage#${key}`);
});

test("the box draws without the Link of Next", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  expect(screen.getByRole("link", { name: "Open your private page" })).toBeDefined();
});

test("copy puts the link on the clipboard and says so", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  useClipboard({ writeText });
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByText("Link copied.")).toBeDefined();
  expect(writeText).toHaveBeenCalledWith(expectedLink);
});

test("when copying is refused, or there is no clipboard, it says so and does not fail", async () => {
  useClipboard({ writeText: vi.fn().mockRejectedValue(new Error("no")) });
  const first = render(<ManageLinkBox postId="post-1" manageKey={key} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByText(/Copying did not work here/)).toBeDefined();
  first.unmount();
  useClipboard(undefined);
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByText(/Copying did not work here/)).toBeDefined();
});
