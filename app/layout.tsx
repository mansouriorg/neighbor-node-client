import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

// One font is enough. The few words that need a fixed width use the system font.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // With this, the address of the share image becomes a full address.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Neighbor Node - a help and lending board for neighbors",
    template: "%s | Neighbor Node",
  },
  description:
    "A small board where neighbors ask for help, offer a hand, or lend things they do not use.",
  // The picture itself comes from app/opengraph-image.tsx. A page that sets
  // its own openGraph replaces this whole block, so none does yet.
  openGraph: {
    siteName: "Neighbor Node",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
        >
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
