import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import RootLayout, { metadata } from "@/app/layout";

// next/font only works inside a Next.js build, so the test uses simple stand-ins.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans-stub" }),
}));

test("has a real title, a title template and a description", () => {
  const title = metadata.title as { default: string; template: string };
  expect(title.default).toBe(
    "Neighbor Node - a help and lending board for neighbors",
  );
  expect(title.template).toBe("%s | Neighbor Node");
  expect(metadata.description).toContain("neighbors");
  expect(String(metadata.description)).not.toMatch(/create next app/i);
});

test("wraps the page in a header and a footer, with a skip link first", () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <p>Page content</p>
    </RootLayout>,
  );
  expect(html).toContain('<html lang="en"');
  expect(html).toContain("font-geist-sans-stub");
  const skip = html.indexOf('href="#main-content"');
  const header = html.indexOf("<header");
  const content = html.indexOf("Page content");
  const footer = html.indexOf("<footer");
  expect(skip).toBeGreaterThan(-1);
  expect(skip).toBeLessThan(header);
  expect(header).toBeLessThan(content);
  expect(content).toBeLessThan(footer);
});
