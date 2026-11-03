// Where the site lives. The sitemap and robots.txt need full addresses.
// Before you build for a real site, set SITE_URL, for example https://neighbors.example
// Without it, the address of the local test server is used.
export const localSiteUrl = "http://localhost:3000";

// The pages that search engines should list.
// The sample posts and the form are left out on purpose: the posts are made up.
// When real posts exist, add one path for each of them.
export const sitemapPaths: string[] = ["/", "/board"];

// Reads a web address. Gives nothing back for anything that is not http or https.
function parseWebAddress(text: string): URL | null {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// The address of the site: scheme, host and port only. A path, a query, a
// user name or a password in the value are dropped.
export function getSiteUrl(
  raw: string | undefined = process.env.SITE_URL,
): string {
  const text = raw === undefined ? "" : raw.trim();
  if (text === "") return localSiteUrl;

  const url = parseWebAddress(text);
  if (url === null) {
    throw new Error(
      `SITE_URL must be a full web address, for example https://neighbors.example (it was "${text}").`,
    );
  }
  return url.origin;
}

// A full address for a path on this site, for example /board.
export function absoluteUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${clean}`;
}
