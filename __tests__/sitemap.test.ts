import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { sitemapPaths } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("lists the home page and the board with full addresses", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  expect(sitemap()).toEqual([
    { url: "https://neighbors.example/" },
    { url: "https://neighbors.example/board" },
  ]);
});

test("every listed page really exists in the app folder", () => {
  for (const path of sitemapPaths) {
    const file = path === "/" ? "app/page.tsx" : `app${path}/page.tsx`;
    expect(existsSync(join(process.cwd(), file))).toBe(true);
  }
});

test("leaves out the made-up sample posts and the form", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  for (const entry of sitemap()) {
    expect(entry.url).not.toContain("/board/");
  }
});

test("lists no address twice", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  const urls = sitemap().map((entry) => entry.url);
  expect(new Set(urls).size).toBe(urls.length);
});
