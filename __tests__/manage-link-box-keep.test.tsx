import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManageLinkBox } from "@/components/manage-link-box";

const key = "a".repeat(64);

test("tells that the post stays 30 days, is then hidden and never deleted, and that the link shows it again", () => {
  render(<ManageLinkBox postId="post-1" manageKey={key} />);
  const sentence = screen.getByText(/Your post stays on the board for 30 days/);
  expect(sentence.textContent).toContain("After that it is hidden, never deleted");
  expect(sentence.textContent).toContain("with this link you can show it again");
});
