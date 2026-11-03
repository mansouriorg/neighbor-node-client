import { expect, test, vi } from "vitest";
import { generateMetadata } from "@/app/board/[id]/page";
import { metadata as boardMetadata } from "@/app/board/page";
import { metadata as newPostMetadata } from "@/app/board/new/page";
import { metadata } from "@/app/layout";
import { getSiteUrl } from "@/lib/site";

// next/font only works inside a Next.js build, so the test uses simple stand-ins.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans-stub" }),
}));

// notFound() is not used here, but the page imports it.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

test("links in the metadata become full addresses, built from SITE_URL", () => {
  expect(metadata.metadataBase instanceof URL).toBe(true);
  expect(String(metadata.metadataBase)).toBe(new URL(getSiteUrl()).href);
});

test("says the site name and type for link previews", () => {
  expect(metadata.openGraph).toEqual({
    siteName: "Neighbor Node",
    type: "website",
    locale: "en_US",
  });
});

test("asks for the large picture on X and similar sites", () => {
  expect(metadata.twitter).toEqual({ card: "summary_large_image" });
});

// Next replaces a whole openGraph block when a page sets its own, and that
// would drop the site name. Until a page has a reason to, none should.
test("no page sets its own openGraph, so all of them keep the site's", async () => {
  expect(boardMetadata.openGraph).toBeUndefined();
  expect(newPostMetadata.openGraph).toBeUndefined();
  const post = await generateMetadata({
    params: Promise.resolve({ id: "sample-1" }),
  });
  expect(post.openGraph).toBeUndefined();
});
