import { expect, test } from "vitest";
import nextConfig from "@/next.config";

// Next asks for the headers by calling headers(), so the tests do the same.
async function allRules() {
  return nextConfig.headers === undefined ? [] : await nextConfig.headers();
}

async function siteWideHeaders() {
  const rules = await allRules();
  return rules.flatMap((rule) =>
    rule.source === "/:path*" ? rule.headers : [],
  );
}

async function valueOf(key: string): Promise<string | undefined> {
  const list = await siteWideHeaders();
  const found = list.find((header) => header.key === key);
  return found === undefined ? undefined : found.value;
}

test("has one rule, and it covers the whole site", async () => {
  const rules = await allRules();
  expect(rules.length).toBe(1);
  expect(rules[0].source).toBe("/:path*");
});

test("stops browsers from guessing the type of a file", async () => {
  expect(await valueOf("X-Content-Type-Options")).toBe("nosniff");
});

test("tells other sites only the address of this site, not the page", async () => {
  expect(await valueOf("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin",
  );
});

test("does not let other sites show this site in a frame", async () => {
  expect(await valueOf("X-Frame-Options")).toBe("DENY");
  expect(await valueOf("Content-Security-Policy")).toBe(
    "frame-ancestors 'none'",
  );
});

test("turns off the camera, the microphone and the location", async () => {
  const value = (await valueOf("Permissions-Policy")) ?? "";
  expect(value).toContain("camera=()");
  expect(value).toContain("microphone=()");
  expect(value).toContain("geolocation=()");
});

test("does not repeat a header", async () => {
  const names = (await siteWideHeaders()).map((header) =>
    header.key.toLowerCase(),
  );
  expect(new Set(names).size).toBe(names.length);
});

test("every header has a clean one-line value", async () => {
  for (const header of await siteWideHeaders()) {
    expect(/^\S(.*\S)?$/.test(header.value)).toBe(true);
    expect(header.value).not.toContain("\n");
    expect(header.value).not.toContain("\r");
  }
});

test("sets no script policy yet, because it could stop the scripts of Next", async () => {
  const value = (await valueOf("Content-Security-Policy")) ?? "";
  expect(value).not.toContain("script-src");
  expect(value).not.toContain("default-src");
});

test("does not tell the world that the site runs on Next.js", () => {
  expect(nextConfig.poweredByHeader).toBe(false);
});
