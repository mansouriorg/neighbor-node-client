import { afterEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ErrorPage from "@/app/error";

afterEach(() => {
  vi.restoreAllMocks();
});

test("tells the visitor something went wrong and offers a way home", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorPage error={new Error("boom")} unstable_retry={() => {}} />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
  ).toBeDefined();
  const link = screen.getByRole("link", { name: "Back to home" });
  expect(link.getAttribute("href")).toBe("/");
});

test("calls unstable_retry once when Try again is clicked", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const retry = vi.fn();
  render(<ErrorPage error={new Error("boom")} unstable_retry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("logs the error to the console", () => {
  const logError = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("boom");
  render(<ErrorPage error={error} unstable_retry={() => {}} />);
  expect(logError).toHaveBeenCalledWith(error);
});

test("shows the error reference only when there is a digest", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = Object.assign(new Error("boom"), { digest: "abc123" });
  const { unmount } = render(
    <ErrorPage error={error} unstable_retry={() => {}} />,
  );
  expect(screen.getByText("abc123")).toBeDefined();
  unmount();
  render(<ErrorPage error={new Error("boom")} unstable_retry={() => {}} />);
  expect(screen.queryByText(/Error reference/)).toBeNull();
});
