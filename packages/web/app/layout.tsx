import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/api";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/seo";

// Shared with the homepage (app/page.tsx) via lib/seo.ts so the two cannot drift.
const TITLE = HOME_TITLE;
const DESCRIPTION = HOME_DESCRIPTION;

// Brand faces (design pass 2026-09-23, approved by Mike). next/font self-hosts them at
// build time: no runtime request to Google, no new npm dependency, and the system stack
// in globals.css stays as the fallback. Geist Mono's 0/O and 1/l/I are unambiguous, which
// matters for ULIDs a reader might retype.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });


export const metadata: Metadata = {
  title: { default: TITLE, template: "%s · AgenID" },
  description: DESCRIPTION,
  keywords: [
    "AI agent identity",
    "AI agent verification",
    "AI agent identity protocol",
    "machine-verifiable identity",
    "agent-to-agent identity",
    "AI agent accountability",
    "cryptographic provenance",
    "Ed25519",
    "RFC 8785 JCS",
  ],
  // Same origin as the sitemap and every JSON-LD block (lib/api SITE_URL). The apex
  // 308-redirects to www, so a canonical on the apex points search engines at a redirect.
  metadataBase: new URL(SITE_URL),
  // Icons come from the file conventions (app/favicon.ico, app/icon.png, app/apple-icon.png).
  // The old `icons: { icon: "/agenid-mark.png" }` served a 359 KB PNG as the favicon and
  // left /favicon.ico a 404.
  //
  // No `url` here, on purpose: Next merges this object into every child page that does not
  // define its own openGraph, so `url: "/"` made twenty pages claim to be the homepage.
  // Pages set their own via lib/seo.ts pageMetadata(); anything that does not simply omits
  // og:url rather than pointing it somewhere wrong.
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "AgenID", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  // Search-engine ownership tokens. Read from the environment so no token is committed;
  // an unset variable renders nothing rather than an empty meta tag.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
};

/** The sealed square — Brand Guide §01. Never recolored, never swapped. Unused directly
 * in this file now that Nav renders its own mark, but kept for pages that import it. */
export function Mark() {
  return <Image src="/agenid-mark.png" alt="" width={28} height={28} className="rounded-md" priority aria-hidden />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks the document as script-capable before first paint, so `.reveal` content is
            only ever hidden when something is running that will reveal it. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2 focus:text-ink">
          Skip to content
        </a>
        <Nav />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
