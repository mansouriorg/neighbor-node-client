import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { KindBadge } from "@/components/kind-badge";
import { postKindIds, postKindInfo } from "@/lib/post-kinds";

test("shows the label of each kind", () => {
  for (const id of postKindIds) {
    const { unmount } = render(<KindBadge kind={id} />);
    expect(screen.getByText(postKindInfo[id].label)).toBeDefined();
    unmount();
  }
});

test("uses a different color for each kind", () => {
  const classes = postKindIds.map((id) => {
    const { container, unmount } = render(<KindBadge kind={id} />);
    const className = container.querySelector("span")?.className ?? "";
    unmount();
    return className;
  });
  expect(new Set(classes).size).toBe(3);
});
