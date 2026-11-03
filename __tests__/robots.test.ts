import { afterEach, expect, test, vi } from "vitest";
import robots from "@/app/robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("lets every crawler visit every page", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
});

test("points to the sitemap on the address of the site", () => {
  vi.stubEnv("SITE_URL", "https://neighbors.example");
  expect(robots().sitemap).toBe("https://neighbors.example/sitemap.xml");
});

test("uses the local test server when SITE_URL is not set", () => {
  vi.stubEnv("SITE_URL", "");
  expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml");
});
