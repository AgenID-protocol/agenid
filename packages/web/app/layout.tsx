import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/api";

const TITLE = "AgenID — AI Agents Need an Identity";
const DESCRIPTION =
  "AgenID gives every AI agent a permanent, portable identity that people, businesses, and other AI agents can independently verify. Open protocol · cryptographically verifiable · platform independent.";

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
  icons: { icon: "/agenid-mark.png" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", siteName: "AgenID", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/** The sealed square — Brand Guide §01. Never recolored, never swapped. Unused directly
 * in this file now that Nav renders its own mark, but kept for pages that import it. */
export function Mark() {
  return <Image src="/agenid-mark.png" alt="" width={28} height={28} className="rounded-md" priority aria-hidden />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-mint focus:px-3 focus:py-2 focus:text-ink">
          Skip to content
        </a>
        <Nav />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
