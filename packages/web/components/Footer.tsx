"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Col = { title: string; links: { href: string; label: string; external?: boolean }[] };

const COLUMNS: Col[] = [
  {
    title: "Product",
    links: [
      { href: "/verify", label: "Verify an Agent" },
      { href: "/agents", label: "Agent Directory" },
      { href: "/#identity", label: "Agent Identity" },
      { href: "/badge", label: "Badges" },
      { href: "/api/v1/openapi.json", label: "Verification API", external: true },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/onboarding", label: "Quick Start" },
      // The monorepo is public since 2026-09-23. Same links as Nav.
      { href: "https://github.com/AgenID-protocol/agenid", label: "Source (GitHub)", external: true },
      { href: "https://github.com/AgenID-protocol", label: "AgenID on GitHub", external: true },
      { href: "/docs/partners/mcp-server-integration", label: "MCP Server" },
      { href: "https://github.com/AgenID-protocol/spec", label: "Protocol Spec", external: true },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { href: "/ecosystem", label: "Overview" },
      { href: "/docs/partners", label: "Integration Briefs" },
      { href: "https://github.com/AgenID-protocol/conformance", label: "Conformance Suite", external: true },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn", label: "Guides" },
      { href: "/glossary", label: "Glossary" },
      { href: "/compare", label: "Comparisons" },
      { href: "/use-cases", label: "Use Cases" },
      { href: "/state-of-agent-identity", label: "Research Report" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/trust", label: "Security & Cryptography" },
      { href: "/why-agent-identity", label: "Why Agent Identity?" },
      // ERRATA.md does not exist at the repository root — that URL was a 404. The errata
      // log lives at docs/errata.md.
      { href: "https://github.com/AgenID-protocol/spec/blob/main/docs/errata.md", label: "Errata Log", external: true },
    ],
  },
];

export function Footer() {
  const pathname = usePathname() ?? "/";
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-3 font-mono text-xs text-paper" aria-hidden>
                ✓
              </span>
              AgenID
            </Link>
            <p className="mt-3 max-w-[220px] text-xs leading-relaxed text-muted">
              The open identity, provenance, and machine-resolution standard for AI agents.
            </p>
            <Link href="/verify" className="btn btn-ghost btn-sm mt-5">
              Verify an Agent
            </Link>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="eyebrow">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener" : undefined}
                      aria-current={!l.external && !l.href.includes("#") && l.href === pathname ? "page" : undefined}
                      className="text-sm text-paper-dim hover:text-paper hover:underline"
                    >
                      {l.label}
                      {l.external && <span className="ml-1 text-xs text-muted">↗</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          {/* "MIT" unqualified read as "this product is open-source". The MIT-licensed,
              publicly readable artifacts are the specification and the conformance suite. */}
          <span>AgenID Protocol v1.1.1 · Specification MIT-licensed · Maintained by AI Venture Holdings LLC</span>
          <span className="font-mono">agenid:&lt;ULID&gt; · RFC 8785 JCS · Ed25519</span>
        </div>
      </div>
    </footer>
  );
}
