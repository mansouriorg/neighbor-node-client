import { afterEach, expect, test, vi } from "vitest";
import { absoluteUrl, getSiteUrl, localSiteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("uses the local test server when nothing is set", () => {
  expect(localSiteUrl).toBe("http://localhost:3000");
  expect(getSiteUrl("")).toBe(localSiteUrl);
  expect(getSiteUrl("   ")).toBe(localSiteUrl);
  vi.stubEnv("SITE_URL", "");
  expect(getSiteUrl()).toBe(localSiteUrl);
});

test("reads SITE_URL when no value is given", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  expect(getSiteUrl()).toBe("https://neighbors.example");
});

test("keeps only the address, without a path, a query or a trailing slash", () => {
  expect(getSiteUrl("https://neighbors.example/")).toBe(
    "https://neighbors.example",
  );
  expect(getSiteUrl("https://neighbors.example/board?kind=help#top")).toBe(
    "https://neighbors.example",
  );
  expect(getSiteUrl("  https://neighbors.example:8080/  ")).toBe(
    "https://neighbors.example:8080",
  );
  expect(getSiteUrl("HTTPS://Neighbors.Example")).toBe(
    "https://neighbors.example",
  );
});

test("drops a user name and a password, so they never reach the sitemap", () => {
  expect(getSiteUrl("https://someone:secret@neighbors.example")).toBe(
    "https://neighbors.example",
  );
});

test("refuses a value that is not a full web address", () => {
  const bad = [
    "neighbors.example",
    "localhost:3000",
    "ftp://neighbors.example",
    "javascript:alert(1)",
    "https://",
  ];
  for (const value of bad) {
    expect(() => getSiteUrl(value)).toThrow(
      "SITE_URL must be a full web address",
    );
  }
});

test("the error shows the wrong value, so it is easy to fix", () => {
  expect(() => getSiteUrl("neighbors.example")).toThrow(
    'it was "neighbors.example"',
  );
});

test("makes a full address for a path", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example/");
  expect(absoluteUrl("/board")).toBe("https://neighbors.example/board");
  expect(absoluteUrl("/")).toBe("https://neighbors.example/");
  expect(absoluteUrl("board")).toBe("https://neighbors.example/board");
});
