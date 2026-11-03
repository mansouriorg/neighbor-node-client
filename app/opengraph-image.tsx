import { ImageResponse } from "next/og";
import { ShareCard } from "@/components/share-card";

// The picture that shows when someone shares a link to the site.
// Next draws it once, when you build, and turns it into a PNG.
// This file may only export alt, size, contentType and the function below.
// The drawing itself is in components/share-card.tsx.
export const alt =
  "Neighbor Node: ask for a hand, offer one, lend what you do not use.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<ShareCard />, { ...size });
}
