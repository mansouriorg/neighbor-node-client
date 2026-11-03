import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { Icon, iconNames, kindIconName } from "@/components/icons";
import { postKindIds } from "@/lib/post-kinds";

test("there are icons to draw, and each one is a picture that has a shape in it", () => {
  expect(iconNames.length).toBeGreaterThan(10);
  for (const name of iconNames) {
    const { container, unmount } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("path, circle, rect")).not.toBeNull();
    unmount();
  }
});

test("every icon is hidden from screen readers, because the words next to it say the same", () => {
  for (const name of iconNames) {
    const { container, unmount } = render(<Icon name={name} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    unmount();
  }
});

test("an icon takes its color from the text around it", () => {
  const { container } = render(<Icon name="pin" />);
  const svg = container.querySelector("svg");
  expect(svg?.getAttribute("stroke")).toBe("currentColor");
  expect(svg?.getAttribute("fill")).toBe("none");
});

test("an icon is small by default, and the size can be set", () => {
  const first = render(<Icon name="clock" />);
  expect(first.container.querySelector("svg")?.getAttribute("class")).toBe("h-4 w-4");
  first.unmount();
  const second = render(<Icon name="clock" className="h-6 w-6" />);
  expect(second.container.querySelector("svg")?.getAttribute("class")).toBe("h-6 w-6");
});

test("each kind of post has its own icon, and that icon exists", () => {
  const chosen = postKindIds.map((id) => kindIconName[id]);
  expect(new Set(chosen).size).toBe(postKindIds.length);
  for (const name of chosen) {
    expect(iconNames.includes(name)).toBe(true);
  }
});
