import { afterEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import PostNotFound from "@/app/board/[id]/not-found";

afterEach(() => {
  vi.restoreAllMocks();
});

function hidden(element: Element) {
  return element.querySelector("svg")?.getAttribute("aria-hidden");
}

test("the error page has a picture on its two ways out, and they keep their names", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorPage error={new Error("boom")} unstable_retry={() => {}} />);
  expect(hidden(screen.getByRole("button", { name: "Try again" }))).toBe("true");
  expect(hidden(screen.getByRole("link", { name: "Back to home" }))).toBe("true");
});

test("the error page of the whole app has a picture on its button", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<GlobalError error={new Error("boom")} unstable_retry={() => {}} />);
  expect(hidden(screen.getByRole("button", { name: "Try again" }))).toBe("true");
});

test("the two pages that say a page is not there have an arrow on their link", () => {
  const first = render(<NotFound />);
  expect(hidden(screen.getByRole("link", { name: "Back to home" }))).toBe("true");
  first.unmount();
  render(<PostNotFound />);
  const link = screen.getByRole("link", { name: "Back to the board" });
  expect(hidden(link)).toBe("true");
  expect(link.getAttribute("href")).toBe("/board");
});
