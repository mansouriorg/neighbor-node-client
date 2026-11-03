import type { NextConfig } from "next";

// Safe headers for every page. Each one only turns a browser feature off.
// There is no script policy (CSP script-src) yet. It needs a fresh nonce on
// every page, or 'unsafe-inline', and that is a bigger decision for later.
const securityHeaders = [
  // Browsers must not guess the type of a file.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites learn the address of this site, but not which page it was.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Other sites cannot show this site inside a frame (clickjacking).
  // The first line is for old browsers, the second is the modern way.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // The site does not need the camera, the microphone or the location.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Do not tell the world that this site runs on Next.js.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
