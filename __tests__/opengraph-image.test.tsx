import { expect, test, vi } from "vitest";
import Image, { alt, contentType, size } from "@/app/opengraph-image";
import { ShareCard } from "@/components/share-card";

// next/og draws pictures with WebAssembly, which does not run in this test.
// A stand-in remembers what it was asked to draw.
vi.mock("next/og", () => ({
  ImageResponse: class {
    element: unknown;
    options: unknown;
    constructor(element: unknown, options: unknown) {
      this.element = element;
      this.options = options;
    }
  },
}));

test("is a PNG of 1200 by 630 pixels, the size that social sites expect", () => {
  expect(size).toEqual({ width: 1200, height: 630 });
  expect(contentType).toBe("image/png");
});

test("has a text alternative that names the site", () => {
  expect(alt).toContain("Neighbor Node");
});

test("draws the share card at that size", () => {
  const response = Image() as unknown as {
    element: { type: unknown };
    options: unknown;
  };
  expect(response.element.type).toBe(ShareCard);
  expect(response.options).toEqual({ width: 1200, height: 630 });
});
