import type { MetadataRoute } from "next";
import { absoluteUrl, sitemapPaths } from "@/lib/site";

// The list of pages is in lib/site.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths.map((path) => ({ url: absoluteUrl(path) }));
}
