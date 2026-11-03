import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/status-badge";
import { postStatusIds, postStatusLabels } from "@/lib/posts";

test("shows the words for each status", () => {
  for (const status of postStatusIds) {
    const { unmount } = render(<StatusBadge status={status} />);
    expect(screen.getByText(postStatusLabels[status])).toBeDefined();
    unmount();
  }
});

test("hides the colored dot from screen readers", () => {
  const { container } = render(<StatusBadge status="open" />);
  expect(
    container.querySelector("[aria-hidden='true']"),
  ).not.toBeNull();
});
