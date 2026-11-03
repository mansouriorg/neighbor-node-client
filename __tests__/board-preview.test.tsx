import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardPreview } from "@/components/board-preview";
import { samplePosts } from "@/lib/posts";

test("the picture is hidden from screen readers as a whole", () => {
  const { container } = render(<BoardPreview />);
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryAllByRole("heading").length).toBe(0);
});

test("it is only a picture: nothing in it can be clicked, typed into or read as a title", () => {
  const { container } = render(<BoardPreview />);
  expect(container.querySelectorAll("a, button, input, textarea, select, h1, h2, h3, img").length).toBe(0);
});

test("it shows the first three sample posts, with their words", () => {
  render(<BoardPreview />);
  for (const post of samplePosts.slice(0, 3)) {
    expect(screen.getByText(post.title)).toBeDefined();
    expect(screen.getAllByText(post.area).length).toBeGreaterThan(0);
  }
  expect(screen.queryByText(samplePosts[3].title)).toBeNull();
});

test("each little card has the bar of its kind", () => {
  const { container } = render(<BoardPreview />);
  const bars = Array.from(container.querySelectorAll("span.absolute.inset-x-0"));
  expect(bars.length).toBe(3);
  samplePosts.slice(0, 3).forEach((post, index) => {
    expect(bars[index].className).toContain(`bg-${post.kind}`);
  });
});

test("the cards come in one after the other", () => {
  const { container } = render(<BoardPreview />);
  const cards = Array.from(container.querySelectorAll("div.rise")) as HTMLElement[];
  expect(cards.map((card) => card.style.animationDelay)).toEqual(["0ms", "120ms", "240ms"]);
});

test("the third card is left out on a phone, and the first two are always there", () => {
  const { container } = render(<BoardPreview />);
  const cards = Array.from(container.querySelectorAll("div.rise"));
  const words = cards.map((card) => card.className.split(" "));
  expect(words[0].includes("hidden")).toBe(false);
  expect(words[1].includes("hidden")).toBe(false);
  expect(words[2].includes("hidden")).toBe(true);
  expect(words[2].includes("sm:block")).toBe(true);
});
