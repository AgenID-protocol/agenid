import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const TITLE = "AgenID — Identity Infrastructure for Production AI Agents";
const DESCRIPTION =
  "The open identity, provenance, and machine-resolution standard for AI agents. Permanent agenid:<ULID> identities, Ed25519 proofs over RFC 8785 canonical JSON, independently verifiable without trusting AgenID's own registry.";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s · AgenID" },
  description: DESCRIPTION,
  keywords: [
    "AI agent identity protocol",
    "machine-verifiable identity",
    "cryptographic provenance",
    "agent interoperability",
    "AI agent verification",
    "Ed25519",
    "RFC 8785 JCS",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenid.com"),
  icons: { icon: "/agenid-mark.png" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", siteName: "AgenID", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/** The sealed square — Brand Guide §01. Never recolored, never swapped. */
function Mark() {
  return <Image src="/agenid-mark.png" alt="" width={28} height={28} className="rounded-md" priority aria-hidden />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line/70">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <Mark /> AgenID
            </Link>
            <div className="flex items-center gap-1 text-sm text-muted">
              <a className="rounded-md px-3 py-1.5 hover:text-paper" href="https://github.com/AgenID-protocol/spec">Spec</a>
              <a className="rounded-md px-3 py-1.5 hover:text-paper" href="https://github.com/AgenID-protocol/spec/tree/main/schemas">Schemas</a>
              <a className="rounded-md px-3 py-1.5 hover:text-paper" href="https://github.com/AgenID-protocol/agenid">@agenid/core</a>
              <a className="btn btn-ghost ml-2 !py-1.5" href="https://github.com/AgenID-protocol">GitHub</a>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mt-24 border-t border-line/70">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted">
            <span>AgenID Protocol v1.1.1 · MIT · Maintained by AI Venture Holdings LLC</span>
            <span className="font-mono">agenid:&lt;ULID&gt; · RFC 8785 JCS · Ed25519</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
