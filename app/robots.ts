import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Every crawler may visit every page. The sitemap tells them where to start.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
